/**
 * Archive-related utility functions
 */
import { User } from '@prisma/client';
import { hasActiveSubscription } from './subscriptionUtils';

/**
 * Get the proper WHERE clause for excluding archived posts
 * Posts are considered archived ONLY if archived = TRUE AND archivedAt IS NOT NULL
 */
export const getArchiveExclusionClause = (): string => {
  return 'NOT (archived = TRUE AND archivedAt IS NOT NULL)';
};

/**
 * Get the proper WHERE clause for including only archived posts
 * Posts are considered archived ONLY if archived = TRUE AND archivedAt IS NOT NULL
 */
export const getArchiveInclusionClause = (): string => {
  return '(archived = TRUE AND archivedAt IS NOT NULL)';
};

/**
 * Add archive exclusion to a WHERE clause
 */
export const addArchiveExclusion = (existingWhere: string): string => {
  const archiveClause = getArchiveExclusionClause();
  
  if (existingWhere.trim()) {
    return `(${existingWhere}) AND ${archiveClause}`;
  }
  
  return archiveClause;
};

/**
 * Get archive filter based on user subscription status
 * @param user - The user object (null for anonymous users)
 * @returns Promise with the appropriate filter condition
 */
export const getArchiveFilterForUser = async (user: User | null): Promise<string> => {
  // If user has active subscription (ecomembre), they can see archived posts
  if (user && await hasActiveSubscription(user)) {
    return '1=1'; // No archive filtering - show all posts including archived
  }
  
  // For non-subscribers, exclude archived posts
  return getArchiveExclusionClause();
};

/**
 * Add archive filtering based on user subscription status
 * @param existingWhere - Existing WHERE clause
 * @param user - The user object (null for anonymous users)
 * @returns Promise with the combined WHERE clause
 */
export const addArchiveFilterForUser = async (existingWhere: string, user: User | null): Promise<string> => {
  const archiveFilter = await getArchiveFilterForUser(user);
  
  // If no archive filtering needed (ecomembre user), return existing clause
  if (archiveFilter === '1=1') {
    return existingWhere;
  }
  
  // Add archive filter for non-subscribers
  if (existingWhere.trim()) {
    return `(${existingWhere}) AND ${archiveFilter}`;
  }
  
  return archiveFilter;
};

/**
 * Check if a post is properly archived
 * @param archived - The archived field value
 * @param archivedAt - The archivedAt field value
 */
export const isPostArchived = (archived: boolean | null, archivedAt: Date | null): boolean => {
  return archived === true && archivedAt !== null;
};

/**
 * Validate archive fields before setting
 */
export const validateArchiveOperation = (archived: boolean, archivedAt: Date | null): { valid: boolean; error?: string } => {
  // If archiving, must have both archived = true AND archivedAt date
  if (archived && !archivedAt) {
    return { 
      valid: false, 
      error: 'Cannot archive post without archivedAt timestamp' 
    };
  }
  
  // If unarchiving, both should be cleared
  if (!archived && archivedAt) {
    return { 
      valid: false, 
      error: 'When unarchiving, both archived and archivedAt should be cleared' 
    };
  }
  
  return { valid: true };
};