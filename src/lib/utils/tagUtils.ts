import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Utility functions for managing tags and taxonomies
 */
export class TagUtils {
  
  /**
   * Get or create a tag by name
   * @param tagName - The name of the tag
   * @param taxonomy - The taxonomy type (default: 'post_tag')
   * @returns Promise with the tag term_taxonomy_id
   */
  static async getOrCreateTag(tagName: string, taxonomy: string = 'post_tag'): Promise<bigint> {
    try {
      // Generate slug from tag name
      const slug = tagName.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .trim();

      // First check if the tag already exists
      const existingTag = await prisma.mod180_term_taxonomy.findFirst({
        where: {
          taxonomy,
          term: {
            OR: [
              { name: tagName },
              { slug }
            ]
          }
        },
        select: {
          term_taxonomy_id: true,
          term_id: true
        }
      });

      if (existingTag) {
        return existingTag.term_taxonomy_id;
      }

      // Tag doesn't exist, create it
      return await prisma.$transaction(async (tx) => {
        // Create the term first
        const term = await tx.mod180_terms.create({
          data: {
            name: tagName,
            slug,
            term_group: BigInt(0)
          }
        });

        // Create the term taxonomy relationship
        const termTaxonomy = await tx.mod180_term_taxonomy.create({
          data: {
            term_id: term.term_id,
            taxonomy,
            description: taxonomy === 'post_tag' && tagName.toLowerCase().includes('archive') 
              ? 'Tag automatically added to archived posts' 
              : '',
            parent: BigInt(0),
            count: BigInt(0)
          }
        });

        return termTaxonomy.term_taxonomy_id;
      });
    } catch (error) {
      console.error('Error creating/getting tag:', error);
      throw error;
    }
  }

  /**
   * Add a tag to a post
   * @param postId - The ID of the post
   * @param tagName - The name of the tag to add
   * @param taxonomy - The taxonomy type (default: 'post_tag')
   * @returns Promise with the operation result
   */
  static async addTagToPost(postId: bigint, tagName: string, taxonomy: string = 'post_tag'): Promise<void> {
    try {
      const termTaxonomyId = await this.getOrCreateTag(tagName, taxonomy);

      // Check if the relationship already exists
      const existingRelationship = await prisma.mod180_term_relationships.findUnique({
        where: {
          object_id_term_taxonomy_id: {
            object_id: postId,
            term_taxonomy_id: termTaxonomyId
          }
        }
      });

      if (existingRelationship) {
        // Relationship already exists, nothing to do
        return;
      }

      // Create the relationship
      await prisma.$transaction(async (tx) => {
        // Add the term relationship
        await tx.mod180_term_relationships.create({
          data: {
            object_id: postId,
            term_taxonomy_id: termTaxonomyId,
            term_order: 0
          }
        });

        // Increment the count in term_taxonomy
        await tx.mod180_term_taxonomy.update({
          where: {
            term_taxonomy_id: termTaxonomyId
          },
          data: {
            count: {
              increment: 1
            }
          }
        });
      });
    } catch (error) {
      console.error('Error adding tag to post:', error);
      throw error;
    }
  }

  /**
   * Remove a tag from a post
   * @param postId - The ID of the post
   * @param tagName - The name of the tag to remove
   * @param taxonomy - The taxonomy type (default: 'post_tag')
   * @returns Promise with the operation result
   */
  static async removeTagFromPost(postId: bigint, tagName: string, taxonomy: string = 'post_tag'): Promise<void> {
    try {
      // Find the tag
      const tag = await prisma.mod180_term_taxonomy.findFirst({
        where: {
          taxonomy,
          term: {
            name: tagName
          }
        },
        select: {
          term_taxonomy_id: true
        }
      });

      if (!tag) {
        // Tag doesn't exist, nothing to remove
        return;
      }

      // Check if the relationship exists
      const relationship = await prisma.mod180_term_relationships.findUnique({
        where: {
          object_id_term_taxonomy_id: {
            object_id: postId,
            term_taxonomy_id: tag.term_taxonomy_id
          }
        }
      });

      if (!relationship) {
        // Relationship doesn't exist, nothing to remove
        return;
      }

      // Remove the relationship and decrement count
      await prisma.$transaction(async (tx) => {
        // Remove the term relationship
        await tx.mod180_term_relationships.delete({
          where: {
            object_id_term_taxonomy_id: {
              object_id: postId,
              term_taxonomy_id: tag.term_taxonomy_id
            }
          }
        });

        // Decrement the count in term_taxonomy
        await tx.mod180_term_taxonomy.update({
          where: {
            term_taxonomy_id: tag.term_taxonomy_id
          },
          data: {
            count: {
              decrement: 1
            }
          }
        });
      });
    } catch (error) {
      console.error('Error removing tag from post:', error);
      throw error;
    }
  }

  /**
   * Check if a post has a specific tag
   * @param postId - The ID of the post
   * @param tagName - The name of the tag to check
   * @param taxonomy - The taxonomy type (default: 'post_tag')
   * @returns Promise with boolean result
   */
  static async postHasTag(postId: bigint, tagName: string, taxonomy: string = 'post_tag'): Promise<boolean> {
    try {
      const relationship = await prisma.mod180_term_relationships.findFirst({
        where: {
          object_id: postId,
          taxonomy: {
            taxonomy,
            term: {
              name: tagName
            }
          }
        }
      });

      return !!relationship;
    } catch (error) {
      console.error('Error checking if post has tag:', error);
      return false;
    }
  }

  /**
   * Get all tags for a post
   * @param postId - The ID of the post
   * @param taxonomy - The taxonomy type (default: 'post_tag')
   * @returns Promise with array of tag names
   */
  static async getPostTags(postId: bigint, taxonomy: string = 'post_tag'): Promise<string[]> {
    try {
      const relationships = await prisma.mod180_term_relationships.findMany({
        where: {
          object_id: postId,
          taxonomy: {
            taxonomy
          }
        },
        include: {
          taxonomy: {
            include: {
              term: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });

      return relationships.map(rel => rel.taxonomy.term.name);
    } catch (error) {
      console.error('Error getting post tags:', error);
      return [];
    }
  }
}