import { NextRequest } from 'next/server';
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const offset = (page - 1) * limit;

    // Get users with expired subscriptions
    const expiredUsers = await prisma.user.findMany({
      where: {
        AND: [
          {
            subscriptions: {
              some: {
                expiresAt: {
                  lt: new Date() // Expired before now
                }
              }
            }
          },
          {
            // Optionally filter users who haven't been contacted recently
            // This could be enhanced with a "last_contacted" field
            email: {
              not: null
            }
          }
        ]
      },
      include: {
        subscriptions: {
          where: {
            expiresAt: {
              lt: new Date()
            }
          },
          include: {
            plan: true
          },
          orderBy: {
            expiresAt: 'desc'
          },
          take: 1 // Get the most recent expired subscription
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
            subscriptions: {
              some: {
                expiresAt: {
                  lt: new Date()
                }
              }
            }
          },
          {
            email: {
              not: null
            }
          }
        ]
      }
    });

    // Format the response
    const formattedUsers = expiredUsers.map(user => {
      const subscription = user.subscriptions[0];
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        expiredAt: subscription?.expiresAt,
        planType: subscription?.plan?.planType,
        planTitle: subscription?.plan?.title,
        subscriptionId: subscription?.id,
        daysSinceExpiration: subscription?.expiresAt ? 
          Math.floor((new Date().getTime() - new Date(subscription.expiresAt).getTime()) / (1000 * 60 * 60 * 24)) : 0
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
      }
    }));

  } catch (error) {
    console.error('Error fetching expired subscriptions:', error);
    return Response.json(
      { error: 'Failed to fetch expired subscriptions' },
      { status: 500 }
    );
  }
}