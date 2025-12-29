import { NextRequest } from 'next/server';
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const daysInactive = Number(url.searchParams.get('daysInactive') ?? 30);
    const offset = (page - 1) * limit;

    // Calculate date threshold for inactive users
    const inactiveThreshold = new Date();
    inactiveThreshold.setDate(inactiveThreshold.getDate() - daysInactive);

    // Get users who haven't had any sessions after the threshold date
    const inactiveUsers = await prisma.user.findMany({
      where: {
        AND: [
          {
            email: {
              not: null
            }
          },
          {
            // Users who have never had a session or last session was before threshold
            OR: [
              {
                sessions: {
                  none: {}
                }
              },
              {
                sessions: {
                  none: {
                    createdAt: {
                      gte: inactiveThreshold
                    }
                  }
                }
              }
            ]
          }
        ]
      },
      include: {
        sessions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1 // Get the most recent session
        },
        subscriptions: {
          where: {
            OR: [
              { expiresAt: { gte: new Date() } }, // Active subscriptions
              { isTrial: true }
            ]
          },
          include: {
            plan: true
          },
          orderBy: {
            createdAt: 'desc'
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
            OR: [
              {
                sessions: {
                  none: {}
                }
              },
              {
                sessions: {
                  none: {
                    createdAt: {
                      gte: inactiveThreshold
                    }
                  }
                }
              }
            ]
          }
        ]
      }
    });

    // Format the response
    const formattedUsers = inactiveUsers.map(user => {
      const lastSession = user.sessions[0];
      const lastActivity = lastSession?.createdAt || user.createdAt;
      const daysSinceActivity = Math.floor((new Date().getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
      const subscription = user.subscriptions[0];

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        lastActivity,
        daysSinceActivity,
        hasActiveSubscription: !!subscription,
        subscriptionType: subscription?.plan?.planType || null,
        isTrial: subscription?.isTrial || false,
        userType: user.signUpType,
        registeredAt: user.createdAt,
        hasNeverLoggedIn: !lastSession
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
        daysInactive
      }
    }));

  } catch (error) {
    console.error('Error fetching inactive users:', error);
    return Response.json(
      { error: 'Failed to fetch inactive users' },
      { status: 500 }
    );
  }
}