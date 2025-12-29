import { NextRequest } from 'next/server';
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const daysAfterExpiry = Number(url.searchParams.get('daysAfterExpiry') ?? 30);
    const offset = (page - 1) * limit;

    // Calculate date threshold for expired subscriptions
    const currentDate = new Date();
    const expiryStartThreshold = new Date();
    expiryStartThreshold.setDate(expiryStartThreshold.getDate() - daysAfterExpiry);

    // Get users with recently expired subscriptions
    const usersWithExpiredSubscriptions = await prisma.user.findMany({
      where: {
        AND: [
          {
            email: {
              not: null
            }
          },
          {
            subscriptions: {
              some: {
                AND: [
                  {
                    expiresAt: {
                      lt: currentDate, // Already expired
                      gte: expiryStartThreshold // But not too long ago
                    }
                  },
                  {
                    isTrial: false // Exclude trial subscriptions
                  }
                ]
              }
            }
          }
        ]
      },
      include: {
        subscriptions: {
          where: {
            AND: [
              {
                expiresAt: {
                  lt: currentDate,
                  gte: expiryStartThreshold
                }
              },
              {
                isTrial: false
              }
            ]
          },
          include: {
            plan: true
          },
          orderBy: {
            expiresAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limit
    });

    // Get total count for pagination
    const totalCount = await prisma.user.count({
      where: {
        AND: [
          {
            email: {
              not: null
            }
          },
          {
            subscriptions: {
              some: {
                AND: [
                  {
                    expiresAt: {
                      lt: currentDate,
                      gte: expiryStartThreshold
                    }
                  },
                  {
                    isTrial: false
                  }
                ]
              }
            }
          }
        ]
      }
    });

    // Format the response
    const formattedUsers = usersWithExpiredSubscriptions.map(user => {
      const subscription = user.subscriptions[0];
      const daysSinceExpiry = Math.floor((currentDate.getTime() - new Date(subscription.expiresAt).getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionId: subscription.id,
        planType: subscription.plan.planType,
        planTitle: subscription.plan.title,
        expiredAt: subscription.expiresAt,
        daysSinceExpiry,
        period: subscription.period,
        isRecentlyExpired: daysSinceExpiry <= 7,
        registeredAt: user.createdAt,
        monthlyPrice: subscription.plan.monthlyPrice,
        yearlyPrice: subscription.plan.yearlyPrice
      };
    });

    const totalPages = Math.ceil(totalCount / limit);

    return Response.json(toSafeJSON({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      filters: {
        daysAfterExpiry
      }
    }));

  } catch (error) {
    console.error('Error fetching users with expired subscriptions:', error);
    return Response.json(
      { error: 'Failed to fetch users with expired subscriptions' },
      { status: 500 }
    );
  }
}