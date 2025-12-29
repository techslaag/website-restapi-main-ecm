import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import authMiddleware from "@/lib/auth/authMiddleware";
import { 
  calculateUpgradePrice, 
  isEligibleForUpgrade, 
  getEcomembrePlan 
} from "@/lib/utils/subscriptionUpgradeUtils";
import { getActiveSubscription } from "@/lib/utils/subscriptionUtils";
import { upgradeRateLimiter } from "@/lib/security/rateLimiter";
import { subscriptionUpgradeDeduplicator, generateIdempotencyKey, idempotencyStore } from "@/lib/security/requestDeduplication";
import { auditLogger, AuditEventType, AuditSeverity } from "@/lib/security/auditLogger";

// Enhanced validation schema with additional security checks
const upgradeSchema = z.object({
  targetPlanType: z.enum(["ecomember"], {
    errorMap: () => ({ message: "Invalid target plan type" })
  }),
  confirmUpgrade: z.boolean().default(false),
  idempotencyKey: z.string().optional(),
  clientVersion: z.string().max(50).optional(),
  upgradeReason: z.string().max(500).optional()
}).strict(); // Reject unknown properties

/**
 * Helper function to add secure CORS headers
 */
function addCorsHeaders(response: NextResponse) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
  const origin = process.env.NODE_ENV === 'production' 
    ? allowedOrigins[0] // In production, use first allowed origin
    : '*'; // In development, allow all origins for testing
    
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Idempotency-Key');
  
  // Only allow credentials with specific origins in production
  if (origin !== '*') {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  response.headers.set('Access-Control-Max-Age', '3600');
  return response;
}

/**
 * OPTIONS /api/subscriptions/upgrade
 * Handle CORS preflight requests with secure headers
 */
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}

/**
 * POST /api/subscriptions/upgrade
 * Secure subscription upgrade with comprehensive validation and protection
 */
export async function POST(request: NextRequest) {
  return authMiddleware(request, async (user) => {
    let lockAcquired = false;
    let idempotencyKey: string | undefined;
    let targetPlanType: string | undefined;
    
    try {
      // 1. Rate limiting check
      const rateLimitResult = upgradeRateLimiter.check(request);
      if (!rateLimitResult.success) {
        await auditLogger.logRateLimitExceeded(
          '/api/subscriptions/upgrade',
          rateLimitResult.limit,
          request,
          user
        );
        
        const response = NextResponse.json(
          { 
            success: false, 
            error: "Too many upgrade attempts",
            retryAfter: rateLimitResult.retryAfter
          }, 
          { status: 429 }
        );
        response.headers.set('Retry-After', String(rateLimitResult.retryAfter || 900));
        return addCorsHeaders(response);
      }

      // 2. Parse and validate request body
      const body = await request.json();
      const validatedData = upgradeSchema.parse(body);
      const { confirmUpgrade, idempotencyKey: providedKey, upgradeReason } = validatedData;
      targetPlanType = validatedData.targetPlanType;

      // 3. Generate or use provided idempotency key
      idempotencyKey = providedKey || generateIdempotencyKey(user.id, 'subscription-upgrade', validatedData);
      
      // 4. Check idempotency - return cached result if operation already completed
      if (confirmUpgrade) {
        const cachedResult = idempotencyStore.get(idempotencyKey);
        if (cachedResult) {
          await auditLogger.log(
            AuditEventType.SUBSCRIPTION_UPGRADED,
            `Returning cached upgrade result for user ${user.email}`,
            { user, request, metadata: { idempotencyKey, cached: true } }
          );
          
          const response = NextResponse.json({
            success: true,
            cached: true,
            ...cachedResult
          });
          return addCorsHeaders(response);
        }
      }

      // 5. Acquire lock to prevent concurrent upgrades
      if (confirmUpgrade) {
        const lockResult = subscriptionUpgradeDeduplicator.acquireLock(user.id, targetPlanType);
        if (!lockResult.success) {
          await auditLogger.logConcurrentRequestBlocked(user, 'subscription-upgrade', request);
          
          const response = NextResponse.json(
            { 
              success: false, 
              error: "Upgrade already in progress",
              message: "Please wait for the current upgrade to complete"
            }, 
            { status: 409 }
          );
          return addCorsHeaders(response);
        }
        lockAcquired = true;
      }

      // 6. Database transaction for all subscription operations
      const result = await prisma.$transaction(async (tx) => {
        // Get user's current active subscription with fresh data
        const currentSubscription = await tx.subscription.findFirst({
          where: {
            userId: user.id,
            expiresAt: { gte: new Date() },
            OR: [
              { payment: { status: { in: ["succeeded", "processing"] } } },
              { paymentId: null },
              { isTrial: true, trialEnd: { gte: new Date() } }
            ]
          },
          include: {
            plan: true,
            payment: true
          },
          orderBy: { createdAt: 'desc' }
        });
        
        if (!currentSubscription) {
          throw new Error("No active subscription found");
        }

        // Double-check eligibility with fresh data
        const eligibility = isEligibleForUpgrade(currentSubscription as any, targetPlanType!);
        if (!eligibility.eligible) {
          throw new Error(eligibility.reason || "Not eligible for upgrade");
        }

        // Get target plan with current pricing
        const targetPlan = await getEcomembrePlan(tx);
        if (!targetPlan) {
          throw new Error("Target plan not found or unavailable");
        }

        // Verify plan hasn't been archived
        if (targetPlan.archivedAt) {
          throw new Error("Target plan is no longer available");
        }

        // Calculate upgrade pricing with fresh data
        const upgradeCalculation = calculateUpgradePrice(currentSubscription as any, targetPlan);

        // Log business logic calculation for audit
        await auditLogger.logBusinessLogicEvent(
          'upgrade-calculation',
          `Price calculation: ${upgradeCalculation.finalPrice}€ (credit: ${upgradeCalculation.remainingValue}€)`,
          user,
          true,
          request,
          {
            calculation: upgradeCalculation,
            targetPlanType,
            currentPlanType: currentSubscription.plan.planType
          }
        );

        // If not confirming, just return the calculation
        if (!confirmUpgrade) {
          return {
            type: 'calculation',
            data: {
              calculation: upgradeCalculation,
              eligible: true,
              currentSubscription: {
                id: currentSubscription.id,
                planType: currentSubscription.plan.planType,
                expiresAt: currentSubscription.expiresAt
              }
            }
          };
        }

        // Perform the actual upgrade with additional validations
        const now = new Date();
        
        // Final verification that subscription state hasn't changed
        const finalCheck = await tx.subscription.findUnique({
          where: { id: currentSubscription.id },
          select: { planId: true, expiresAt: true, updatedAt: true }
        });

        if (!finalCheck || finalCheck.planId !== currentSubscription.planId) {
          throw new Error("Subscription state changed during upgrade process");
        }

        // Update the subscription atomically
        const updatedSubscription = await tx.subscription.update({
          where: { id: currentSubscription.id },
          data: {
            planId: targetPlan.id,
            upgradedAt: now,
            upgradedFromPlanId: currentSubscription.planId,
            upgradePrice: upgradeCalculation.finalPrice,
            upgradeCreditUsed: upgradeCalculation.remainingValue,
            upgradeDescription: upgradeCalculation.description,
            updatedAt: now
          },
          include: {
            plan: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        });

        return {
          type: 'upgrade',
          data: {
            subscription: updatedSubscription,
            upgrade: {
              fromPlan: currentSubscription.plan.title,
              toPlan: targetPlan.title,
              pricePaid: upgradeCalculation.finalPrice,
              creditUsed: upgradeCalculation.remainingValue,
              description: upgradeCalculation.description,
              upgradedAt: now
            }
          }
        };
      }, {
        isolationLevel: 'Serializable',
        timeout: 30000 // 30 second timeout
      });

      // 7. Log successful operation
      if (result.type === 'upgrade') {
        await auditLogger.logSubscriptionUpgrade(
          user,
          (result.data as any).upgrade.fromPlan,
          (result.data as any).upgrade.toPlan,
          (result.data as any).upgrade.pricePaid,
          request,
          { idempotencyKey, upgradeReason }
        );

        // Cache the result for idempotency
        idempotencyStore.set(idempotencyKey!, result.data);
      }

      const responseData = {
        success: true,
        message: result.type === 'upgrade' ? "Subscription upgraded successfully" : "Upgrade calculation completed",
        data: result.data
      };

      const response = NextResponse.json(responseData);
      return addCorsHeaders(response);

    } catch (error) {
      // Log error for audit
      await auditLogger.log(
        AuditEventType.SUBSCRIPTION_UPGRADED,
        `Subscription upgrade failed for user ${user.email}: ${(error as Error).message}`,
        {
          severity: AuditSeverity.HIGH,
          user,
          request,
          success: false,
          errorMessage: (error as Error).message,
          metadata: { idempotencyKey }
        }
      );

      console.error("[SubscriptionUpgrade] Error:", error);
      
      if (error instanceof z.ZodError) {
        const response = NextResponse.json(
          { 
            success: false, 
            error: "Invalid request data", 
            details: process.env.NODE_ENV === 'development' ? error.errors : undefined
          }, 
          { status: 400 }
        );
        return addCorsHeaders(response);
      }

      const isBusinessLogicError = error instanceof Error && [
        "No active subscription found",
        "Not eligible for upgrade",
        "Target plan not found",
        "Subscription state changed"
      ].some(msg => (error as Error).message.includes(msg));

      const response = NextResponse.json(
        { 
          success: false, 
          error: isBusinessLogicError ? (error as Error).message : "Internal server error",
          errorCode: isBusinessLogicError ? "BUSINESS_LOGIC_ERROR" : "INTERNAL_ERROR"
        }, 
        { status: isBusinessLogicError ? 400 : 500 }
      );
      return addCorsHeaders(response);
    } finally {
      // Always release the lock
      if (lockAcquired) {
        subscriptionUpgradeDeduplicator.releaseLock(user.id, targetPlanType);
      }
    }
  });
}

/**
 * GET /api/subscriptions/upgrade
 * Secure upgrade eligibility and pricing information
 */
export async function GET(request: NextRequest) {
  return authMiddleware(request, async (user) => {
    try {
      // Rate limiting for GET requests
      const rateLimitResult = upgradeRateLimiter.check(request);
      if (!rateLimitResult.success) {
        const response = NextResponse.json(
          { 
            success: false, 
            error: "Too many requests",
            retryAfter: rateLimitResult.retryAfter
          }, 
          { status: 429 }
        );
        response.headers.set('Retry-After', String(rateLimitResult.retryAfter || 900));
        return addCorsHeaders(response);
      }

      // Validate query parameters
      const url = new URL(request.url);
      const targetPlanType = url.searchParams.get("targetPlanType");
      
      // Validate target plan type
      if (targetPlanType && !["ecomember"].includes(targetPlanType)) {
        const response = NextResponse.json({
          success: false,
          error: "Invalid target plan type"
        }, { status: 400 });
        return addCorsHeaders(response);
      }

      const validTargetPlanType = targetPlanType || "ecomember";

      // Database transaction for consistent reads
      const result = await prisma.$transaction(async (tx) => {
        // Get user's current active subscription
        const currentSubscription = await tx.subscription.findFirst({
          where: {
            userId: user.id,
            expiresAt: { gte: new Date() },
            OR: [
              { payment: { status: { in: ["succeeded", "processing"] } } },
              { paymentId: null },
              { isTrial: true, trialEnd: { gte: new Date() } }
            ]
          },
          include: {
            plan: true,
            payment: true
          },
          orderBy: { createdAt: 'desc' }
        });
        
        if (!currentSubscription) {
          return {
            eligible: false,
            reason: "No active subscription found"
          };
        }

        // Check eligibility for upgrade
        const eligibility = isEligibleForUpgrade(currentSubscription as any, validTargetPlanType);
        
        if (!eligibility.eligible) {
          return {
            eligible: false,
            reason: eligibility.reason,
            currentPlan: {
              id: currentSubscription.plan.id,
              planType: currentSubscription.plan.planType,
              title: currentSubscription.plan.title
            }
          };
        }

        // Get target plan and calculate pricing
        const targetPlan = await getEcomembrePlan(tx);
        if (!targetPlan || targetPlan.archivedAt) {
          return {
            eligible: false,
            reason: "Target plan not available"
          };
        }

        const upgradeCalculation = calculateUpgradePrice(currentSubscription as any, targetPlan);

        // Log the pricing inquiry for audit
        await auditLogger.logBusinessLogicEvent(
          'upgrade-pricing-inquiry',
          `Price inquiry: ${upgradeCalculation.finalPrice}€ for ${user.email}`,
          user,
          true,
          request,
          {
            targetPlanType: validTargetPlanType,
            currentPlanType: currentSubscription.plan.planType,
            calculation: upgradeCalculation
          }
        );

        return {
          eligible: true,
          calculation: upgradeCalculation,
          currentSubscription: {
            id: currentSubscription.id,
            plan: {
              id: currentSubscription.plan.id,
              planType: currentSubscription.plan.planType,
              title: currentSubscription.plan.title
            },
            expiresAt: currentSubscription.expiresAt,
            period: currentSubscription.period
          },
          targetPlan: {
            id: targetPlan.id,
            planType: targetPlan.planType,
            title: targetPlan.title
          }
        };
      }, {
        isolationLevel: 'ReadCommitted'
      });

      const response = NextResponse.json({
        success: true,
        data: result
      });
      return addCorsHeaders(response);

    } catch (error) {
      console.error("[SubscriptionUpgradeInfo] Error:", error);
      
      await auditLogger.log(
        AuditEventType.ELIGIBILITY_CHECK,
        `Upgrade info request failed for user ${user.email}: ${(error as Error).message}`,
        {
          severity: AuditSeverity.MEDIUM,
          user,
          request,
          success: false,
          errorMessage: (error as Error).message
        }
      );
      
      const response = NextResponse.json(
        { 
          success: false, 
          error: "Internal server error",
          errorCode: "INTERNAL_ERROR"
        }, 
        { status: 500 }
      );
      return addCorsHeaders(response);
    }
  });
}