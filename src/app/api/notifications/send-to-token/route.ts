import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebaseAdmin";
import { requireAdminAuth } from "@/lib/middleware/auth";
import { logNotificationActivity } from "@/lib/utils/logging";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let requestId = `token_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    // Authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.success) {
      await logNotificationActivity({
        requestId,
        action: 'send_to_token',
        userId: null,
        status: 'unauthorized',
        error: authResult.error,
        metadata: { ip: 'unknown' }
      });
      
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const { 
      fcmToken,
      title, 
      message,
      type = 'manual',
      notification_type = 'new_article',
      route = '',
      data = {}
    } = await request.json();

    // Validation
    if (!fcmToken?.trim()) {
      return NextResponse.json(
        { error: "FCM token is required" },
        { status: 400 }
      );
    }

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Prepare enhanced notification payload
    const payload = {
      notification: {
        title: title,
        body: message,
      },
      data: {
        requestId,
        notification_type: notification_type,
        route: route,
        type: type,
        timestamp: new Date().toISOString(),
        click_action: route ? `FLUTTER_NOTIFICATION_CLICK_${route}` : 'FLUTTER_NOTIFICATION_CLICK',
        ...data
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: notification_type,
          priority: 'high' as const
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: title,
              body: message
            },
            badge: 1,
            sound: 'default'
          }
        }
      }
    };

    // Send notification
    const response = await admin.messaging().send({
      token: fcmToken,
      notification: payload.notification,
      data: payload.data,
      android: payload.android,
      apns: payload.apns
    });

    const result = {
      fcmToken: fcmToken.substring(0, 20) + '...',
      successCount: 1,
      failureCount: 0,
      type: type,
      notification_type: notification_type,
      route: route,
      messageId: response,
      timestamp: new Date().toISOString()
    };

    // Log successful operation
    await logNotificationActivity({
      requestId,
      action: 'send_to_token',
      userId: authResult.user.id,
      status: 'success',
      metadata: {
        fcmToken: fcmToken.substring(0, 20) + '...',
        notification_type,
        route,
        responseTime: Date.now() - startTime
      }
    });

    return NextResponse.json({
      success: true,
      message: "Notification sent successfully to FCM token",
      result
    });

  } catch (error) {
    console.error("Send to token error:", error);
    
    await logNotificationActivity({
      requestId,
      action: 'send_to_token',
      userId: null,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: { responseTime: Date.now() - startTime }
    });

    // Handle specific Firebase errors
    if (error instanceof Error) {
      if (error.message.includes('registration-token-not-registered')) {
        return NextResponse.json({
          success: false,
          error: "FCM token is no longer valid or registered",
          result: {
            fcmToken: '',
            successCount: 0,
            failureCount: 1,
            type: 'manual',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      if (error.message.includes('invalid-registration-token')) {
        return NextResponse.json({
          success: false,
          error: "Invalid FCM token format",
          result: {
            fcmToken: '',
            successCount: 0,
            failureCount: 1,
            type: 'manual',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    return NextResponse.json(
      { 
        error: "Failed to send notification",
        requestId,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}