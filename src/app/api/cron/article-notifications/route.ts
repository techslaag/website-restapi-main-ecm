import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendNotification, sendMulticast, validateFcmToken, type NotificationPayload, NOTIFICATION_TYPES } from "@/lib/notifications/fcmService";

export const dynamic = "force-dynamic";
export const maxDuration = 1800; // 30 minutes (1800 seconds)

interface UserWithInterestsAndTokens {
  id: string;
  email: string | null;
  name: string | null;
  userInterests: {
    interestId: string;
    interest: {
      id: string;
      name: string;
      slug: string;
      categoryId: bigint | null;
    };
  }[];
  fcmTokens: {
    id: string;
    token: string;
    platform: string;
    isActive: boolean;
  }[];
}

interface NewArticle {
  ID: bigint;
  post_title: string;
  post_excerpt: string;
  post_name: string;
  post_date: Date | null;
  post_content: string;
  termRelationships: {
    term_taxonomy_id: bigint;
    taxonomy: {
      taxonomy: string;
      term_id: bigint;
      term: {
        name: string;
        slug: string;
      };
    };
  }[];
}

// Function to extract featured image from post content or meta
function extractFeaturedImage(postContent: string): string | undefined {
  // Look for first image in post content
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/i;
  const match = postContent.match(imgRegex);
  return match ? match[1] : undefined;
}

// Function to check if user is interested in article based on exact slug matching
function isUserInterestedInArticle(
  userInterests: { 
    interestId: string; 
    interest: { 
      id: string;
      name: string;
      slug: string;
      categoryId: bigint | null;
    };
  }[],
  articleCategories: { 
    term_taxonomy_id: bigint;
    taxonomy: {
      taxonomy: string;
      term: {
        name: string;
        slug: string;
      };
    };
  }[]
): boolean {
  if (userInterests.length === 0 || articleCategories.length === 0) {
    return false;
  }

  // Get article category slugs (no normalization - strict matching)
  const articleCategorySlugs = articleCategories
    .filter(ac => ac.taxonomy.taxonomy === 'category')
    .map(ac => ac.taxonomy.term.slug);

  // Get user interest slugs (no null check needed since we filtered them out)
  const userInterestSlugs = userInterests.map(ui => ui.interest.slug);
  
  // Check for exact slug matches only
  const hasMatch = userInterestSlugs.some(userSlug => 
    articleCategorySlugs.includes(userSlug)
  );

  if (hasMatch) {
    console.log(`[ArticleNotifications] Exact slug match found!`);
    console.log(`  - User interests: ${userInterestSlugs.join(', ')}`);
    console.log(`  - Article categories: ${articleCategorySlugs.join(', ')}`);
  }

  return hasMatch;
}

// Function to create notification payload from article
function createNotificationPayload(article: NewArticle): NotificationPayload {
  const featuredImage = extractFeaturedImage(article.post_content);
  
  return {
    title: article.post_title,
    body: article.post_excerpt || `Nouvel article disponible sur EcoMatin`,
    imageUrl: featuredImage,
    articleId: String(article.ID),
    articleSlug: article.post_name,
    notification_type: NOTIFICATION_TYPES.NEW_ARTICLE,
    data: {
      postDate: article.post_date?.toISOString() || new Date().toISOString(),
      categories: article.termRelationships
        .filter(tr => tr.taxonomy.taxonomy === 'category')
        .map(tr => tr.taxonomy.term.name)
        .join(', ')
    }
  };
}

/**
 * Cron job to send article notifications to users based on their interests
 * Processes today's articles and sends notifications to users with matching interests
 */
export async function POST(request: Request) {
  try {
    console.log('[ArticleNotifications] Starting cron job...');
    
    // Get current date (today only, not a range)
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Allow custom date for testing
    const url = new URL(request.url);
    const customDate = url.searchParams.get('date'); // Format: YYYY-MM-DD
    
    const targetDate = customDate || currentDate;
    
    console.log(`[ArticleNotifications] Processing articles for date: ${targetDate}`);

    // Find articles published on the target date (using DATE() function to match exact date)
    const todayArticles = await prisma.mod180_posts.findMany({
      where: {
        post_status: 'publish',
        post_type: 'post',
        archived: false,
        AND: [
          {
            post_date: {
              gte: new Date(`${targetDate}T00:00:00.000Z`)
            }
          },
          {
            post_date: {
              lt: new Date(`${targetDate}T23:59:59.999Z`)
            }
          }
        ]
      },
      include: {
        termRelationships: {
          include: {
            taxonomy: {
              include: {
                term: true
              }
            }
          }
        }
      },
      orderBy: {
        post_date: 'desc'
      }
    });

    console.log(`[ArticleNotifications] Found ${todayArticles.length} articles for ${targetDate}`);

    if (todayArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No articles found for ${targetDate}`,
        processed: 0,
        sent: 0,
        date: targetDate
      });
    }

    // Filter out articles that have already been processed (any notification sent for this article)
    const processedArticleIds = await prisma.articleNotification.findMany({
      where: {
        articleId: {
          in: todayArticles.map(article => article.ID)
        }
      },
      select: {
        articleId: true
      },
      distinct: ['articleId']
    });

    const processedIds = new Set(processedArticleIds.map(p => p.articleId));
    const unprocessedArticles = todayArticles.filter(article => !processedIds.has(article.ID));

    console.log(`[ArticleNotifications] ${processedArticleIds.length} articles already processed, ${unprocessedArticles.length} new articles to process`);

    if (unprocessedArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: `All ${todayArticles.length} articles for ${targetDate} have already been processed`,
        processed: 0,
        sent: 0,
        date: targetDate,
        alreadyProcessed: todayArticles.length
      });
    }

    // Get users with their interests and active FCM tokens
    const usersWithData = await prisma.user.findMany({
      include: {
        userInterests: {
          include: {
            interest: {
              select: {
                id: true,
                name: true,
                slug: true,
                categoryId: true
              }
            }
          }
        },
        fcmTokens: {
          where: {
            isActive: true
          },
          select: {
            id: true,
            token: true,
            platform: true,
            isActive: true
          }
        }
      },
      where: {
        fcmTokens: {
          some: {
            isActive: true
          }
        },
        userInterests: {
          some: {}
        }
      }
    }) as unknown as UserWithInterestsAndTokens[];

    console.log(`[ArticleNotifications] Found ${usersWithData.length} users with valid interests and FCM tokens`);

    let totalNotificationsSent = 0;
    let totalUsersProcessed = 0;
    

    // Process each unprocessed article
    for (const article of unprocessedArticles) {
      console.log(`[ArticleNotifications] Processing article: ${article.post_title}`);
      
      const articleCategories = article.termRelationships.filter(
        tr => tr.taxonomy.taxonomy === 'category'
      );


      if (articleCategories.length === 0) {
        console.log(`[ArticleNotifications] Article has no categories, skipping`);
        continue;
      }

      const notificationPayload = createNotificationPayload(article);
      let usersNotifiedForThisArticle = 0;

      // Process each user
      for (const user of usersWithData) {
        try {
          // Check if this user already has notifications for this article
          // If any FCM token has been processed, skip the entire user to avoid partial re-processing
          const existingNotifications = await prisma.articleNotification.findMany({
            where: {
              userId: user.id,
              articleId: article.ID
            }
          });

          if (existingNotifications.length > 0) {
            console.log(`[ArticleNotifications] User ${user.email || user.id} already has ${existingNotifications.length} notification records for article ${article.ID}`);
            continue; // Skip if already notified
          }

          // Check if user is interested in this article
          if (!isUserInterestedInArticle(user.userInterests, articleCategories)) {
            continue; // Skip if not interested
          }

          console.log(`[ArticleNotifications] Sending notification to user: ${user.email || user.id}`);

          // Get active FCM tokens for this user
          const activeFcmTokens = user.fcmTokens.filter(token => token.isActive);

          if (activeFcmTokens.length === 0) {
            continue; // Skip if no active tokens
          }

          // Send notification to ALL user's devices
          let notificationSent = false;
          let successfulSends = 0;
          
          // Send notification to each FCM token and log individually
          for (let tokenIndex = 0; tokenIndex < activeFcmTokens.length; tokenIndex++) {
            const fcmToken = activeFcmTokens[tokenIndex];
            
            try {
              console.log(`[ArticleNotifications] Validating ${fcmToken.platform} token ${tokenIndex + 1}/${activeFcmTokens.length} for ${user.email || user.id}`);
              
              // First, validate the FCM token
              const isTokenValid = await validateFcmToken(fcmToken.token);
              
              if (!isTokenValid) {
                console.log(`[ArticleNotifications] ❌ Invalid token for ${user.email || user.id} on ${fcmToken.platform}, marking as inactive`);
                
                // Mark token as inactive in database
                await prisma.fcmToken.update({
                  where: { id: fcmToken.id },
                  data: { isActive: false }
                });
                
                // Create ArticleNotification record for the invalid token
                await prisma.articleNotification.create({
                  data: {
                    userId: user.id,
                    articleId: article.ID,
                    fcmTokenId: fcmToken.id,
                    success: false,
                    errorMessage: 'FCM token validation failed - token marked as inactive'
                  }
                });
                
                continue; // Skip to next token
              }
              
              console.log(`[ArticleNotifications] ✅ Token valid, sending to ${fcmToken.platform} token ${tokenIndex + 1}/${activeFcmTokens.length} for ${user.email || user.id}`);
              
              const result = await sendNotification(fcmToken.token, notificationPayload);
              
              // Create individual ArticleNotification record for this FCM token
              await prisma.articleNotification.create({
                data: {
                  userId: user.id,
                  articleId: article.ID,
                  fcmTokenId: fcmToken.id,
                  success: result.success,
                  errorMessage: result.error || null
                }
              });
              
              if (result.success) {
                successfulSends++;
                totalNotificationsSent++;
                notificationSent = true;
                console.log(`[ArticleNotifications] ✅ Successfully sent to ${user.email || user.id} on ${fcmToken.platform} (${tokenIndex + 1}/${activeFcmTokens.length})`);
              } else {
                console.log(`[ArticleNotifications] ❌ Failed to send to ${user.email || user.id} on ${fcmToken.platform}: ${result.error}`);
                
                // If token is invalid, mark it as inactive
                if (result.error?.includes('token') || result.error?.includes('registration')) {
                  await prisma.fcmToken.update({
                    where: { id: fcmToken.id },
                    data: { isActive: false }
                  });
                  console.log(`[ArticleNotifications] Marked FCM token as inactive for ${user.email || user.id}`);
                }
              }
            } catch (error) {
              console.error(`[ArticleNotifications] Error processing ${user.email || user.id} on ${fcmToken.platform}:`, error);
              
              // Create failed ArticleNotification record
              try {
                await prisma.articleNotification.create({
                  data: {
                    userId: user.id,
                    articleId: article.ID,
                    fcmTokenId: fcmToken.id,
                    success: false,
                    errorMessage: error instanceof Error ? error.message : 'Unknown error'
                  }
                });
              } catch (dbError) {
                console.error(`[ArticleNotifications] Failed to create error record:`, dbError);
              }
            }
          }
          
          console.log(`[ArticleNotifications] Sent to ${successfulSends}/${activeFcmTokens.length} tokens for ${user.email || user.id}`);

          if (notificationSent) {
            usersNotifiedForThisArticle++;
          }

        } catch (error) {
          console.error(`[ArticleNotifications] Error processing user ${user.email || user.id}:`, error);
        }
      }

      console.log(`[ArticleNotifications] Article "${article.post_title}" sent to ${usersNotifiedForThisArticle} users`);
      totalUsersProcessed++;
    }

    const result = {
      success: true,
      message: `Processed ${unprocessedArticles.length} new articles for ${targetDate}`,
      date: targetDate,
      totalArticlesFound: todayArticles.length,
      alreadyProcessedArticles: processedArticleIds.length,
      newArticlesProcessed: unprocessedArticles.length,
      notificationsSent: totalNotificationsSent,
      articlesWithNotificationsSent: totalUsersProcessed
    };

    console.log('[ArticleNotifications] Cron job completed:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[ArticleNotifications] Cron job failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for manual testing
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const testMode = url.searchParams.get('test') === 'true';
    
    if (!testMode) {
      return NextResponse.json(
        { error: 'Use POST method for cron job execution' },
        { status: 405 }
      );
    }

    // Test mode - show stats without sending notifications
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    const todayArticlesCount = await prisma.mod180_posts.count({
      where: {
        post_status: 'publish',
        post_type: 'post',
        archived: false,
        AND: [
          {
            post_date: {
              gte: new Date(`${currentDate}T00:00:00.000Z`)
            }
          },
          {
            post_date: {
              lt: new Date(`${currentDate}T23:59:59.999Z`)
            }
          }
        ]
      }
    });

    // Get unique article IDs that have been processed today
    const processedTodayArticles = await prisma.articleNotification.findMany({
      where: {
        article: {
          post_date: {
            gte: new Date(`${currentDate}T00:00:00.000Z`),
            lt: new Date(`${currentDate}T23:59:59.999Z`)
          }
        }
      },
      select: {
        articleId: true
      },
      distinct: ['articleId']
    });
    
    const processedTodayCount = processedTodayArticles.length;

    const usersWithTokens = await prisma.user.count({
      where: {
        fcmTokens: {
          some: {
            isActive: true
          }
        },
        userInterests: {
          some: {}
        }
      }
    });

    const totalFcmTokens = await prisma.fcmToken.count({
      where: {
        isActive: true
      }
    });

    return NextResponse.json({
      testMode: true,
      date: currentDate,
      stats: {
        todayArticles: todayArticlesCount,
        alreadyProcessedToday: processedTodayCount,
        unprocessedArticles: todayArticlesCount - processedTodayCount,
        usersWithTokensAndInterests: usersWithTokens,
        totalActiveFcmTokens: totalFcmTokens
      },
      message: 'Use POST to execute the cron job for today\'s articles'
    });

  } catch (error) {
    console.error('[ArticleNotifications] Test mode failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/cron/article-notifications:
 *   post:
 *     summary: Send push notifications for today's articles based on user interests
 *     description: Processes all articles published today and sends push notifications to users with matching interest slugs
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-15"
 *         description: Process articles for a specific date (YYYY-MM-DD format, defaults to today)
 *     responses:
 *       200:
 *         description: Notifications processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 articlesProcessed:
 *                   type: integer
 *                 notificationsSent:
 *                   type: integer
 *                 dateProcessed:
 *                   type: object
 *                   properties:
 *                     from:
 *                       type: string
 *                     to:
 *                       type: string
 *                     totalArticles:
 *                       type: integer
 *       500:
 *         description: Server error
 *   get:
 *     summary: Test endpoint to view today's notification stats
 *     parameters:
 *       - in: query
 *         name: test
 *         schema:
 *           type: boolean
 *         description: Must be true to enable test mode
 *     responses:
 *       200:
 *         description: Test stats for today's articles
 *       405:
 *         description: Method not allowed without test=true
 */