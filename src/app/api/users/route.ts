import adminMiddleware from "@/lib/auth/adminMiddleware";
// Removed getPaginatedResult import as we're using custom implementation
import { extractQueryParams } from "@/lib/utils/index";
// Removed subscriptionPublicSelectInput import to avoid FK issues
import { serializeError } from "serialize-error";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return adminMiddleware(request, async (user) => {
    try {
      const url = new URL(request.url);
      const expiredSubscriptions = url.searchParams.get("expiredSubscriptions");
      const noSubscriptions = url.searchParams.get("noSubscriptions");
      const search = url.searchParams.get("search");
      const sortBy = url.searchParams.get("sortBy");
      const sortDirection = url.searchParams.get("sortDirection");
      const queryParams: { page: string; limit: string } =
        extractQueryParams(request);

      let whereClause: any = {};
      
      // Build search conditions
      const conditions: any[] = [];

      if (expiredSubscriptions === "true") {
        conditions.push({
          subscriptions: {
            some: {
              expiresAt: {
                lt: new Date(),
              },
            },
          },
        });
      }

      if (noSubscriptions === "true") {
        conditions.push({
          subscriptions: {
            none: {},
          },
        });
      }

      if (search && search.trim() && search.trim() !== '') {
        conditions.push({
          email: {
            contains: search.trim(),
            // Note: MySQL doesn't support mode: "insensitive", but MySQL is case-insensitive by default for VARCHAR
          },
        });
      }

      // Combine conditions with AND
      if (conditions.length > 0) {
        whereClause = conditions.length === 1 ? conditions[0] : { AND: conditions };
      }

      // Custom implementation to handle nullable plan relations
      const page = Number(queryParams.page ?? 1);
      const limit = Number(queryParams.limit ?? 10);
      const offset = (page - 1) * limit;

      // Build sort order
      let orderByClause: any = { createdAt: "desc" }; // Default sort
      
      const allowedSortFields = ["id", "email", "name", "createdAt", "type"];
      const validSortBy = sortBy && allowedSortFields.includes(sortBy.trim()) ? sortBy.trim() : null;
      const validDirection = sortDirection === "desc" ? "desc" : "asc";
      
      if (validSortBy) {
        switch (validSortBy) {
          case "id":
            orderByClause = { id: validDirection };
            break;
          case "email":
            orderByClause = { email: validDirection };
            break;
          case "name":
            orderByClause = { name: validDirection };
            break;
          case "createdAt":
            orderByClause = { createdAt: validDirection };
            break;
          case "type":
            // Sort by admin status (admins first when desc, users first when asc)
            orderByClause = [
              { admin: validDirection },
              { name: "asc" } // Secondary sort by name
            ];
            break;
          default:
            orderByClause = { createdAt: "desc" };
        }
      }

      // Debug logging
      console.log("=== BACKEND DEBUG ===");
      console.log("Full URL:", request.url);
      console.log("Search params extracted:", { 
        search: `"${search}"`, 
        expiredSubscriptions: `"${expiredSubscriptions}"`,
        noSubscriptions: `"${noSubscriptions}"`,
        sortBy: `"${sortBy}"`,
        sortDirection: `"${sortDirection}"`,
        validSortBy: `"${validSortBy}"`,
        validDirection: `"${validDirection}"`,
        searchType: typeof search,
        expiredType: typeof expiredSubscriptions,
        noSubscriptionsType: typeof noSubscriptions
      });
      console.log("Raw query params:", queryParams);
      console.log("Conditions array:", conditions);
      console.log("Final where clause:", JSON.stringify(whereClause, null, 2));
      console.log("Order by clause:", JSON.stringify(orderByClause, null, 2));
      console.log("Page/Limit:", { page, limit, offset });
      console.log("=== END BACKEND DEBUG ===");

      const total = await prisma.user.count({
        where: whereClause,
      });

      console.log("Total users found:", total);

      // Get users with subscriptions first (without plan join to avoid FK issues)
      const users = await prisma.user.findMany({
        where: whereClause,
        include: {
          subscriptions: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
            select: {
              id: true,
              reference: true,
              period: true,
              expiresAt: true,
              createdAt: true,
              updatedAt: true,
              planId: true,
              isTrial: true,
              trialEnd: true,
              trialStarted: true,
              trialConvertedAt: true,
              payment: {
                select: {
                  id: true,
                  provider: true,
                  providerPaymentMethod: true,
                  mobileOperator: true,
                  clientCountryAlpha2Code: true,
                  reference: true,
                  paidAmount: true,
                  status: true,
                  paidAmountCurrency: true,
                  createdAt: true,
                },
              },
            },
          },
        },
        orderBy: orderByClause,
        skip: offset,
        take: limit,
      });

      // Get all plan IDs from the subscriptions
      const planIds = users
        .flatMap(user => user.subscriptions)
        .map(sub => sub.planId)
        .filter((id, index, arr) => arr.indexOf(id) === index); // unique values

      // Get all plans for these IDs (only if we have plan IDs)
      const plans = planIds.length > 0 ? await prisma.plan.findMany({
        where: {
          id: {
            in: planIds,
          },
        },
        select: {
          id: true,
          title: true,
          planType: true,
          description: true,
        },
      }) : [];

      // Create a map for quick plan lookup
      const planMap = new Map(plans.map(plan => [plan.id, plan]));

      // Manually attach plan data to subscriptions
      const usersWithPlans = users.map(user => ({
        ...user,
        subscriptions: user.subscriptions.map(subscription => ({
          ...subscription,
          plan: planMap.get(subscription.planId) || null,
        })),
      }));

      const totalPages = Math.ceil(total / limit);

      const paginatedResponse = {
        items: usersWithPlans,
        limit,
        page,
        total,
        totalPages,
      };

      console.log("Returning response with", usersWithPlans.length, "users");
      console.log("Users emails found:", usersWithPlans.map(u => u.email));

      return Response.json(paginatedResponse);
    } catch (error) {
      return Response.json(serializeError(error), {
        status: 500,
      });
    }
  });
}
