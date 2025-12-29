import { NextRequest } from 'next/server';
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const daysBack = Number(url.searchParams.get('daysBack') ?? 30);
    const offset = (page - 1) * limit;

    // Calculate date threshold for new users
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysBack);

    // Get users created after the threshold date
    const newUsers = await prisma.user.findMany({
      where: {
        AND: [
          {
            email: {
              not: null
            }
          },
          {
            createdAt: {
              gte: dateThreshold
            }
          }
        ]
      },
      include: {
        subscriptions: {
          include: {
            plan: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        },
        sessions: {
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
            createdAt: {
              gte: dateThreshold
            }
          }
        ]
      }
    });

    // Format the response
    const formattedUsers = newUsers.map(user => {
      const subscription = user.subscriptions[0];
      const lastSession = user.sessions[0];
      const daysSinceRegistration = Math.floor((new Date().getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        registeredAt: user.createdAt,
        daysSinceRegistration,
        signUpType: user.signUpType,
        hasActiveSubscription: !!subscription,
        subscriptionType: subscription?.plan?.planType || null,
        isTrial: subscription?.isTrial || false,
        hasLoggedIn: !!lastSession,
        lastLoginAt: lastSession?.createdAt || null,
        provider: user.provider
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
        daysBack
      }
    }));

  } catch (error) {
    console.error('Error fetching new users:', error);
    return Response.json(
      { error: 'Failed to fetch new users' },
      { status: 500 }
    );
  }
}