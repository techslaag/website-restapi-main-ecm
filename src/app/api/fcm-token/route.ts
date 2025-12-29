import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/fcm-token
 * Register or update FCM token for a user
 *
 * Request body:
 * {
 *   "userId": "string",
 *   "fcmToken": "string",
 *   "deviceId": "string" (optional),
 *   "platform": "ios" | "android" | "web" (optional),
 *   "appVersion": "string" (optional)
 * }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId, fcmToken, deviceId, platform, appVersion } = body;

        // Validate required fields
        if (!userId || !fcmToken) {
            return NextResponse.json(
                {
                    success: false,
                    error: "userId and fcmToken are required"
                },
                { status: 400 }
            );
        }

        // Validate token format (FCM tokens are typically long strings)
        if (fcmToken.length < 20) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid FCM token format"
                },
                { status: 400 }
            );
        }

        const now = new Date();

        // Try to use the dedicated FcmToken model first
        try {
            // Check if this exact token already exists for this user
            const existingToken = await prisma.fcmToken.findFirst({
                where: {
                    userId,
                    token: fcmToken
                }
            });

            if (existingToken) {
                // Update existing token's lastUsedAt
                await prisma.fcmToken.update({
                    where: { id: existingToken.id },
                    data: {
                        lastUsed: now,
                        deviceId: deviceId || existingToken.deviceId,
                        platform: platform || existingToken.platform,
                        isActive: true
                    }
                });

                return NextResponse.json({
                    success: true,
                    message: "FCM token updated successfully"
                });
            }

            // If token exists for another user, update it to the new user
            const tokenForOtherUser = await prisma.fcmToken.findFirst({
                where: { token: fcmToken }
            });

            if (tokenForOtherUser) {
                await prisma.fcmToken.update({
                    where: { id: tokenForOtherUser.id },
                    data: {
                        userId,
                        lastUsed: now,
                        deviceId: deviceId || tokenForOtherUser.deviceId,
                        platform: platform || tokenForOtherUser.platform,
                        appVersion: appVersion || tokenForOtherUser.appVersion,
                        isActive: true
                    }
                });

                return NextResponse.json({
                    success: true,
                    message: "FCM token reassigned successfully"
                });
            }

            // Create new token entry
            await prisma.fcmToken.create({
                data: {
                    userId,
                    token: fcmToken,
                    deviceId: deviceId || null,
                    platform: platform || null,
                    appVersion: appVersion || null,
                    lastUsed: now
                }
            });

            return NextResponse.json({
                success: true,
                message: "FCM token registered successfully"
            });

        } catch (fcmError) {
            // If FcmToken model doesn't exist yet, fall back to Preference model
            console.log("FcmToken model not available, using Preference model:", fcmError);

            const existing = await prisma.preference.findUnique({
                where: { userId }
            });

            if (existing) {
                await prisma.preference.update({
                    where: { userId },
                    data: { fcmToken }
                });
            } else {
                await prisma.preference.create({
                    data: {
                        userId,
                        fcmToken,
                        categories: "[]"
                    }
                });
            }

            return NextResponse.json({
                success: true,
                message: "FCM token registered successfully (fallback)"
            });
        }

    } catch (error) {
        console.error("Error registering FCM token:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Server error",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/fcm-token
 * Get FCM tokens for a user
 *
 * Query params:
 * - userId: string
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "userId is required"
                },
                { status: 400 }
            );
        }

        // Try FcmToken model first
        try {
            const tokens = await prisma.fcmToken.findMany({
                where: { 
                    userId,
                    isActive: true 
                },
                select: {
                    id: true,
                    token: true,
                    deviceId: true,
                    platform: true,
                    appVersion: true,
                    isActive: true,
                    createdAt: true,
                    lastUsed: true
                },
                orderBy: { lastUsed: 'desc' }
            });

            return NextResponse.json({
                success: true,
                data: {
                    userId,
                    tokens,
                    count: tokens.length
                }
            });
        } catch (fcmError) {
            // Fallback to Preference model
            const preference = await prisma.preference.findUnique({
                where: { userId },
                select: {
                    userId: true,
                    fcmToken: true
                }
            });

            if (!preference) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "User not found"
                    },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                data: {
                    userId: preference.userId,
                    tokens: preference.fcmToken ? [{ token: preference.fcmToken }] : [],
                    count: preference.fcmToken ? 1 : 0
                }
            });
        }
    } catch (error) {
        console.error("Error fetching FCM token:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Server error"
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/fcm-token
 * Update/refresh FCM token for a user (when Firebase refreshes the token)
 *
 * Request body:
 * {
 *   "userId": "string",
 *   "fcmToken": "string" (new token),
 *   "oldToken": "string" (optional - previous token to replace),
 *   "deviceId": "string" (optional),
 *   "platform": "ios" | "android" | "web" (optional),
 *   "appVersion": "string" (optional)
 * }
 */
export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { userId, fcmToken, oldToken, deviceId, platform, appVersion } = body;

        // Validate required fields
        if (!userId || !fcmToken) {
            return NextResponse.json(
                {
                    success: false,
                    error: "userId and fcmToken are required"
                },
                { status: 400 }
            );
        }

        // Validate token format
        if (fcmToken.length < 20) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid FCM token format"
                },
                { status: 400 }
            );
        }

        const now = new Date();

        // Try to use the dedicated FcmToken model first
        try {
            // If old token is provided, find and update it
            if (oldToken) {
                const existingToken = await prisma.fcmToken.findFirst({
                    where: {
                        userId,
                        token: oldToken
                    }
                });

                if (existingToken) {
                    // Update the old token with the new one
                    await prisma.fcmToken.update({
                        where: { id: existingToken.id },
                        data: {
                            token: fcmToken,
                            lastUsed: now,
                            deviceId: deviceId || existingToken.deviceId,
                            platform: platform || existingToken.platform,
                            appVersion: appVersion || existingToken.appVersion,
                            isActive: true
                        }
                    });

                    console.log(`FCM token refreshed for user ${userId}: ${oldToken.substring(0, 20)}... -> ${fcmToken.substring(0, 20)}...`);

                    return NextResponse.json({
                        success: true,
                        message: "FCM token refreshed successfully"
                    });
                }
            }

            // If no old token or old token not found, check if new token already exists
            const existingNewToken = await prisma.fcmToken.findFirst({
                where: {
                    userId,
                    token: fcmToken
                }
            });

            if (existingNewToken) {
                // Just update lastUsedAt
                await prisma.fcmToken.update({
                    where: { id: existingNewToken.id },
                    data: {
                        lastUsed: now,
                        deviceId: deviceId || existingNewToken.deviceId,
                        platform: platform || existingNewToken.platform,
                        appVersion: appVersion || existingNewToken.appVersion,
                        isActive: true
                    }
                });

                return NextResponse.json({
                    success: true,
                    message: "FCM token already exists, updated lastUsedAt"
                });
            }

            // Create new token entry if nothing found
            await prisma.fcmToken.create({
                data: {
                    userId,
                    token: fcmToken,
                    deviceId: deviceId || null,
                    platform: platform || null,
                    appVersion: appVersion || null,
                    lastUsed: now
                }
            });

            return NextResponse.json({
                success: true,
                message: "FCM token registered as new (old token not found)"
            });

        } catch (fcmError) {
            // Fallback to Preference model
            console.log("FcmToken model not available, using Preference model:", fcmError);

            const existing = await prisma.preference.findUnique({
                where: { userId }
            });

            if (existing) {
                await prisma.preference.update({
                    where: { userId },
                    data: { fcmToken }
                });
            } else {
                await prisma.preference.create({
                    data: {
                        userId,
                        fcmToken,
                        categories: "[]"
                    }
                });
            }

            return NextResponse.json({
                success: true,
                message: "FCM token updated successfully (fallback)"
            });
        }

    } catch (error) {
        console.error("Error updating FCM token:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Server error",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/fcm-token
 * Remove FCM token for a user (for logout/unsubscribe)
 *
 * Request body:
 * {
 *   "userId": "string",
 *   "fcmToken": "string" (optional - if not provided, removes all tokens for user)
 * }
 */
export async function DELETE(req: Request) {
    try {
        const body = await req.json();
        const { userId, fcmToken } = body;

        if (!userId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "userId is required"
                },
                { status: 400 }
            );
        }

        // Try FcmToken model first
        try {
            if (fcmToken) {
                // Delete specific token
                await prisma.fcmToken.deleteMany({
                    where: {
                        userId,
                        token: fcmToken
                    }
                });

                return NextResponse.json({
                    success: true,
                    message: "FCM token removed successfully"
                });
            } else {
                // Delete all tokens for user
                const result = await prisma.fcmToken.deleteMany({
                    where: { userId }
                });

                return NextResponse.json({
                    success: true,
                    message: `Removed ${result.count} FCM token(s) for user`
                });
            }
        } catch (fcmError) {
            // Fallback to Preference model
            const existing = await prisma.preference.findUnique({
                where: { userId }
            });

            if (existing) {
                await prisma.preference.update({
                    where: { userId },
                    data: { fcmToken: null }
                });
            }

            return NextResponse.json({
                success: true,
                message: "FCM token removed successfully (fallback)"
            });
        }
    } catch (error) {
        console.error("Error removing FCM token:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Server error"
            },
            { status: 500 }
        );
    }
}
