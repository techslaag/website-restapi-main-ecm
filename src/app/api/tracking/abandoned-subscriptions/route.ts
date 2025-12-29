import { NextRequest, NextResponse } from 'next/server';
import { AbandonedSubscriptionStep } from '@prisma/client';
import { 
  trackAbandonedSubscription, 
  extractTrackingInfo, 
  generateSessionId 
} from '@/lib/utils/abandonedSubscriptionTracker';
import { getToken } from 'next-auth/jwt';

/**
 * @swagger
 * /api/tracking/abandoned-subscriptions:
 *   post:
 *     summary: Track abandoned subscription events
 *     description: Records user interactions during the subscription flow to track abandonments
 *     tags: [Tracking]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *               - step
 *             properties:
 *               planId:
 *                 type: string
 *                 description: ID of the subscription plan
 *               step:
 *                 type: string
 *                 enum: [plan_selection, user_registration, payment_method, payment_processing]
 *                 description: Current step in the subscription flow
 *               period:
 *                 type: string
 *                 enum: [month, year, week]
 *                 default: month
 *                 description: Subscription period
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *               metadata:
 *                 type: object
 *                 description: Additional tracking metadata
 *     responses:
 *       201:
 *         description: Tracking event recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad request - missing required fields
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { planId, step, period = 'month', email, metadata } = body;

    // Validation
    if (!planId || !step) {
      return NextResponse.json(
        { error: 'planId and step are required' },
        { status: 400 }
      );
    }

    // Validate step
    const validSteps: AbandonedSubscriptionStep[] = [
      'plan_selection',
      'user_registration', 
      'payment_method',
      'payment_processing'
    ];

    if (!validSteps.includes(step)) {
      return NextResponse.json(
        { error: `Invalid step. Must be one of: ${validSteps.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate period
    if (!['month', 'year', 'week'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period. Must be month, year, or week' },
        { status: 400 }
      );
    }

    // Extract user information from token if available
    let userId: string | undefined;
    try {
      const token = await getToken({ req: request });
      userId = token?.sub || undefined;
    } catch (error) {
      // Continue without user ID if token extraction fails
      console.log('Could not extract user ID from token:', error);
    }

    // Generate session ID
    const sessionId = generateSessionId(request);

    // Extract tracking info
    const trackingInfo = extractTrackingInfo(request);

    // Track the abandoned subscription
    const result = await trackAbandonedSubscription({
      sessionId,
      userId,
      planId,
      period,
      email,
      step,
      ...trackingInfo,
      metadata: {
        ...metadata,
        apiTracking: true,
        route: request.url,
        method: request.method,
        timestamp: new Date().toISOString()
      }
    });

    // Create response with session cookie
    const response = NextResponse.json(
      { 
        success: true, 
        data: {
          id: result.id,
          sessionId,
          step,
          planId
        }
      },
      { status: 201 }
    );

    // Set session cookie if not already present
    const existingSessionId = request.cookies.get('session_id');
    if (!existingSessionId) {
      response.cookies.set('session_id', sessionId, {
        maxAge: 60 * 60 * 24 * 30, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    }

    return response;

  } catch (error) {
    console.error('Error tracking abandoned subscription:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/tracking/abandoned-subscriptions:
 *   get:
 *     summary: Get abandoned subscription tracking status
 *     description: Returns tracking configuration and current session info
 *     tags: [Tracking]
 *     responses:
 *       200:
 *         description: Tracking status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *                 sessionId:
 *                   type: string
 *                 config:
 *                   type: object
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = generateSessionId(request);
    
    return NextResponse.json({
      enabled: true,
      sessionId,
      config: {
        validSteps: ['plan_selection', 'user_registration', 'payment_method', 'payment_processing'],
        validPeriods: ['month', 'year', 'week']
      }
    });
  } catch (error) {
    console.error('Error getting tracking status:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}