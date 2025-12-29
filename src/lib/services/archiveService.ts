import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { User } from '@prisma/client';
import { hasActiveSubscription } from '@/lib/utils/subscriptionUtils';
import { TagUtils } from '@/lib/utils/tagUtils';

export class ArchiveService {
  
  /**
   * Get archive filter for posts based on user subscription status
   * @param user - The user object (null for anonymous users)
   * @returns Promise with the appropriate filter condition
   */
  static async getArchiveFilterForUser(user: User | null): Promise<string> {
    // If user has active subscription (ecomembre), they can see archived posts
    if (user && await hasActiveSubscription(user)) {
      return '1=1'; // No archive filtering - show all posts including archived
    }
    
    // For non-subscribers, exclude archived posts
    return 'NOT (archived = TRUE AND archivedAt IS NOT NULL)';
  }

  /**
   * Archive posts older than specified number of days
   * @param olderThanDays - Number of days old posts should be to be archived
   * @param setAsExclusivity - Whether to automatically set archived posts as "ecomembre" with price 5
   * @param addArchiveTag - Whether to automatically add "Archive" tag to archived posts
   * @returns Promise with count of archived posts
   */
  static async archiveOldPosts(olderThanDays: number = 30, setAsExclusivity: boolean = true, addArchiveTag: boolean = true): Promise<{ count: number; posts: string[] }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    try {
      // Use raw SQL to work with current Prisma client that doesn't know about archive fields
      // Posts are considered archived ONLY if archived = TRUE AND archivedAt IS NOT NULL
      // Exclude opinion posts and promotional content posts from normal archive process
      const postsToArchive = await prisma.$queryRaw`
        SELECT ID, post_title, post_date_gmt 
        FROM mod180_posts 
        WHERE post_type = 'post' 
        AND post_status = 'publish'
        AND NOT (archived = TRUE AND archivedAt IS NOT NULL)
        AND post_date_gmt < ${cutoffDate}
        AND post_type != 'opinion'
        AND NOT (
          post_content LIKE '%[PUBLIREDACTIONNEL]%' OR
          post_content LIKE '%[Publirédactionnel]%' OR
          post_content LIKE '%[PUBLIREPORTAGE]%' OR
          post_excerpt LIKE '%[PUBLIREDACTIONNEL]%' OR
          post_excerpt LIKE '%[Publirédactionnel]%' OR
          post_excerpt LIKE '%[PUBLIREPORTAGE]%' OR
          post_title LIKE '%[PUBLIREDACTIONNEL]%' OR
          post_title LIKE '%[Publirédactionnel]%' OR
          post_title LIKE '%[PUBLIREPORTAGE]%'
        )
        LIMIT 1000
      `;

      if (!Array.isArray(postsToArchive) || postsToArchive.length === 0) {
        return { count: 0, posts: [] };
      }

      console.log(`Found ${postsToArchive.length} posts to archive (limited to 1000 for performance)`);

      // Archive the posts using raw SQL in batches with transaction for each batch
      const batchSize = 50; // Smaller batch size for better performance and timeout safety
      let totalArchived = 0;

      for (let i = 0; i < postsToArchive.length; i += batchSize) {
        const batch = postsToArchive.slice(i, i + batchSize);
        const ids = batch.map(post => post.ID);
        
        // Progress logging for long operations
        if (i % (batchSize * 10) === 0) {
          console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(postsToArchive.length/batchSize)} - archived ${totalArchived} posts so far`);
        }
        
        await prisma.$transaction(async (tx) => {
          // Archive the posts
          const result = await tx.$executeRaw`
            UPDATE mod180_posts 
            SET archived = TRUE, archivedAt = NOW() 
            WHERE ID IN (${Prisma.join(ids)})
          `;
          
          totalArchived += Number(result);

          // Set free posts as premium content, preserve existing premium/ecomembre posts
          if (setAsExclusivity && ids.length > 0) {
            // Only update posts that are currently free (no post_prestige or post_prestige = 'gratuit')
            // This preserves existing premium/ecomembre posts
            await tx.$executeRaw`
              UPDATE mod180_postmeta 
              SET meta_value = 'ecomembre' 
              WHERE post_id IN (${Prisma.join(ids)}) 
              AND meta_key = 'post_prestige'
              AND (meta_value = 'gratuit' OR meta_value = '' OR meta_value IS NULL)
            `;

            // Insert post_prestige = ecomembre for posts that don't have this meta (making them premium)
            await tx.$executeRaw`
              INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
              SELECT ID, 'post_prestige', 'ecomembre'
              FROM mod180_posts 
              WHERE ID IN (${Prisma.join(ids)})
              AND ID NOT IN (
                SELECT post_id 
                FROM mod180_postmeta 
                WHERE meta_key = 'post_prestige' 
                AND post_id IN (${Prisma.join(ids)})
              )
            `;

            // Only update prix for posts that are currently free or don't have pricing
            // This preserves existing premium/ecomembre pricing
            await tx.$executeRaw`
              UPDATE mod180_postmeta 
              SET meta_value = '5' 
              WHERE post_id IN (${Prisma.join(ids)}) 
              AND meta_key = 'prix'
              AND post_id IN (
                SELECT post_id FROM mod180_postmeta 
                WHERE meta_key = 'post_prestige' 
                AND (meta_value = 'gratuit' OR meta_value = '' OR meta_value IS NULL)
                AND post_id IN (${Prisma.join(ids)})
                UNION
                SELECT ID FROM mod180_posts
                WHERE ID IN (${Prisma.join(ids)})
                AND ID NOT IN (
                  SELECT post_id FROM mod180_postmeta 
                  WHERE meta_key = 'post_prestige'
                  AND post_id IN (${Prisma.join(ids)})
                )
              )
            `;

            // Insert prix = 5 for posts that don't have pricing and are now being made premium
            await tx.$executeRaw`
              INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
              SELECT ID, 'prix', '5'
              FROM mod180_posts 
              WHERE ID IN (${Prisma.join(ids)})
              AND ID NOT IN (
                SELECT post_id 
                FROM mod180_postmeta 
                WHERE meta_key = 'prix' 
                AND post_id IN (${Prisma.join(ids)})
              )
              AND (
                ID IN (
                  SELECT post_id FROM mod180_postmeta 
                  WHERE meta_key = 'post_prestige' 
                  AND (meta_value = 'gratuit' OR meta_value = '' OR meta_value IS NULL)
                  AND post_id IN (${Prisma.join(ids)})
                )
                OR ID NOT IN (
                  SELECT post_id FROM mod180_postmeta 
                  WHERE meta_key = 'post_prestige'
                  AND post_id IN (${Prisma.join(ids)})
                )
              )
            `;
          }
        }, {
          timeout: 60000 // 60 second timeout per batch
        });
      }

      // Add archive tags to all archived posts (outside transactions for safety)
      // Skip tagging for performance optimization in cron jobs
      if (addArchiveTag && totalArchived > 0 && totalArchived <= 100) {
        console.log(`Adding archive tags to ${totalArchived} archived posts (limited for performance)...`);
        let taggedCount = 0;
        for (const post of postsToArchive.slice(0, Math.min(totalArchived, 100))) {
          try {
            await TagUtils.addTagToPost(BigInt(post.ID), 'Archive');
            taggedCount++;
          } catch (tagError) {
            console.warn(`Failed to add archive tag to post ${post.ID}:`, tagError);
            // Continue with other posts even if one fails
          }
        }
        console.log(`Tagged ${taggedCount}/${totalArchived} posts with Archive tag`);
      } else if (addArchiveTag && totalArchived > 100) {
        console.log(`Skipping archive tagging for ${totalArchived} posts (too many for single operation - consider running separately)`);
      }

      return {
        count: totalArchived,
        posts: postsToArchive.slice(0, 10).map(post => `${post.post_title} (ID: ${post.ID})`)
      };
    } catch (error) {
      console.error('Error archiving old posts:', error);
      throw error;
    }
  }

  /**
   * Unarchive a specific post
   * @param postId - The ID of the post to unarchive
   * @param removeArchiveTag - Whether to remove the "Archive" tag when unarchiving
   * @returns Promise with the updated post
   */
  static async unarchivePost(postId: BigInt, removeArchiveTag: boolean = true): Promise<any> {
    // Use raw SQL to unarchive specific post
    // Only unarchive posts that are properly archived (archived = TRUE AND archivedAt IS NOT NULL)
    const result = await prisma.$executeRaw`
      UPDATE mod180_posts 
      SET archived = FALSE, archivedAt = NULL 
      WHERE ID = ${postId} 
      AND archived = TRUE 
      AND archivedAt IS NOT NULL
    `;
    
    if (Number(result) === 0) {
      throw new Error(`Post ${postId} not found or not properly archived`);
    }

    // Remove archive tag if requested
    if (removeArchiveTag) {
      try {
        await TagUtils.removeTagFromPost(postId as bigint, 'Archive');
      } catch (tagError) {
        console.warn('Failed to remove archive tag:', tagError);
        // Don't fail the entire operation if tag removal fails
      }
    }
    
    return { 
      ID: postId.toString(), // Convert BigInt to string for JSON serialization
      archived: false, 
      archiveTagRemoved: removeArchiveTag,
      updated: Number(result), 
      message: `Post unarchived successfully${removeArchiveTag ? ' and archive tag removed' : ''} (${result} rows affected)` 
    };
  }

  /**
   * Get archived posts with pagination
   * @param page - Page number (1-based)
   * @param limit - Number of posts per page
   * @returns Promise with archived posts and pagination info
   */
  static async getArchivedPosts(page: number = 1, limit: number = 25) {
    try {
      const skip = (page - 1) * limit;
      
      // Use raw SQL to get archived posts with prestige information
      // Posts are considered archived ONLY if archived = TRUE AND archivedAt IS NOT NULL
      // Only show published posts
      const posts = await prisma.$queryRaw`
        SELECT 
          p.ID, 
          p.post_title, 
          p.post_excerpt, 
          p.post_date_gmt, 
          p.archivedAt,
          u.display_name as author_display_name,
          pm_prestige.meta_value as postPrestige,
          pm_prix.meta_value as price
        FROM mod180_posts p
        LEFT JOIN mod180_users u ON p.post_author = u.ID
        LEFT JOIN mod180_postmeta pm_prestige ON p.ID = pm_prestige.post_id AND pm_prestige.meta_key = 'post_prestige'
        LEFT JOIN mod180_postmeta pm_prix ON p.ID = pm_prix.post_id AND pm_prix.meta_key = 'prix'
        WHERE p.post_type = 'post' 
        AND p.post_status = 'publish'
        AND p.archived = TRUE 
        AND p.archivedAt IS NOT NULL
        ORDER BY p.archivedAt DESC
        LIMIT ${limit} OFFSET ${skip}
      `;

      const totalCountResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM mod180_posts 
        WHERE post_type = 'post' 
        AND post_status = 'publish'
        AND archived = TRUE 
        AND archivedAt IS NOT NULL
      `;

      const totalCount = Array.isArray(totalCountResult) && totalCountResult[0] 
        ? Number(totalCountResult[0].count) 
        : 0;

      const totalPages = Math.ceil(totalCount / limit);

      // Format the posts to match the expected structure
      const formattedPosts = Array.isArray(posts) ? posts.map(post => ({
        ID: post.ID.toString(),
        post_title: post.post_title,
        post_excerpt: post.post_excerpt || '',
        post_date_gmt: post.post_date_gmt,
        archivedAt: post.archivedAt,
        postPrestige: post.postPrestige || 'gratuit',
        price: post.price || '0',
        author: {
          display_name: post.author_display_name || 'Unknown'
        }
      })) : [];

      return {
        posts: formattedPosts,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error getting archived posts:', error);
      throw error;
    }
  }

  /**
   * Archive a specific post manually
   * @param postId - The ID of the post to archive
   * @param setAsExclusivity - Whether to automatically set the post as "ecomembre" with price 5 when archived
   * @param addArchiveTag - Whether to automatically add an "Archive" tag when archived
   * @returns Promise with the updated post
   */
  static async archivePost(postId: BigInt, setAsExclusivity: boolean = true, addArchiveTag: boolean = true): Promise<any> {
    try {
      // Start a transaction to ensure all operations succeed or fail together
      const result = await prisma.$transaction(async (tx) => {
        // Archive the post (only if it's published and not excluded type)
        // Check if this post should be excluded from archiving
        const postCheck = await tx.$queryRaw`
          SELECT post_type, post_title, post_content, post_excerpt
          FROM mod180_posts 
          WHERE ID = ${postId}
          AND post_type = 'post'
          AND post_status = 'publish'
          AND NOT (archived = TRUE AND archivedAt IS NOT NULL)
        `;

        if (!Array.isArray(postCheck) || postCheck.length === 0) {
          throw new Error(`Post ${postId} not found, not published, or already properly archived`);
        }

        const post = postCheck[0];
        
        // Check for exclusions
        if (post.post_type === 'opinion') {
          throw new Error(`Post ${postId} is an opinion post and cannot be archived via normal archive process`);
        }

        const hasPromotionalContent = 
          (post.post_content && (
            post.post_content.includes('[PUBLIREDACTIONNEL]') ||
            post.post_content.includes('[Publirédactionnel]') ||
            post.post_content.includes('[PUBLIREPORTAGE]')
          )) ||
          (post.post_excerpt && (
            post.post_excerpt.includes('[PUBLIREDACTIONNEL]') ||
            post.post_excerpt.includes('[Publirédactionnel]') ||
            post.post_excerpt.includes('[PUBLIREPORTAGE]')
          )) ||
          (post.post_title && (
            post.post_title.includes('[PUBLIREDACTIONNEL]') ||
            post.post_title.includes('[Publirédactionnel]') ||
            post.post_title.includes('[PUBLIREPORTAGE]')
          ));

        if (hasPromotionalContent) {
          throw new Error(`Post ${postId} contains promotional content and cannot be archived via normal archive process`);
        }

        const archiveResult = await tx.$executeRaw`
          UPDATE mod180_posts 
          SET archived = TRUE, archivedAt = NOW() 
          WHERE ID = ${postId}
        `;

        // Set free posts as premium content, preserve existing premium/ecomembre posts
        if (setAsExclusivity) {
          // Check if post is currently free or has no prestige setting
          const currentPrestige = await tx.$queryRaw`
            SELECT meta_value FROM mod180_postmeta 
            WHERE post_id = ${postId} AND meta_key = 'post_prestige'
            LIMIT 1
          `;
          
          const prestigeValue = Array.isArray(currentPrestige) && currentPrestige[0] 
            ? currentPrestige[0].meta_value : null;
          
          // Only update if post is free or has no prestige setting
          if (!prestigeValue || prestigeValue === 'gratuit' || prestigeValue === '') {
            // Update existing post_prestige meta to ecomembre (only for free posts)
            const updateMetaResult = await tx.$executeRaw`
              UPDATE mod180_postmeta 
              SET meta_value = 'ecomembre' 
              WHERE post_id = ${postId} 
              AND meta_key = 'post_prestige'
              AND (meta_value = 'gratuit' OR meta_value = '' OR meta_value IS NULL)
            `;

            // If no existing meta was updated, insert new one
            if (Number(updateMetaResult) === 0) {
              await tx.$executeRaw`
                INSERT INTO mod180_postmeta (post_id, meta_key, meta_value) 
                VALUES (${postId}, 'post_prestige', 'ecomembre')
              `;
            }

            // Update existing prix metadata to 5 (only for posts being converted)
            const updatePrixResult = await tx.$executeRaw`
              UPDATE mod180_postmeta 
              SET meta_value = '5' 
              WHERE post_id = ${postId} 
              AND meta_key = 'prix'
            `;

            // If no existing prix meta was updated, insert new one
            if (Number(updatePrixResult) === 0) {
              await tx.$executeRaw`
                INSERT INTO mod180_postmeta (post_id, meta_key, meta_value) 
                VALUES (${postId}, 'prix', '5')
              `;
            }
          }
        }

        return archiveResult;
      });

      // Add archive tag outside the main transaction to avoid issues
      if (addArchiveTag) {
        try {
          await TagUtils.addTagToPost(postId as bigint, 'Archive');
        } catch (tagError) {
          console.warn('Failed to add archive tag:', tagError);
          // Don't fail the entire operation if tagging fails
        }
      }
      
      return { 
        ID: postId.toString(), // Convert BigInt to string for JSON serialization
        archived: true, 
        exclusivity: setAsExclusivity ? 'ecomembre' : null,
        prix: setAsExclusivity ? '5' : null,
        archiveTag: addArchiveTag ? 'Archive' : null,
        updated: Number(result),
        message: `Post archived successfully${setAsExclusivity ? ' and set as ecomembre with price 5' : ''}${addArchiveTag ? ' with archive tag' : ''} (${result} rows affected)` 
      };
    } catch (error) {
      console.error('Error archiving post:', error);
      throw error;
    }
  }

  /**
   * Archive ALL unarchived posts (regardless of age) - Admin only
   * @param setAsExclusivity - Whether to automatically set archived posts as "ecomembre" with price 5
   * @param addArchiveTag - Whether to automatically add "Archive" tag to archived posts
   * @param maxPosts - Maximum number of posts to archive in one operation (safety limit)
   * @returns Promise with count of archived posts
   */
  static async archiveAllPosts(setAsExclusivity: boolean = true, addArchiveTag: boolean = true, maxPosts: number = 50000): Promise<{ count: number; posts: string[] }> {
    try {
      console.log('[ArchiveService] Starting bulk archive operation for ALL unarchived posts...');
      
      // Get all unarchived posts (no date restriction)
      // Exclude opinion posts and promotional content posts from bulk archive process
      const postsToArchive = await prisma.$queryRaw`
        SELECT ID, post_title, post_date_gmt 
        FROM mod180_posts 
        WHERE post_type = 'post' 
        AND post_status = 'publish'
        AND NOT (archived = TRUE AND archivedAt IS NOT NULL)
        AND post_type != 'opinion'
        AND NOT (
          post_content LIKE '%[PUBLIREDACTIONNEL]%' OR
          post_content LIKE '%[Publirédactionnel]%' OR
          post_content LIKE '%[PUBLIREPORTAGE]%' OR
          post_excerpt LIKE '%[PUBLIREDACTIONNEL]%' OR
          post_excerpt LIKE '%[Publirédactionnel]%' OR
          post_excerpt LIKE '%[PUBLIREPORTAGE]%' OR
          post_title LIKE '%[PUBLIREDACTIONNEL]%' OR
          post_title LIKE '%[Publirédactionnel]%' OR
          post_title LIKE '%[PUBLIREPORTAGE]%'
        )
        LIMIT ${Math.min(maxPosts, 1000)}
      `;

      if (!Array.isArray(postsToArchive) || postsToArchive.length === 0) {
        console.log('[ArchiveService] No unarchived posts found');
        return { count: 0, posts: [] };
      }

      console.log(`[ArchiveService] Found ${postsToArchive.length} posts to archive (limited to ${Math.min(maxPosts, 1000)} for performance)`);

      // Archive the posts using raw SQL in batches with transaction for each batch
      const batchSize = 50; // Smaller batch size for better performance
      let totalArchived = 0;

      for (let i = 0; i < postsToArchive.length; i += batchSize) {
        const batch = postsToArchive.slice(i, i + batchSize);
        const ids = batch.map(post => post.ID);
        
        console.log(`[ArchiveService] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(postsToArchive.length/batchSize)} (${ids.length} posts)`);
        
        await prisma.$transaction(async (tx) => {
          // Archive the posts
          const result = await tx.$executeRaw`
            UPDATE mod180_posts 
            SET archived = TRUE, archivedAt = NOW() 
            WHERE ID IN (${Prisma.join(ids)})
          `;
          
          totalArchived += Number(result);
          console.log(`[ArchiveService] Batch archived: ${result} posts`);

          // Set free posts as premium content, preserve existing premium/ecomembre posts
          if (setAsExclusivity && ids.length > 0) {
            // Only update posts that are currently free (no post_prestige or post_prestige = 'gratuit')
            // This preserves existing premium/ecomembre posts
            await tx.$executeRaw`
              UPDATE mod180_postmeta 
              SET meta_value = 'ecomembre' 
              WHERE post_id IN (${Prisma.join(ids)}) 
              AND meta_key = 'post_prestige'
              AND (meta_value = 'gratuit' OR meta_value = '' OR meta_value IS NULL)
            `;

            // Insert post_prestige = ecomembre for posts that don't have this meta (making them premium)
            await tx.$executeRaw`
              INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
              SELECT ID, 'post_prestige', 'ecomembre'
              FROM mod180_posts 
              WHERE ID IN (${Prisma.join(ids)})
              AND ID NOT IN (
                SELECT post_id 
                FROM mod180_postmeta 
                WHERE meta_key = 'post_prestige' 
                AND post_id IN (${Prisma.join(ids)})
              )
            `;

            // Only update prix for posts that are currently free or don't have pricing
            // This preserves existing premium/ecomembre pricing
            await tx.$executeRaw`
              UPDATE mod180_postmeta 
              SET meta_value = '5' 
              WHERE post_id IN (${Prisma.join(ids)}) 
              AND meta_key = 'prix'
              AND post_id IN (
                SELECT post_id FROM mod180_postmeta 
                WHERE meta_key = 'post_prestige' 
                AND (meta_value = 'gratuit' OR meta_value = '' OR meta_value IS NULL)
                AND post_id IN (${Prisma.join(ids)})
                UNION
                SELECT ID FROM mod180_posts
                WHERE ID IN (${Prisma.join(ids)})
                AND ID NOT IN (
                  SELECT post_id FROM mod180_postmeta 
                  WHERE meta_key = 'post_prestige'
                  AND post_id IN (${Prisma.join(ids)})
                )
              )
            `;

            // Insert prix = 5 for posts that don't have pricing and are now being made premium
            await tx.$executeRaw`
              INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
              SELECT ID, 'prix', '5'
              FROM mod180_posts 
              WHERE ID IN (${Prisma.join(ids)})
              AND ID NOT IN (
                SELECT post_id 
                FROM mod180_postmeta 
                WHERE meta_key = 'prix' 
                AND post_id IN (${Prisma.join(ids)})
              )
              AND (
                ID IN (
                  SELECT post_id FROM mod180_postmeta 
                  WHERE meta_key = 'post_prestige' 
                  AND (meta_value = 'gratuit' OR meta_value = '' OR meta_value IS NULL)
                  AND post_id IN (${Prisma.join(ids)})
                )
                OR ID NOT IN (
                  SELECT post_id FROM mod180_postmeta 
                  WHERE meta_key = 'post_prestige'
                  AND post_id IN (${Prisma.join(ids)})
                )
              )
            `;
            
            console.log(`[ArchiveService] Batch exclusivity settings applied (only converted free posts to premium)`);
          }
        }, {
          timeout: 120000 // 2 minutes timeout per batch for better performance
        });
      }

      // Add archive tags to all archived posts (outside transactions for safety)
      // Limit tagging for performance in bulk operations
      if (addArchiveTag && totalArchived > 0 && totalArchived <= 200) {
        console.log(`[ArchiveService] Adding archive tags to ${totalArchived} archived posts (limited for performance)...`);
        let taggedCount = 0;
        
        for (const post of postsToArchive.slice(0, Math.min(totalArchived, 200))) {
          try {
            await TagUtils.addTagToPost(BigInt(post.ID), 'Archive');
            taggedCount++;
            
            // Log progress for large operations
            if (taggedCount % 50 === 0) {
              console.log(`[ArchiveService] Tagged ${taggedCount}/${totalArchived} posts with Archive tag`);
            }
          } catch (tagError) {
            console.warn(`[ArchiveService] Failed to add archive tag to post ${post.ID}:`, tagError);
            // Continue with other posts even if one fails
          }
        }
        console.log(`[ArchiveService] Archive tagging completed: ${taggedCount}/${totalArchived} posts tagged`);
      } else if (addArchiveTag && totalArchived > 200) {
        console.log(`[ArchiveService] Skipping archive tagging for ${totalArchived} posts (too many for single operation - consider running tag operation separately)`);
      }

      const resultPosts = postsToArchive.slice(0, 10).map(post => `${post.post_title} (ID: ${post.ID})`);
      
      console.log(`[ArchiveService] Bulk archive operation completed: ${totalArchived} posts archived`);
      
      return {
        count: totalArchived,
        posts: resultPosts
      };
    } catch (error) {
      console.error('[ArchiveService] Error in bulk archive operation:', error);
      throw error;
    }
  }

  /**
   * Run production fixes: set archived posts to premium, unarchive opinions and promotional content, mark all opinions and promotional as gratuit
   * @returns Promise with counts of all operations
   */
  static async runProductionFixes(): Promise<{
    archivedSetToPremium: number;
    opinionPostsUnarchived: number;
    promotionalPostsUnarchived: number;
    allOpinionPostsSetGratuit: number;
    allPromotionalPostsSetGratuit: number;
    sampleArchivedPosts: string[];
    sampleOpinionPosts: string[];
    samplePromotionalPosts: string[];
  }> {
    try {
      console.log('[ArchiveService] Starting production fixes...');
      
      // Step 1: Set all existing archived posts to premium
      console.log('[ArchiveService] Step 1: Setting existing archived posts to premium...');
      const premiumResult = await this.markAllArchivedPostsAsPremium();
      
      // Step 2: Unarchive all opinion posts
      console.log('[ArchiveService] Step 2: Unarchiving opinion posts...');
      const opinionResult = await this.unarchiveOpinionPosts();
      
      // Step 3: Unarchive all promotional posts
      console.log('[ArchiveService] Step 3: Unarchiving promotional content posts...');
      const promotionalResult = await this.unarchivePromotionalPosts();
      
      // Step 4: Mark ALL opinion posts as gratuit (including non-archived ones)
      console.log('[ArchiveService] Step 4: Setting ALL opinion posts as gratuit...');
      const allOpinionFreeResult = await this.setAllOpinionPostsAsGratuit();
      
      // Step 5: Mark ALL promotional posts as gratuit (including non-archived ones)
      console.log('[ArchiveService] Step 5: Setting ALL promotional content posts as gratuit...');
      const allPromotionalFreeResult = await this.setAllPromotionalPostsAsGratuit();
      
      console.log('[ArchiveService] Production fixes completed successfully');
      console.log(`[ArchiveService] Summary: ${premiumResult.count} archived posts set to premium, ${opinionResult.count} opinion posts unarchived, ${promotionalResult.count} promotional posts unarchived, ${allOpinionFreeResult.count} opinion posts set gratuit, ${allPromotionalFreeResult.count} promotional posts set gratuit`);
      
      return {
        archivedSetToPremium: premiumResult.count,
        opinionPostsUnarchived: opinionResult.count,
        promotionalPostsUnarchived: promotionalResult.count,
        allOpinionPostsSetGratuit: allOpinionFreeResult.count,
        allPromotionalPostsSetGratuit: allPromotionalFreeResult.count,
        sampleArchivedPosts: premiumResult.posts,
        sampleOpinionPosts: opinionResult.posts,
        samplePromotionalPosts: promotionalResult.posts
      };
    } catch (error) {
      console.error('[ArchiveService] Error during production fixes:', error);
      throw error;
    }
  }

  /**
   * Unarchive all opinion posts (set archived = FALSE, archivedAt = NULL)
   * Only includes posts with post_type = 'opinion'
   * Sets opinion posts as gratuit (post_prestige = 'gratuit', prix = '0')
   * @returns Promise with count of unarchived posts
   */
  static async unarchiveOpinionPosts(): Promise<{ count: number; posts: string[] }> {
    try {
      console.log('[ArchiveService] Starting operation to unarchive opinion posts...');
      
      // Get all archived opinion posts (including posts that might have post_type = 'post' but are opinion articles)
      const archivedOpinionPosts = await prisma.$queryRaw`
        SELECT DISTINCT ID, post_title, archivedAt, post_type, post_name
        FROM mod180_posts 
        WHERE post_status = 'publish'
        AND archived = TRUE 
        AND archivedAt IS NOT NULL
        AND post_type = 'opinion'
        ORDER BY archivedAt DESC
      `;

      if (!Array.isArray(archivedOpinionPosts) || archivedOpinionPosts.length === 0) {
        console.log('[ArchiveService] No archived opinion posts found to unarchive');
        return { count: 0, posts: [] };
      }

      console.log(`[ArchiveService] Found ${archivedOpinionPosts.length} archived opinion posts to unarchive`);

      // Process in batches
      const batchSize = 100;
      let totalUnarchived = 0;

      for (let i = 0; i < archivedOpinionPosts.length; i += batchSize) {
        const batch = archivedOpinionPosts.slice(i, i + batchSize);
        const ids = batch.map(post => post.ID);
        
        console.log(`[ArchiveService] Processing opinion unarchive batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(archivedOpinionPosts.length/batchSize)} (${ids.length} posts)`);
        
        await prisma.$transaction(async (tx) => {
          // Unarchive the opinion posts
          const result = await tx.$executeRaw`
            UPDATE mod180_posts 
            SET archived = FALSE, archivedAt = NULL 
            WHERE ID IN (${Prisma.join(ids)})
          `;
          
          // Set opinion posts as gratuit (post_prestige = 'gratuit', prix = '0')
          await tx.$executeRaw`
            UPDATE mod180_postmeta 
            SET meta_value = 'gratuit' 
            WHERE post_id IN (${Prisma.join(ids)}) 
            AND meta_key = 'post_prestige'
          `;

          // Insert post_prestige = free for posts that don't have this meta
          await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
            SELECT ID, 'post_prestige', 'gratuit'
            FROM mod180_posts 
            WHERE ID IN (${Prisma.join(ids)})
            AND ID NOT IN (
              SELECT post_id 
              FROM mod180_postmeta 
              WHERE meta_key = 'post_prestige' 
              AND post_id IN (${Prisma.join(ids)})
            )
          `;

          // Set prix = 0 for opinion posts (gratuit content)
          await tx.$executeRaw`
            UPDATE mod180_postmeta 
            SET meta_value = '0' 
            WHERE post_id IN (${Prisma.join(ids)}) 
            AND meta_key = 'prix'
          `;

          // Insert prix = 0 for posts that don't have prix meta
          await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
            SELECT ID, 'prix', '0'
            FROM mod180_posts 
            WHERE ID IN (${Prisma.join(ids)})
            AND ID NOT IN (
              SELECT post_id 
              FROM mod180_postmeta 
              WHERE meta_key = 'prix' 
              AND post_id IN (${Prisma.join(ids)})
            )
          `;
          
          totalUnarchived += Number(result);
          console.log(`[ArchiveService] Opinion batch unarchived: ${result} posts (marked as gratuit)`);
        });
      }

      // Remove archive tags from unarchived opinion posts (outside transactions for safety)
      console.log(`[ArchiveService] Removing archive tags from ${totalUnarchived} unarchived opinion posts...`);
      for (const post of archivedOpinionPosts.slice(0, totalUnarchived)) {
        try {
          await TagUtils.removeTagFromPost(BigInt(post.ID), 'Archive');
        } catch (tagError) {
          console.warn(`[ArchiveService] Failed to remove archive tag from opinion post ${post.ID}:`, tagError);
        }
      }

      const resultPosts = archivedOpinionPosts.slice(0, 10).map(post => `${post.post_title} (ID: ${post.ID})`);
      
      console.log(`[ArchiveService] Unarchive opinion posts completed: ${totalUnarchived} posts unarchived`);
      
      return {
        count: totalUnarchived,
        posts: resultPosts
      };
    } catch (error) {
      console.error('[ArchiveService] Error unarchiving opinion posts:', error);
      throw error;
    }
  }

  /**
   * Unarchive posts containing promotional content (PUBLIREDACTIONNEL, Publirédactionnel, PUBLIREPORTAGE)
   * Sets promotional posts as gratuit (post_prestige = 'gratuit', prix = '0')
   * @returns Promise with count of unarchived posts
   */
  static async unarchivePromotionalPosts(): Promise<{ count: number; posts: string[] }> {
    try {
      console.log('[ArchiveService] Starting operation to unarchive promotional posts...');
      
      // Get all archived promotional posts
      const archivedPromotionalPosts = await prisma.$queryRaw`
        SELECT DISTINCT ID, post_title, archivedAt, post_name, post_type
        FROM mod180_posts 
        WHERE post_status = 'publish'
        AND archived = TRUE 
        AND archivedAt IS NOT NULL
        AND (
          post_content LIKE '%[PUBLIREDACTIONNEL]%' OR
          post_content LIKE '%[Publirédactionnel]%' OR
          post_content LIKE '%[PUBLIREPORTAGE]%' OR
          post_excerpt LIKE '%[PUBLIREDACTIONNEL]%' OR
          post_excerpt LIKE '%[Publirédactionnel]%' OR
          post_excerpt LIKE '%[PUBLIREPORTAGE]%' OR
          post_title LIKE '%[PUBLIREDACTIONNEL]%' OR
          post_title LIKE '%[Publirédactionnel]%' OR
          post_title LIKE '%[PUBLIREPORTAGE]%' OR
          post_name LIKE '%publiredactionnel%' OR
          post_name LIKE '%publireportage%'
        )
        ORDER BY archivedAt DESC
      `;

      if (!Array.isArray(archivedPromotionalPosts) || archivedPromotionalPosts.length === 0) {
        console.log('[ArchiveService] No archived promotional posts found to unarchive');
        return { count: 0, posts: [] };
      }

      console.log(`[ArchiveService] Found ${archivedPromotionalPosts.length} archived promotional posts to unarchive`);

      // Process in batches
      const batchSize = 100;
      let totalUnarchived = 0;

      for (let i = 0; i < archivedPromotionalPosts.length; i += batchSize) {
        const batch = archivedPromotionalPosts.slice(i, i + batchSize);
        const ids = batch.map(post => post.ID);
        
        console.log(`[ArchiveService] Processing promotional unarchive batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(archivedPromotionalPosts.length/batchSize)} (${ids.length} posts)`);
        
        await prisma.$transaction(async (tx) => {
          // Unarchive the promotional posts
          const result = await tx.$executeRaw`
            UPDATE mod180_posts 
            SET archived = FALSE, archivedAt = NULL 
            WHERE ID IN (${Prisma.join(ids)})
          `;
          
          // Set promotional posts as gratuit (post_prestige = 'gratuit', prix = '0')
          await tx.$executeRaw`
            UPDATE mod180_postmeta 
            SET meta_value = 'gratuit' 
            WHERE post_id IN (${Prisma.join(ids)}) 
            AND meta_key = 'post_prestige'
          `;

          // Insert post_prestige = free for posts that don't have this meta
          await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
            SELECT ID, 'post_prestige', 'gratuit'
            FROM mod180_posts 
            WHERE ID IN (${Prisma.join(ids)})
            AND ID NOT IN (
              SELECT post_id 
              FROM mod180_postmeta 
              WHERE meta_key = 'post_prestige' 
              AND post_id IN (${Prisma.join(ids)})
            )
          `;

          // Set prix = 0 for promotional posts (gratuit content)
          await tx.$executeRaw`
            UPDATE mod180_postmeta 
            SET meta_value = '0' 
            WHERE post_id IN (${Prisma.join(ids)}) 
            AND meta_key = 'prix'
          `;

          // Insert prix = 0 for posts that don't have prix meta
          await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
            SELECT ID, 'prix', '0'
            FROM mod180_posts 
            WHERE ID IN (${Prisma.join(ids)})
            AND ID NOT IN (
              SELECT post_id 
              FROM mod180_postmeta 
              WHERE meta_key = 'prix' 
              AND post_id IN (${Prisma.join(ids)})
            )
          `;
          
          totalUnarchived += Number(result);
          console.log(`[ArchiveService] Promotional batch unarchived: ${result} posts (marked as gratuit)`);
        });
      }

      // Remove archive tags from unarchived promotional posts (outside transactions for safety)
      console.log(`[ArchiveService] Removing archive tags from ${totalUnarchived} unarchived promotional posts...`);
      for (const post of archivedPromotionalPosts.slice(0, totalUnarchived)) {
        try {
          await TagUtils.removeTagFromPost(BigInt(post.ID), 'Archive');
        } catch (tagError) {
          console.warn(`[ArchiveService] Failed to remove archive tag from promotional post ${post.ID}:`, tagError);
        }
      }

      const resultPosts = archivedPromotionalPosts.slice(0, 10).map(post => `${post.post_title} (ID: ${post.ID})`);
      
      console.log(`[ArchiveService] Unarchive promotional posts completed: ${totalUnarchived} posts unarchived`);
      
      return {
        count: totalUnarchived,
        posts: resultPosts
      };
    } catch (error) {
      console.error('[ArchiveService] Error unarchiving promotional posts:', error);
      throw error;
    }
  }

  /**
   * Mark all existing archived posts as premium (upgrades free/ecomembre to premium with price 3)
   * This is a special operation for production fixes
   * @returns Promise with count of updated posts
   */
  static async markAllArchivedPostsAsPremium(): Promise<{ count: number; posts: string[] }> {
    try {
      console.log('[ArchiveService] Starting operation to mark all archived posts as premium...');
      
      // Get all archived posts
      const archivedPosts = await prisma.$queryRaw`
        SELECT ID, post_title, archivedAt 
        FROM mod180_posts 
        WHERE post_type = 'post' 
        AND post_status = 'publish'
        AND archived = TRUE 
        AND archivedAt IS NOT NULL
        ORDER BY archivedAt DESC
      `;

      if (!Array.isArray(archivedPosts) || archivedPosts.length === 0) {
        console.log('[ArchiveService] No archived posts found');
        return { count: 0, posts: [] };
      }

      console.log(`[ArchiveService] Found ${archivedPosts.length} archived posts to update`);

      // Process in batches for safety
      const batchSize = 100;
      let totalUpdated = 0;

      for (let i = 0; i < archivedPosts.length; i += batchSize) {
        const batch = archivedPosts.slice(i, i + batchSize);
        const ids = batch.map(post => post.ID);
        
        console.log(`[ArchiveService] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(archivedPosts.length/batchSize)} (${ids.length} posts)`);
        
        await prisma.$transaction(async (tx) => {
          // Update posts that are currently free or ecomembre to premium
          // This upgrades ecomembre posts to premium while preserving existing premium posts
          const updatedPrestige = await tx.$executeRaw`
            UPDATE mod180_postmeta 
            SET meta_value = 'premium' 
            WHERE post_id IN (${Prisma.join(ids)}) 
            AND meta_key = 'post_prestige'
            AND (meta_value = 'gratuit' OR meta_value = '' OR meta_value IS NULL OR meta_value = 'ecomembre')
          `;

          // Insert post_prestige = premium for posts that don't have this meta (making them premium)
          const insertedPrestige = await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
            SELECT ID, 'post_prestige', 'premium'
            FROM mod180_posts 
            WHERE ID IN (${Prisma.join(ids)})
            AND ID NOT IN (
              SELECT post_id 
              FROM mod180_postmeta 
              WHERE meta_key = 'post_prestige' 
              AND post_id IN (${Prisma.join(ids)})
            )
          `;

          // Update prix for posts that are being upgraded to premium
          // This upgrades ecomembre posts (usually prix=5) to premium pricing (prix=3)
          await tx.$executeRaw`
            UPDATE mod180_postmeta 
            SET meta_value = '3' 
            WHERE post_id IN (${Prisma.join(ids)}) 
            AND meta_key = 'prix'
            AND post_id IN (
              SELECT post_id FROM mod180_postmeta 
              WHERE meta_key = 'post_prestige' 
              AND meta_value = 'premium'
              AND post_id IN (${Prisma.join(ids)})
            )
          `;

          // Insert prix = 3 for posts that don't have pricing and are now being made premium
          await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
            SELECT ID, 'prix', '3'
            FROM mod180_posts 
            WHERE ID IN (${Prisma.join(ids)})
            AND ID NOT IN (
              SELECT post_id 
              FROM mod180_postmeta 
              WHERE meta_key = 'prix' 
              AND post_id IN (${Prisma.join(ids)})
            )
            AND ID IN (
              SELECT post_id FROM mod180_postmeta 
              WHERE meta_key = 'post_prestige' 
              AND meta_value = 'premium'
              AND post_id IN (${Prisma.join(ids)})
            )
          `;
          
          const actualUpdated = Number(updatedPrestige) + Number(insertedPrestige);
          console.log(`[ArchiveService] Batch processed: ${actualUpdated} posts upgraded to premium (ecomembre -> premium)`);
          totalUpdated += actualUpdated;
        });
      }

      const resultPosts = archivedPosts.slice(0, 10).map(post => `${post.post_title} (ID: ${post.ID})`);
      
      console.log(`[ArchiveService] Mark all archived as premium completed: ${totalUpdated} posts upgraded to premium (including ecomembre -> premium)`);
      
      return {
        count: totalUpdated,
        posts: resultPosts
      };
    } catch (error) {
      console.error('[ArchiveService] Error marking all archived posts as premium:', error);
      throw error;
    }
  }

  /**
   * Set ALL opinion posts as gratuit (post_prestige = 'gratuit', prix = '0')
   * Includes posts with post_type = 'opinion' AND posts categorized as 'Opinion'
   * This applies to all opinion posts regardless of archive status
   * @returns Promise with count of updated posts
   */
  static async setAllOpinionPostsAsGratuit(): Promise<{ count: number; posts: string[] }> {
    try {
      console.log('[ArchiveService] Starting operation to set all opinion posts as gratuit...');
      
      // Get all opinion posts (including archived and non-archived)
      // Includes posts with post_type = 'opinion' AND posts categorized as 'opinion'
      const allOpinionPosts = await prisma.$queryRaw`
        SELECT DISTINCT p.ID, p.post_title, p.post_name, p.post_type
        FROM mod180_posts p
        LEFT JOIN mod180_term_relationships tr ON p.ID = tr.object_id
        LEFT JOIN mod180_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
        LEFT JOIN mod180_terms t ON tt.term_id = t.term_id
        WHERE p.post_status = 'publish'
        AND (
          p.post_type = 'opinion'
          OR (
            tt.taxonomy = 'category'
            AND t.name = 'Opinion'
          )
        )
        ORDER BY p.ID DESC
        LIMIT 2000
      `;
      
      console.log(`[ArchiveService] Raw opinion posts query result:`, allOpinionPosts);

      if (!Array.isArray(allOpinionPosts) || allOpinionPosts.length === 0) {
        console.log('[ArchiveService] No opinion posts found');
        return { count: 0, posts: [] };
      }

      console.log(`[ArchiveService] Found ${allOpinionPosts.length} opinion posts to set as gratuit`);
      console.log(`[ArchiveService] Sample posts found:`, allOpinionPosts.slice(0, 5).map(p => `${p.post_title} (${p.post_name}) - Type: ${p.post_type}`));

      // Process in batches
      const batchSize = 100;
      let totalUpdated = 0;

      for (let i = 0; i < allOpinionPosts.length; i += batchSize) {
        const batch = allOpinionPosts.slice(i, i + batchSize);
        const ids = batch.map(post => post.ID);
        
        console.log(`[ArchiveService] Processing opinion gratuit batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allOpinionPosts.length/batchSize)} (${ids.length} posts)`);
        console.log(`[ArchiveService] Batch includes:`, batch.slice(0, 3).map(p => `${p.post_title} (${p.post_name})`));
        
        await prisma.$transaction(async (tx) => {
          // Set opinion posts as gratuit (post_prestige = 'gratuit', prix = '0')
          const updateResult = await tx.$executeRaw`
            UPDATE mod180_postmeta 
            SET meta_value = 'gratuit' 
            WHERE post_id IN (${Prisma.join(ids)}) 
            AND meta_key = 'post_prestige'
          `;
          console.log(`[ArchiveService] Updated ${updateResult} existing prestige records to gratuit`);

          // Insert post_prestige = gratuit for posts that don't have this meta
          const insertResult = await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
            SELECT ID, 'post_prestige', 'gratuit'
            FROM mod180_posts 
            WHERE ID IN (${Prisma.join(ids)})
            AND ID NOT IN (
              SELECT post_id 
              FROM mod180_postmeta 
              WHERE meta_key = 'post_prestige' 
              AND post_id IN (${Prisma.join(ids)})
            )
          `;
          console.log(`[ArchiveService] Inserted ${insertResult} new prestige records as gratuit`);

          // Set prix = 0 for opinion posts (gratuit content)
          const updatePrixResult = await tx.$executeRaw`
            UPDATE mod180_postmeta 
            SET meta_value = '0' 
            WHERE post_id IN (${Prisma.join(ids)}) 
            AND meta_key = 'prix'
          `;
          console.log(`[ArchiveService] Updated ${updatePrixResult} existing prix records to 0`);

          // Insert prix = 0 for posts that don't have prix meta
          const insertPrixResult = await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
            SELECT ID, 'prix', '0'
            FROM mod180_posts 
            WHERE ID IN (${Prisma.join(ids)})
            AND ID NOT IN (
              SELECT post_id 
              FROM mod180_postmeta 
              WHERE meta_key = 'prix' 
              AND post_id IN (${Prisma.join(ids)})
            )
          `;
          console.log(`[ArchiveService] Inserted ${insertPrixResult} new prix records as 0`);
          
          totalUpdated += ids.length;
          console.log(`[ArchiveService] Opinion batch processed: ${ids.length} posts set as gratuit (Total processed: ${totalUpdated})`);
        });
      }

      const resultPosts = allOpinionPosts.slice(0, 10).map(post => `${post.post_title} (ID: ${post.ID}, Type: ${post.post_type}, Name: ${post.post_name})`);
      
      console.log(`[ArchiveService] Set all opinion posts as gratuit completed: ${totalUpdated} posts updated`);
      console.log(`[ArchiveService] Opinion posts processed include:`, resultPosts);
      
      return {
        count: totalUpdated,
        posts: resultPosts
      };
    } catch (error) {
      console.error('[ArchiveService] Error setting all opinion posts as gratuit:', error);
      throw error;
    }
  }

  /**
   * Set ALL promotional posts as gratuit (post_prestige = 'gratuit', prix = '0')
   * This applies to all promotional posts regardless of archive status
   * @returns Promise with count of updated posts
   */
  static async setAllPromotionalPostsAsGratuit(): Promise<{ count: number; posts: string[] }> {
    try {
      console.log('[ArchiveService] Starting operation to set all promotional posts as gratuit...');
      
      // Get all promotional posts (including archived and non-archived)
      const allPromotionalPosts = await prisma.$queryRaw`
        SELECT DISTINCT ID, post_title, post_name, post_type
        FROM mod180_posts 
        WHERE post_status = 'publish'
        AND (
          post_content LIKE '%[PUBLIREDACTIONNEL]%' OR
          post_content LIKE '%[Publirédactionnel]%' OR
          post_content LIKE '%[PUBLIREPORTAGE]%' OR
          post_excerpt LIKE '%[PUBLIREDACTIONNEL]%' OR
          post_excerpt LIKE '%[Publirédactionnel]%' OR
          post_excerpt LIKE '%[PUBLIREPORTAGE]%' OR
          post_title LIKE '%[PUBLIREDACTIONNEL]%' OR
          post_title LIKE '%[Publirédactionnel]%' OR
          post_title LIKE '%[PUBLIREPORTAGE]%' OR
          post_name LIKE '%publiredactionnel%' OR
          post_name LIKE '%publireportage%'
        )
        ORDER BY ID DESC
      `;

      if (!Array.isArray(allPromotionalPosts) || allPromotionalPosts.length === 0) {
        console.log('[ArchiveService] No promotional posts found');
        return { count: 0, posts: [] };
      }

      console.log(`[ArchiveService] Found ${allPromotionalPosts.length} promotional posts to set as gratuit`);

      // Process in batches
      const batchSize = 100;
      let totalUpdated = 0;

      for (let i = 0; i < allPromotionalPosts.length; i += batchSize) {
        const batch = allPromotionalPosts.slice(i, i + batchSize);
        const ids = batch.map(post => post.ID);
        
        console.log(`[ArchiveService] Processing promotional free batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allPromotionalPosts.length/batchSize)} (${ids.length} posts)`);
        
        await prisma.$transaction(async (tx) => {
          // Set promotional posts as gratuit (post_prestige = 'gratuit', prix = '0')
          await tx.$executeRaw`
            UPDATE mod180_postmeta 
            SET meta_value = 'gratuit' 
            WHERE post_id IN (${Prisma.join(ids)}) 
            AND meta_key = 'post_prestige'
          `;

          // Insert post_prestige = free for posts that don't have this meta
          await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
            SELECT ID, 'post_prestige', 'gratuit'
            FROM mod180_posts 
            WHERE ID IN (${Prisma.join(ids)})
            AND ID NOT IN (
              SELECT post_id 
              FROM mod180_postmeta 
              WHERE meta_key = 'post_prestige' 
              AND post_id IN (${Prisma.join(ids)})
            )
          `;

          // Set prix = 0 for promotional posts (gratuit content)
          await tx.$executeRaw`
            UPDATE mod180_postmeta 
            SET meta_value = '0' 
            WHERE post_id IN (${Prisma.join(ids)}) 
            AND meta_key = 'prix'
          `;

          // Insert prix = 0 for posts that don't have prix meta
          await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
            SELECT ID, 'prix', '0'
            FROM mod180_posts 
            WHERE ID IN (${Prisma.join(ids)})
            AND ID NOT IN (
              SELECT post_id 
              FROM mod180_postmeta 
              WHERE meta_key = 'prix' 
              AND post_id IN (${Prisma.join(ids)})
            )
          `;
          
          totalUpdated += ids.length;
          console.log(`[ArchiveService] Promotional batch processed: ${ids.length} posts set as gratuit`);
        });
      }

      const resultPosts = allPromotionalPosts.slice(0, 10).map(post => `${post.post_title} (ID: ${post.ID})`);
      
      console.log(`[ArchiveService] Set all promotional posts as gratuit completed: ${totalUpdated} posts updated`);
      
      return {
        count: totalUpdated,
        posts: resultPosts
      };
    } catch (error) {
      console.error('[ArchiveService] Error setting all promotional posts as gratuit:', error);
      throw error;
    }
  }



  /**
   * Get archive statistics
   * @returns Promise with archive statistics
   */
  static async getArchiveStats() {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Use raw SQL for all statistics
      // Posts are considered archived ONLY if archived = TRUE AND archivedAt IS NOT NULL
      const [totalResult, publishedResult, archivedResult, recentResult] = await Promise.all([
        // Total articles (all statuses)
        prisma.$queryRaw`
          SELECT COUNT(*) as count 
          FROM mod180_posts 
          WHERE post_type = 'post'
        `,
        // Published articles only
        prisma.$queryRaw`
          SELECT COUNT(*) as count 
          FROM mod180_posts 
          WHERE post_type = 'post' 
          AND post_status = 'publish'
        `,
        // Archived articles (published only)
        prisma.$queryRaw`
          SELECT COUNT(*) as count 
          FROM mod180_posts 
          WHERE post_type = 'post' 
          AND post_status = 'publish'
          AND archived = TRUE 
          AND archivedAt IS NOT NULL
        `,
        // Recently archived (published only)
        prisma.$queryRaw`
          SELECT COUNT(*) as count 
          FROM mod180_posts 
          WHERE post_type = 'post' 
          AND post_status = 'publish'
          AND archived = TRUE 
          AND archivedAt IS NOT NULL
          AND archivedAt >= ${weekAgo}
        `
      ]);

      const totalPosts = Array.isArray(totalResult) && totalResult[0] 
        ? Number(totalResult[0].count) : 0;
      const publishedPosts = Array.isArray(publishedResult) && publishedResult[0] 
        ? Number(publishedResult[0].count) : 0;
      const archivedCount = Array.isArray(archivedResult) && archivedResult[0] 
        ? Number(archivedResult[0].count) : 0;
      const recentlyArchived = Array.isArray(recentResult) && recentResult[0] 
        ? Number(recentResult[0].count) : 0;

      const activeCount = totalPosts - archivedCount;
      const publishedActiveCount = publishedPosts - archivedCount;
      const archivePercentage = totalPosts > 0 ? ((archivedCount / totalPosts) * 100).toFixed(1) : '0';

      return {
        totalPosts,
        publishedPosts,
        archivedCount,
        activeCount,
        publishedActiveCount,
        recentlyArchived,
        archivePercentage,
        breakdown: {
          note: 'totalPosts includes all statuses (published, draft, private, etc.)'
        }
      };
    } catch (error) {
      console.error('Error getting archive stats:', error);
      throw error;
    }
  }
}