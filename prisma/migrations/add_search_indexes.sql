-- Add indexes for search optimization
-- These indexes will significantly improve search performance

-- Create index on post_content for faster contains searches
CREATE INDEX idx_post_content ON mod180_posts(post_content(255));

-- Create composite index for search fields
CREATE INDEX idx_search_fields ON mod180_posts(post_title(255), post_excerpt(255), post_name);

-- Create index on post_type and post_status for faster filtering
CREATE INDEX idx_post_type_status ON mod180_posts(post_type, post_status);

-- If your MySQL version supports it (5.6+), create a FULLTEXT index
-- This provides much faster text searching
ALTER TABLE mod180_posts ADD FULLTEXT ft_search_index (post_title, post_excerpt, post_content);

-- Note: To use FULLTEXT search, you would modify the query to use MATCH AGAINST instead of CONTAINS
-- Example: WHERE MATCH(post_title, post_excerpt, post_content) AGAINST('search_term' IN NATURAL LANGUAGE MODE)