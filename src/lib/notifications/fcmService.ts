import admin from 'firebase-admin';

// Notification type constants
export const NOTIFICATION_TYPES = {
  NEW_ARTICLE: 'new_article',
  ANNOUNCEMENT: 'announcement',
  REMINDER: 'reminder',
  PROMOTIONAL: 'promotional',
  SYSTEM: 'system',
  UPDATE: 'update'
} as const;

export type NotificationTypeValue = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

// Validation function for notification types
export function isValidNotificationType(type: string): type is NotificationTypeValue {
  return Object.values(NOTIFICATION_TYPES).includes(type as NotificationTypeValue);
}

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    // Initialize with service account key from environment variables
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
  }
}

export interface NotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  data?: { [key: string]: string };
  articleId: string;
  articleSlug: string;
  notification_type: NotificationTypeValue;
}

export interface SendNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send push notification via FCM
 */
export async function sendNotification(
  fcmToken: string,
  payload: NotificationPayload
): Promise<SendNotificationResult> {
  try {
    if (!admin.apps.length) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: {
        articleId: payload.articleId,
        articleSlug: payload.articleSlug,
        notification_type: payload.notification_type,
        timestamp: new Date().toISOString(),
        ...payload.data,
      },
      android: {
        notification: {
          channelId: 'article_notifications',
          priority: 'high' as const,
          defaultSound: true,
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
        data: {
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
            category: 'ARTICLE_NOTIFICATION',
          },
        },
      },
      webpush: {
        notification: {
          icon: '/logo-192x192.png',
          badge: '/badge-72x72.png',
          requireInteraction: true,
          actions: [
            {
              action: 'view',
              title: 'Lire l\'article',
            },
          ],
        },
        fcmOptions: {
          link: `/articles/${payload.articleSlug}`,
        },
      },
    };

    const response = await admin.messaging().send(message);
    
    console.log('Successfully sent message:', response);
    
    return {
      success: true,
      messageId: response,
    };
  } catch (error: any) {
    console.error('Error sending message:', error);
    
    // Handle specific FCM errors
    let errorMessage = error.message;
    if (error.code === 'messaging/registration-token-not-registered') {
      errorMessage = 'FCM token is no longer valid';
    } else if (error.code === 'messaging/invalid-registration-token') {
      errorMessage = 'FCM token is invalid';
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send notifications to multiple tokens (batch)
 */
export async function sendMulticast(
  fcmTokens: string[],
  payload: NotificationPayload
): Promise<{ success: number; failure: number; results: SendNotificationResult[] }> {
  try {
    if (!admin.apps.length) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    if (fcmTokens.length === 0) {
      return { success: 0, failure: 0, results: [] };
    }

    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: {
        articleId: payload.articleId,
        articleSlug: payload.articleSlug,
        notification_type: payload.notification_type,
        timestamp: new Date().toISOString(),
        ...payload.data,
      },
      android: {
        notification: {
          channelId: 'article_notifications',
          priority: 'high' as const,
          defaultSound: true,
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
            category: 'ARTICLE_NOTIFICATION',
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`Multicast result: ${response.successCount}/${fcmTokens.length} successful`);
    
    const results: SendNotificationResult[] = response.responses.map((resp) => {
      if (resp.success) {
        return {
          success: true,
          messageId: resp.messageId,
        };
      } else {
        return {
          success: false,
          error: resp.error?.message || 'Unknown error',
        };
      }
    });

    return {
      success: response.successCount,
      failure: response.failureCount,
      results,
    };
  } catch (error: any) {
    console.error('Error sending multicast:', error);
    
    // Return failure for all tokens
    const results: SendNotificationResult[] = fcmTokens.map(() => ({
      success: false,
      error: error.message,
    }));

    return {
      success: 0,
      failure: fcmTokens.length,
      results,
    };
  }
}

/**
 * Validate if an FCM token is still valid
 */
export async function validateFcmToken(fcmToken: string): Promise<boolean> {
  try {
    if (!admin.apps.length) {
      return false;
    }

    // Send a dry run message to check if token is valid
    const testMessage: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: 'Test',
        body: 'Test',
      },
    };

    await admin.messaging().send(testMessage, true); // dry run
    return true;
  } catch (error: any) {
    if (error.code === 'messaging/registration-token-not-registered' || 
        error.code === 'messaging/invalid-registration-token') {
      return false;
    }
    // For other errors, assume token is still valid
    return true;
  }
}