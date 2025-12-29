-- Add indexes for ads-list query optimization

-- Index on mod180_posts for filtering by post_type and post_status
CREATE INDEX IF NOT EXISTS idx_posts_type_status ON mod180_posts(post_type, post_status);

-- Index on mod180_posts for ordering by updated date
CREATE INDEX IF NOT EXISTS idx_posts_modified_date ON mod180_posts(post_modified_gmt DESC);

-- Index on mod180_posts for ordering by created date
CREATE INDEX IF NOT EXISTS idx_posts_created_date ON mod180_posts(post_date_gmt DESC);

-- Composite index on ad_insights for grouping by ad_id and event_type
CREATE INDEX IF NOT EXISTS idx_ad_insights_ad_event ON ad_insights(ad_id, event_type);

-- Index on mod180_postmeta for faster meta lookups
CREATE INDEX IF NOT EXISTS idx_postmeta_post_id_key ON mod180_postmeta(post_id, meta_key);