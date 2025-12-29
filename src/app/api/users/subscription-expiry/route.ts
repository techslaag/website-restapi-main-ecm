import { NextRequest } from 'next/server';
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const daysUntilExpiry = Number(url.searchParams.get('daysUntilExpiry') ?? 7);
    const offset = (page - 1) * limit;

    // Calculate date threshold for upcoming expiry
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + daysUntilExpiry);

    // Get users with subscriptions expiring soon
    const usersWithExpiringSubscriptions = await prisma.user.findMany({
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
                      gte: new Date(), // Not yet expired
                      lte: expiryThreshold // But expiring soon
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
                  gte: new Date(),
                  lte: expiryThreshold
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
            expiresAt: 'asc'
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
                      gte: new Date(),
                      lte: expiryThreshold
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
    const formattedUsers = usersWithExpiringSubscriptions.map(user => {
      const subscription = user.subscriptions[0];
      const daysUntilExpiry = Math.ceil((new Date(subscription.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionId: subscription.id,
        planType: subscription.plan.planType,
        planTitle: subscription.plan.title,
        expiresAt: subscription.expiresAt,
        daysUntilExpiry,
        period: subscription.period,
        isExpiringSoon: daysUntilExpiry <= 3,
        registeredAt: user.createdAt
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
        daysUntilExpiry
      }
    }));

  } catch (error) {
    console.error('Error fetching users with expiring subscriptions:', error);
    return Response.json(
      { error: 'Failed to fetch users with expiring subscriptions' },
      { status: 500 }
    );
  }
}