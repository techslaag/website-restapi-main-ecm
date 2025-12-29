-- CreateTable
CREATE TABLE `mod180_actionscheduler_actions` (
    `action_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hook` VARCHAR(191) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `scheduled_date_gmt` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `scheduled_date_local` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `args` VARCHAR(191) NULL,
    `schedule` LONGTEXT NULL,
    `group_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `last_attempt_gmt` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `last_attempt_local` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `claim_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `extended_args` VARCHAR(8000) NULL,
    `priority` TINYINT UNSIGNED NOT NULL DEFAULT 10,

    INDEX `args`(`args`),
    INDEX `claim_id`(`claim_id`),
    INDEX `claim_id_status_scheduled_date_gmt`(`claim_id`, `status`, `scheduled_date_gmt`),
    INDEX `group_id`(`group_id`),
    INDEX `hook`(`hook`),
    INDEX `last_attempt_gmt`(`last_attempt_gmt`),
    INDEX `scheduled_date_gmt`(`scheduled_date_gmt`),
    INDEX `status`(`status`),
    PRIMARY KEY (`action_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_actionscheduler_claims` (
    `claim_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `date_created_gmt` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `date_created_gmt`(`date_created_gmt`),
    PRIMARY KEY (`claim_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_actionscheduler_groups` (
    `group_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(255) NOT NULL,

    INDEX `slug`(`slug`(191)),
    PRIMARY KEY (`group_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_actionscheduler_logs` (
    `log_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `action_id` BIGINT UNSIGNED NOT NULL,
    `message` TEXT NOT NULL,
    `log_date_gmt` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `log_date_local` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `action_id`(`action_id`),
    INDEX `log_date_gmt`(`log_date_gmt`),
    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_bravepopup_goal_stats` (
    `id` MEDIUMINT NOT NULL AUTO_INCREMENT,
    `goal_time` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `popup` INTEGER NOT NULL,
    `country` VARCHAR(50) NULL,
    `ip` VARCHAR(50) NULL,
    `device` VARCHAR(20) NULL DEFAULT '',
    `goaltype` VARCHAR(20) NULL,
    `actiontype` VARCHAR(20) NULL,
    `actiondata` VARCHAR(150) NULL,
    `autotracked` INTEGER NULL DEFAULT 0,
    `url` VARCHAR(155) NOT NULL DEFAULT '',
    `user` INTEGER NOT NULL DEFAULT 0,
    `viewed` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_bravepopup_stats` (
    `id` MEDIUMINT NOT NULL AUTO_INCREMENT,
    `popup` INTEGER NOT NULL,
    `stats` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_bravepopup_submissions` (
    `id` MEDIUMINT NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(50) NULL DEFAULT '',
    `submitted` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `settings` TEXT NULL,
    `submission` TEXT NULL,
    `automation` TEXT NULL,
    `popup` INTEGER NOT NULL,
    `form_id` VARCHAR(50) NULL,
    `form_settings` TEXT NULL,
    `tags` TEXT NULL,
    `country` VARCHAR(50) NULL,
    `ip` VARCHAR(50) NULL,
    `device` VARCHAR(20) NULL DEFAULT '',
    `url` VARCHAR(155) NOT NULL DEFAULT '',
    `user` VARCHAR(155) NULL DEFAULT '',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ce4wp_abandoned_checkout` (
    `checkout_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `user_email` VARCHAR(200) NOT NULL DEFAULT '',
    `checkout_contents` LONGTEXT NOT NULL,
    `checkout_updated` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `checkout_updated_ts` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `checkout_created` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `checkout_created_ts` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `checkout_recovered` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `checkout_recovered_ts` INTEGER UNSIGNED NULL DEFAULT 0,
    `checkout_consent` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `checkout_uuid` VARCHAR(36) NOT NULL DEFAULT '',

    UNIQUE INDEX `checkout_uuid`(`checkout_uuid`),
    PRIMARY KEY (`checkout_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_commentmeta` (
    `meta_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `comment_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `meta_key` VARCHAR(255) NULL,
    `meta_value` LONGTEXT NULL,

    INDEX `comment_id`(`comment_id`),
    INDEX `meta_key`(`meta_key`(191)),
    PRIMARY KEY (`meta_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_comments` (
    `comment_ID` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `comment_post_ID` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `comment_author` TINYTEXT NOT NULL,
    `comment_author_email` VARCHAR(100) NOT NULL DEFAULT '',
    `comment_author_url` VARCHAR(200) NOT NULL DEFAULT '',
    `comment_author_IP` VARCHAR(100) NOT NULL DEFAULT '',
    `comment_date` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `comment_date_gmt` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `comment_content` TEXT NOT NULL,
    `comment_karma` INTEGER NOT NULL DEFAULT 0,
    `comment_approved` VARCHAR(20) NOT NULL DEFAULT '1',
    `comment_agent` VARCHAR(255) NOT NULL DEFAULT '',
    `comment_type` VARCHAR(20) NOT NULL DEFAULT 'comment',
    `comment_parent` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `user_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `comment_approved_date_gmt`(`comment_approved`, `comment_date_gmt`),
    INDEX `comment_author_email`(`comment_author_email`(10)),
    INDEX `comment_date_gmt`(`comment_date_gmt`),
    INDEX `comment_parent`(`comment_parent`),
    INDEX `comment_post_ID`(`comment_post_ID`),
    INDEX `woo_idx_comment_type`(`comment_type`),
    PRIMARY KEY (`comment_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_csshero4` (
    `step_id` MEDIUMINT NOT NULL AUTO_INCREMENT,
    `step_time` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `step_type` VARCHAR(30) NOT NULL,
    `step_name` VARCHAR(100) NOT NULL,
    `step_data` MEDIUMBLOB NOT NULL,
    `step_theme` VARCHAR(100) NOT NULL,
    `step_context` VARCHAR(30) NOT NULL,
    `step_active_flag` VARCHAR(3) NOT NULL,

    UNIQUE INDEX `step_id`(`step_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_duplicator_backups` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(250) NOT NULL,
    `hash` VARCHAR(50) NOT NULL,
    `archive_name` VARCHAR(350) NOT NULL DEFAULT '',
    `status` INTEGER NOT NULL,
    `progress` FLOAT NOT NULL DEFAULT 0,
    `flags` VARCHAR(191) NOT NULL DEFAULT '',
    `package` LONGTEXT NOT NULL,
    `owner` VARCHAR(60) NOT NULL DEFAULT '',
    `version` VARCHAR(30) NOT NULL DEFAULT '',
    `created` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `archive_name`(`archive_name`),
    INDEX `created`(`created`),
    INDEX `flags`(`flags`),
    INDEX `hash`(`hash`),
    INDEX `name`(`name`),
    INDEX `status`(`status`),
    INDEX `updated_at`(`updated_at`),
    INDEX `version`(`version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_duplicator_entities` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(100) NOT NULL,
    `value_1` VARCHAR(255) NOT NULL DEFAULT '',
    `value_2` VARCHAR(255) NOT NULL DEFAULT '',
    `value_3` VARCHAR(255) NOT NULL DEFAULT '',
    `value_4` VARCHAR(255) NOT NULL DEFAULT '',
    `value_5` VARCHAR(255) NOT NULL DEFAULT '',
    `data` LONGTEXT NOT NULL,
    `version` VARCHAR(30) NOT NULL DEFAULT '',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `created_at`(`created_at`),
    INDEX `type_idx`(`type`),
    INDEX `updated_at`(`updated_at`),
    INDEX `value_1`(`value_1`),
    INDEX `value_2`(`value_2`),
    INDEX `value_3`(`value_3`),
    INDEX `value_4`(`value_4`),
    INDEX `value_5`(`value_5`),
    INDEX `version`(`version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_e_submissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(60) NULL,
    `hash_id` VARCHAR(60) NOT NULL,
    `main_meta_id` BIGINT UNSIGNED NOT NULL,
    `post_id` BIGINT UNSIGNED NOT NULL,
    `referer` VARCHAR(500) NOT NULL,
    `referer_title` VARCHAR(300) NULL,
    `element_id` VARCHAR(20) NOT NULL,
    `form_name` VARCHAR(60) NOT NULL,
    `campaign_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `user_ip` VARCHAR(46) NOT NULL,
    `user_agent` TEXT NOT NULL,
    `actions_count` INTEGER NULL DEFAULT 0,
    `actions_succeeded_count` INTEGER NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `meta` TEXT NULL,
    `created_at_gmt` DATETIME(0) NOT NULL,
    `updated_at_gmt` DATETIME(0) NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `hash_id_unique_index`(`hash_id`),
    INDEX `campaign_id_index`(`campaign_id`),
    INDEX `created_at_gmt_index`(`created_at_gmt`),
    INDEX `created_at_index`(`created_at`),
    INDEX `element_id_index`(`element_id`),
    INDEX `hash_id_index`(`hash_id`),
    INDEX `is_read_index`(`is_read`),
    INDEX `main_meta_id_index`(`main_meta_id`),
    INDEX `post_id_index`(`post_id`),
    INDEX `referer_index`(`referer`(191)),
    INDEX `referer_title_index`(`referer_title`(191)),
    INDEX `status_index`(`status`),
    INDEX `type_index`(`type`),
    INDEX `updated_at_gmt_index`(`updated_at_gmt`),
    INDEX `updated_at_index`(`updated_at`),
    INDEX `user_id_index`(`user_id`),
    INDEX `user_ip_index`(`user_ip`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_e_submissions_actions_log` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `submission_id` BIGINT UNSIGNED NOT NULL,
    `action_name` VARCHAR(60) NOT NULL,
    `action_label` VARCHAR(60) NULL,
    `status` VARCHAR(20) NOT NULL,
    `log` TEXT NULL,
    `created_at_gmt` DATETIME(0) NOT NULL,
    `updated_at_gmt` DATETIME(0) NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `action_name_index`(`action_name`),
    INDEX `created_at_gmt_index`(`created_at_gmt`),
    INDEX `created_at_index`(`created_at`),
    INDEX `status_index`(`status`),
    INDEX `submission_id_index`(`submission_id`),
    INDEX `updated_at_gmt_index`(`updated_at_gmt`),
    INDEX `updated_at_index`(`updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_e_submissions_values` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `submission_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `key` VARCHAR(60) NULL,
    `value` LONGTEXT NULL,

    INDEX `key_index`(`key`),
    INDEX `submission_id_index`(`submission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_cheat_off` (
    `uid` INTEGER NOT NULL,
    `hash` VARCHAR(40) NOT NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_coupons` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(200) NULL,
    `settings` TEXT NULL,
    `submited_coupons_count` INTEGER NULL,
    `status` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_dashboard_notifications` (
    `type` VARCHAR(40) NOT NULL,
    `value` INTEGER NULL DEFAULT 0
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_debug_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `source` VARCHAR(200) NULL,
    `message` TEXT NULL,
    `insert_time` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_download_monitor_limit` (
    `uid` INTEGER NOT NULL,
    `lid` INTEGER NOT NULL,
    `download_limit` INTEGER NOT NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_gift_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lid` INTEGER NULL,
    `settings` TEXT NULL,
    `status` TINYINT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_invitation_codes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(200) NULL,
    `settings` TEXT NULL,
    `submited` INTEGER NULL,
    `repeat_limit` INTEGER NULL,
    `status` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_memberships` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `label` VARCHAR(200) NOT NULL,
    `short_description` VARCHAR(400) NULL,
    `payment_type` VARCHAR(50) NULL,
    `price` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `status` BOOLEAN NULL DEFAULT true,
    `the_order` INTEGER NULL,
    `created_at` INTEGER NULL,

    INDEX `idx_ihc_memberships_id`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_memberships_meta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `membership_id` INTEGER NOT NULL,
    `meta_key` VARCHAR(300) NOT NULL,
    `meta_value` TEXT NULL,

    INDEX `idx_ihc_memberships_meta_membership_id`(`membership_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `notification_type` VARCHAR(200) NULL,
    `level_id` VARCHAR(200) NULL,
    `subject` TEXT NULL,
    `message` TEXT NULL,
    `pushover_message` TEXT NULL,
    `pushover_status` BOOLEAN NOT NULL DEFAULT false,
    `status` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_notifications_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `notification_type` VARCHAR(100) NULL,
    `email_address` VARCHAR(300) NULL,
    `subject` VARCHAR(300) NULL,
    `message` TEXT NULL,
    `uid` INTEGER NOT NULL,
    `lid` INTEGER NOT NULL,
    `create_date` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uid` INTEGER NULL,
    `lid` INTEGER NULL,
    `amount_type` VARCHAR(200) NULL,
    `amount_value` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `automated_payment` BOOLEAN NULL,
    `status` VARCHAR(100) NULL,
    `create_date` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_ihc_orders_uid`(`uid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_orders_meta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NULL,
    `meta_key` VARCHAR(200) NULL,
    `meta_value` TEXT NULL,

    INDEX `idx_ihc_orders_meta_order_id`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_reason_for_cancel_delete_levels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uid` INTEGER NOT NULL,
    `lid` INTEGER NOT NULL,
    `reason` VARCHAR(400) NULL,
    `action_type` VARCHAR(30) NULL,
    `action_date` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_security_login` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(200) NULL,
    `ip` VARCHAR(30) NULL,
    `log_time` INTEGER NULL,
    `attempts_count` INTEGER NULL,
    `locked` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_taxes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `country_code` VARCHAR(20) NULL,
    `state_code` VARCHAR(50) NULL DEFAULT '',
    `amount_value` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `label` VARCHAR(200) NULL,
    `description` TEXT NULL,
    `status` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_user_levels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `level_id` INTEGER NOT NULL,
    `start_time` DATETIME(0) NULL,
    `update_time` DATETIME(0) NULL,
    `expire_time` DATETIME(0) NULL,
    `notification` BOOLEAN NULL DEFAULT false,
    `status` INTEGER NOT NULL,

    INDEX `idx_ihc_user_levels_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_user_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uid` INTEGER NOT NULL DEFAULT 0,
    `lid` INTEGER NULL,
    `log_type` VARCHAR(100) NULL,
    `log_content` TEXT NULL,
    `create_date` INTEGER NULL,

    INDEX `idx_ihc_user_logs_uid`(`uid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_user_sites` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `site_id` INTEGER NULL,
    `uid` INTEGER NULL,
    `lid` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_user_subscriptions_meta` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `subscription_id` BIGINT NOT NULL,
    `meta_key` VARCHAR(300) NOT NULL,
    `meta_value` TEXT NULL,

    INDEX `idx_ihc_user_subscriptions_meta_subscription_id`(`subscription_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_woo_product_level_relations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ihc_woo_product_id` INTEGER NULL,
    `lid` INTEGER NULL,
    `woo_item` INTEGER NULL,
    `woo_item_type` VARCHAR(200) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_ihc_woo_products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(200) NOT NULL,
    `discount_type` VARCHAR(20) NULL,
    `discount_value` DECIMAL(12, 2) NULL,
    `start_date` DATETIME(0) NULL,
    `end_date` DATETIME(0) NULL,
    `settings` TEXT NULL,
    `status` BOOLEAN NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_indeed_members_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `txn_id` VARCHAR(100) NULL,
    `u_id` INTEGER NULL,
    `payment_data` TEXT NULL,
    `history` TEXT NULL,
    `orders` TEXT NULL,
    `paydate` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_indeed_members_payments_uid`(`u_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_iwomi` (
    `id` MEDIUMINT NOT NULL AUTO_INCREMENT,
    `date` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `article_id` INTEGER NOT NULL,
    `article_name` VARCHAR(255) NOT NULL,
    `price` VARCHAR(255) NOT NULL DEFAULT '',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_links` (
    `link_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `link_url` VARCHAR(255) NOT NULL DEFAULT '',
    `link_name` VARCHAR(255) NOT NULL DEFAULT '',
    `link_image` VARCHAR(255) NOT NULL DEFAULT '',
    `link_target` VARCHAR(25) NOT NULL DEFAULT '',
    `link_description` VARCHAR(255) NOT NULL DEFAULT '',
    `link_visible` VARCHAR(20) NOT NULL DEFAULT 'Y',
    `link_owner` BIGINT UNSIGNED NOT NULL DEFAULT 1,
    `link_rating` INTEGER NOT NULL DEFAULT 0,
    `link_updated` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `link_rel` VARCHAR(255) NOT NULL DEFAULT '',
    `link_notes` MEDIUMTEXT NOT NULL,
    `link_rss` VARCHAR(255) NOT NULL DEFAULT '',

    INDEX `link_visible`(`link_visible`),
    PRIMARY KEY (`link_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_mailchimp_carts` (
    `id` VARCHAR(255) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `user_id` INTEGER NULL,
    `cart` TEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_mailchimp_jobs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `obj_id` TEXT NULL,
    `job` TEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_mepr_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `event` VARCHAR(255) NOT NULL DEFAULT 'login',
    `args` VARCHAR(255) NULL,
    `evt_id` BIGINT NOT NULL,
    `evt_id_type` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(0) NOT NULL,

    INDEX `event_args`(`args`(191)),
    INDEX `event_created_at`(`created_at`),
    INDEX `event_event`(`event`(191)),
    INDEX `event_evt_id`(`evt_id`),
    INDEX `event_evt_id_type`(`evt_id_type`(191)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_mepr_jobs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `runtime` DATETIME(0) NOT NULL,
    `firstrun` DATETIME(0) NOT NULL,
    `lastrun` DATETIME(0) NULL,
    `priority` BIGINT NULL DEFAULT 10,
    `tries` BIGINT NULL DEFAULT 0,
    `class` VARCHAR(255) NOT NULL,
    `batch` VARCHAR(255) NULL,
    `args` TEXT NULL,
    `reason` TEXT NULL,
    `status` VARCHAR(255) NULL DEFAULT 'pending',
    `created_at` DATETIME(0) NOT NULL,

    INDEX `job_batch`(`batch`(191)),
    INDEX `job_class`(`class`(191)),
    INDEX `job_created_at`(`created_at`),
    INDEX `job_firstrun`(`firstrun`),
    INDEX `job_lastrun`(`lastrun`),
    INDEX `job_priority`(`priority`),
    INDEX `job_runtime`(`runtime`),
    INDEX `job_status`(`status`(191)),
    INDEX `job_tries`(`tries`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_mepr_members` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `first_txn_id` BIGINT NULL,
    `latest_txn_id` BIGINT NULL,
    `txn_count` BIGINT NULL,
    `expired_txn_count` BIGINT NULL,
    `active_txn_count` BIGINT NULL,
    `sub_count` BIGINT NULL,
    `pending_sub_count` BIGINT NULL,
    `active_sub_count` BIGINT NULL,
    `suspended_sub_count` BIGINT NULL,
    `cancelled_sub_count` BIGINT NULL,
    `memberships` LONGTEXT NULL,
    `last_login_id` BIGINT NULL,
    `login_count` BIGINT NULL,
    `total_spent` DECIMAL(16, 2) NULL DEFAULT 0.00,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,
    `trial_txn_count` BIGINT NULL,

    UNIQUE INDEX `mp_user_id`(`user_id`),
    INDEX `mp_active_sub_count`(`active_sub_count`),
    INDEX `mp_active_txn_count`(`active_txn_count`),
    INDEX `mp_cancelled_sub_count`(`cancelled_sub_count`),
    INDEX `mp_created_at`(`created_at`),
    INDEX `mp_expired_txn_count`(`expired_txn_count`),
    INDEX `mp_first_txn_id`(`latest_txn_id`),
    INDEX `mp_last_login_id`(`last_login_id`),
    INDEX `mp_latest_txn_id`(`latest_txn_id`),
    INDEX `mp_login_count`(`login_count`),
    INDEX `mp_pending_sub_count`(`pending_sub_count`),
    INDEX `mp_sub_count`(`sub_count`),
    INDEX `mp_suspended_sub_count`(`suspended_sub_count`),
    INDEX `mp_total_spent`(`total_spent`),
    INDEX `mp_trial_txn_count`(`trial_txn_count`),
    INDEX `mp_txn_count`(`txn_count`),
    INDEX `mp_updated_at`(`updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_mepr_rule_access_conditions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `rule_id` BIGINT NOT NULL,
    `access_type` VARCHAR(20) NOT NULL,
    `access_operator` VARCHAR(20) NOT NULL,
    `access_condition` VARCHAR(60) NOT NULL,

    INDEX `mp_access_condition`(`access_condition`),
    INDEX `mp_access_rule_id`(`rule_id`),
    INDEX `mp_access_type`(`access_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_mepr_subscription_meta` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `subscription_id` BIGINT NULL DEFAULT 0,
    `meta_key` VARCHAR(191) NULL,
    `meta_value` LONGTEXT NULL,

    INDEX `meta_key`(`meta_key`),
    INDEX `subscription_id`(`subscription_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_mepr_subscriptions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `product_id` BIGINT NOT NULL,
    `coupon_id` BIGINT NULL,
    `subscr_id` VARCHAR(255) NULL DEFAULT '',
    `price` DECIMAL(16, 2) NOT NULL,
    `total` DECIMAL(16, 2) NULL DEFAULT 0.00,
    `tax_amount` DECIMAL(16, 2) NULL DEFAULT 0.00,
    `tax_rate` DECIMAL(6, 3) NULL DEFAULT 0.000,
    `tax_desc` VARCHAR(255) NULL DEFAULT '',
    `tax_compound` INTEGER NULL DEFAULT 0,
    `tax_shipping` INTEGER NULL DEFAULT 1,
    `tax_class` VARCHAR(255) NULL DEFAULT 'standard',
    `gateway` VARCHAR(255) NULL DEFAULT 'manual',
    `response` LONGTEXT NULL,
    `period` INTEGER NULL DEFAULT 1,
    `period_type` VARCHAR(20) NULL DEFAULT 'months',
    `limit_cycles` BOOLEAN NULL DEFAULT false,
    `limit_cycles_num` INTEGER NULL DEFAULT 1,
    `limit_cycles_action` VARCHAR(255) NULL DEFAULT 'lifetime',
    `limit_cycles_expires_after` INTEGER NULL DEFAULT 1,
    `limit_cycles_expires_type` VARCHAR(255) NULL DEFAULT 'days',
    `prorated_trial` BOOLEAN NULL DEFAULT false,
    `trial` BOOLEAN NULL DEFAULT false,
    `trial_days` INTEGER NULL DEFAULT 1,
    `trial_amount` DECIMAL(16, 2) NULL DEFAULT 0.00,
    `status` VARCHAR(20) NULL DEFAULT 'pending',
    `created_at` DATETIME(0) NOT NULL,
    `cc_last4` VARCHAR(10) NULL DEFAULT '4242',
    `cc_exp_month` VARCHAR(10) NULL DEFAULT '01',
    `cc_exp_year` VARCHAR(10) NULL DEFAULT '1999',
    `token` VARCHAR(64) NULL,

    INDEX `mp_cc_exp_month`(`cc_exp_month`),
    INDEX `mp_cc_exp_year`(`cc_exp_year`),
    INDEX `mp_cc_last4`(`cc_last4`),
    INDEX `mp_coupon_id`(`coupon_id`),
    INDEX `mp_created_at`(`created_at`),
    INDEX `mp_gateway`(`gateway`(191)),
    INDEX `mp_limit_cycles`(`limit_cycles`),
    INDEX `mp_limit_cycles_action`(`limit_cycles_action`(191)),
    INDEX `mp_limit_cycles_num`(`limit_cycles_num`),
    INDEX `mp_period`(`period`),
    INDEX `mp_period_type`(`period_type`),
    INDEX `mp_product_id`(`product_id`),
    INDEX `mp_prorated_trial`(`prorated_trial`),
    INDEX `mp_status`(`status`),
    INDEX `mp_subscr_id`(`subscr_id`(191)),
    INDEX `mp_token`(`token`),
    INDEX `mp_trial`(`trial`),
    INDEX `mp_trial_days`(`trial_days`),
    INDEX `mp_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_mepr_tax_rate_locations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tax_rate_id` BIGINT NOT NULL,
    `location_code` VARCHAR(200) NOT NULL,
    `location_type` VARCHAR(40) NOT NULL,

    INDEX `mp_location_code`(`location_code`(191)),
    INDEX `mp_location_type`(`location_type`),
    INDEX `mp_location_type_code`(`location_type`, `location_code`(191)),
    INDEX `mp_tax_rate_id`(`tax_rate_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_mepr_tax_rates` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tax_country` VARCHAR(255) NOT NULL DEFAULT '',
    `tax_state` VARCHAR(255) NOT NULL DEFAULT '',
    `tax_rate` VARCHAR(255) NOT NULL DEFAULT '',
    `tax_desc` VARCHAR(255) NOT NULL DEFAULT '',
    `tax_priority` BIGINT NOT NULL DEFAULT 0,
    `tax_compound` INTEGER NOT NULL DEFAULT 0,
    `tax_shipping` INTEGER NOT NULL DEFAULT 1,
    `tax_order` BIGINT NOT NULL,
    `tax_class` VARCHAR(255) NOT NULL DEFAULT 'standard',

    INDEX `mp_tax_class`(`tax_class`(191)),
    INDEX `mp_tax_compound`(`tax_compound`),
    INDEX `mp_tax_country`(`tax_country`(191)),
    INDEX `mp_tax_desc`(`tax_desc`(191)),
    INDEX `mp_tax_order`(`tax_order`),
    INDEX `mp_tax_priority`(`tax_priority`),
    INDEX `mp_tax_rate`(`tax_rate`(191)),
    INDEX `mp_tax_shipping`(`tax_shipping`),
    INDEX `mp_tax_state`(`tax_state`(191)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_mepr_transaction_meta` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `transaction_id` BIGINT NULL DEFAULT 0,
    `meta_key` VARCHAR(191) NULL,
    `meta_value` LONGTEXT NULL,

    INDEX `meta_key`(`meta_key`),
    INDEX `transaction_id`(`transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_mepr_transactions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `amount` DECIMAL(16, 2) NOT NULL,
    `total` DECIMAL(16, 2) NULL DEFAULT 0.00,
    `tax_amount` DECIMAL(16, 2) NULL DEFAULT 0.00,
    `tax_rate` DECIMAL(6, 3) NULL DEFAULT 0.000,
    `tax_desc` VARCHAR(255) NULL DEFAULT '',
    `tax_compound` INTEGER NULL DEFAULT 0,
    `tax_shipping` INTEGER NULL DEFAULT 1,
    `tax_class` VARCHAR(255) NULL DEFAULT 'standard',
    `user_id` BIGINT NOT NULL,
    `product_id` BIGINT NOT NULL,
    `coupon_id` BIGINT NULL,
    `trans_num` VARCHAR(255) NULL,
    `status` VARCHAR(255) NULL DEFAULT 'pending',
    `txn_type` VARCHAR(255) NULL DEFAULT 'payment',
    `response` TEXT NULL,
    `gateway` VARCHAR(255) NULL DEFAULT 'manual',
    `subscription_id` BIGINT NULL,
    `prorated` BOOLEAN NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL,
    `expires_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `corporate_account_id` BIGINT NULL DEFAULT 0,
    `parent_transaction_id` BIGINT NULL DEFAULT 0,

    INDEX `amount`(`amount`),
    INDEX `corporate_account_id`(`corporate_account_id`),
    INDEX `coupon_id`(`coupon_id`),
    INDEX `created_at`(`created_at`),
    INDEX `expires_at`(`expires_at`),
    INDEX `gateway`(`gateway`(191)),
    INDEX `parent_transaction_id`(`parent_transaction_id`),
    INDEX `product_id`(`product_id`),
    INDEX `prorated`(`prorated`),
    INDEX `status`(`status`(191)),
    INDEX `subscription_id`(`subscription_id`),
    INDEX `tax_amount`(`tax_amount`),
    INDEX `tax_class`(`tax_class`(191)),
    INDEX `tax_compound`(`tax_compound`),
    INDEX `tax_desc`(`tax_desc`(191)),
    INDEX `tax_rate`(`tax_rate`),
    INDEX `tax_shipping`(`tax_shipping`),
    INDEX `total`(`total`),
    INDEX `trans_num`(`trans_num`(191)),
    INDEX `txn_type`(`txn_type`(191)),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_options` (
    `option_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `option_name` VARCHAR(191) NOT NULL DEFAULT '',
    `option_value` LONGTEXT NOT NULL,
    `autoload` VARCHAR(20) NOT NULL DEFAULT 'yes',

    UNIQUE INDEX `option_name`(`option_name`),
    INDEX `autoload`(`autoload`),
    PRIMARY KEY (`option_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_postmeta` (
    `meta_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `post_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `meta_key` VARCHAR(191) NULL,
    `meta_value` LONGTEXT NULL,

    INDEX `meta_key`(`meta_key`),
    INDEX `post_id`(`post_id`),
    PRIMARY KEY (`meta_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_posts` (
    `ID` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `post_author` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `post_date` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `post_date_gmt` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `post_content` LONGTEXT NOT NULL,
    `post_title` TEXT NOT NULL,
    `post_excerpt` TEXT NOT NULL,
    `post_status` VARCHAR(20) NOT NULL DEFAULT 'publish',
    `comment_status` VARCHAR(20) NOT NULL DEFAULT 'open',
    `ping_status` VARCHAR(20) NOT NULL DEFAULT 'open',
    `post_password` VARCHAR(255) NOT NULL DEFAULT '',
    `post_name` VARCHAR(200) NOT NULL DEFAULT '',
    `to_ping` TEXT NOT NULL,
    `pinged` TEXT NOT NULL,
    `post_modified` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `post_modified_gmt` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `post_content_filtered` LONGTEXT NOT NULL,
    `post_parent` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `guid` VARCHAR(255) NOT NULL DEFAULT '',
    `menu_order` INTEGER NOT NULL DEFAULT 0,
    `post_type` VARCHAR(20) NOT NULL DEFAULT 'post',
    `post_mime_type` VARCHAR(100) NOT NULL DEFAULT '',
    `comment_count` BIGINT NOT NULL DEFAULT 0,

    INDEX `post_author`(`post_author`),
    INDEX `post_name`(`post_name`(191)),
    INDEX `post_parent`(`post_parent`),
    INDEX `type_status_date`(`post_type`, `post_status`, `post_date`, `ID`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_rank_math_analytics_inspections` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `page` VARCHAR(500) NOT NULL,
    `created` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `index_verdict` VARCHAR(64) NOT NULL,
    `indexing_state` VARCHAR(64) NOT NULL,
    `coverage_state` TEXT NOT NULL,
    `page_fetch_state` VARCHAR(64) NOT NULL,
    `robots_txt_state` VARCHAR(64) NOT NULL,
    `mobile_usability_verdict` VARCHAR(64) NOT NULL,
    `mobile_usability_issues` LONGTEXT NOT NULL,
    `rich_results_verdict` VARCHAR(64) NOT NULL,
    `rich_results_items` LONGTEXT NOT NULL,
    `last_crawl_time` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `crawled_as` VARCHAR(64) NOT NULL,
    `google_canonical` TEXT NOT NULL,
    `user_canonical` TEXT NOT NULL,
    `sitemap` TEXT NOT NULL,
    `referring_urls` LONGTEXT NOT NULL,
    `raw_api_response` LONGTEXT NOT NULL,

    INDEX `analytics_object_page`(`page`(190)),
    INDEX `created`(`created`),
    INDEX `index_verdict`(`index_verdict`),
    INDEX `mobile_usability_verdict`(`mobile_usability_verdict`),
    INDEX `page_fetch_state`(`page_fetch_state`),
    INDEX `rich_results_verdict`(`rich_results_verdict`),
    INDEX `robots_txt_state`(`robots_txt_state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_rank_math_analytics_objects` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `created` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `title` TEXT NOT NULL,
    `page` VARCHAR(500) NOT NULL,
    `object_type` VARCHAR(100) NOT NULL,
    `object_subtype` VARCHAR(100) NOT NULL,
    `object_id` BIGINT UNSIGNED NOT NULL,
    `primary_key` VARCHAR(255) NOT NULL,
    `seo_score` TINYINT NOT NULL DEFAULT 0,
    `page_score` TINYINT NOT NULL DEFAULT 0,
    `is_indexable` BOOLEAN NOT NULL DEFAULT true,
    `schemas_in_use` VARCHAR(500) NULL,
    `desktop_interactive` DOUBLE NULL DEFAULT 0,
    `desktop_pagescore` DOUBLE NULL DEFAULT 0,
    `mobile_interactive` DOUBLE NULL DEFAULT 0,
    `mobile_pagescore` DOUBLE NULL DEFAULT 0,
    `pagespeed_refreshed` TIMESTAMP(0) NULL,

    INDEX `analytics_object_page`(`page`(190)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_rank_math_internal_links` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `url` VARCHAR(255) NOT NULL,
    `post_id` BIGINT UNSIGNED NOT NULL,
    `target_post_id` BIGINT UNSIGNED NOT NULL,
    `type` VARCHAR(8) NOT NULL,

    INDEX `link_direction`(`post_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_rank_math_internal_meta` (
    `object_id` BIGINT UNSIGNED NOT NULL,
    `internal_link_count` INTEGER UNSIGNED NULL DEFAULT 0,
    `external_link_count` INTEGER UNSIGNED NULL DEFAULT 0,
    `incoming_link_count` INTEGER UNSIGNED NULL DEFAULT 0,

    PRIMARY KEY (`object_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_rank_math_redirections` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sources` TEXT NOT NULL,
    `url_to` TEXT NOT NULL,
    `header_code` SMALLINT UNSIGNED NOT NULL,
    `hits` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `status` VARCHAR(25) NOT NULL DEFAULT 'active',
    `created` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `last_accessed` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_rank_math_redirections_cache` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `from_url` TEXT NOT NULL,
    `redirection_id` BIGINT UNSIGNED NOT NULL,
    `object_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `object_type` VARCHAR(10) NOT NULL DEFAULT 'post',
    `is_redirected` BOOLEAN NOT NULL DEFAULT false,

    INDEX `redirection_id`(`redirection_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_sliper_elementor_cache` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `key` TEXT NOT NULL,
    `data` LONGTEXT NOT NULL,
    `updated_at` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_tcb_api_error_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(0) NULL,
    `error_message` VARCHAR(400) NULL,
    `api_data` TEXT NULL,
    `connection` VARCHAR(64) NULL,
    `list_id` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_td_fields` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `identifier` VARCHAR(32) NULL,
    `group_id` INTEGER NOT NULL,
    `name` TEXT NOT NULL,
    `type` INTEGER NOT NULL,
    `data` TEXT NULL,
    `is_default` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_td_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` TEXT NOT NULL,
    `is_default` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_term_relationships` (
    `object_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `term_taxonomy_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `term_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `term_taxonomy_id`(`term_taxonomy_id`),
    PRIMARY KEY (`object_id`, `term_taxonomy_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_term_taxonomy` (
    `term_taxonomy_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `term_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `taxonomy` VARCHAR(32) NOT NULL DEFAULT '',
    `description` LONGTEXT NOT NULL,
    `parent` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `count` BIGINT NOT NULL DEFAULT 0,

    INDEX `taxonomy`(`taxonomy`),
    UNIQUE INDEX `term_id_taxonomy`(`term_id`, `taxonomy`),
    PRIMARY KEY (`term_taxonomy_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_termmeta` (
    `meta_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `term_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `meta_key` VARCHAR(255) NULL,
    `meta_value` LONGTEXT NULL,

    INDEX `meta_key`(`meta_key`(191)),
    INDEX `term_id`(`term_id`),
    PRIMARY KEY (`meta_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_terms` (
    `term_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL DEFAULT '',
    `slug` VARCHAR(200) NOT NULL DEFAULT '',
    `term_group` BIGINT NOT NULL DEFAULT 0,

    INDEX `name`(`name`(191)),
    INDEX `slug`(`slug`(191)),
    PRIMARY KEY (`term_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_tm_taskmeta` (
    `meta_id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL DEFAULT 0,
    `meta_key` VARCHAR(255) NULL,
    `meta_value` LONGTEXT NULL,

    INDEX `meta_key`(`meta_key`(191)),
    INDEX `task_id`(`task_id`),
    PRIMARY KEY (`meta_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_tm_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `type` VARCHAR(300) NOT NULL,
    `class_identifier` VARCHAR(300) NULL DEFAULT '0',
    `attempts` INTEGER NULL DEFAULT 0,
    `description` VARCHAR(300) NULL,
    `time_created` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `last_locked_at` BIGINT NULL DEFAULT 0,
    `status` VARCHAR(300) NULL,

    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_tve_leads_contact_download` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(255) NULL,
    `download_link` VARCHAR(255) NULL,
    `date` DATETIME(0) NULL,
    `status` VARCHAR(64) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_tve_leads_contacts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `log_id` INTEGER NULL,
    `name` VARCHAR(255) NULL,
    `email` VARCHAR(255) NULL,
    `date` DATETIME(0) NULL,
    `custom_fields` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_tve_leads_event_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(0) NULL,
    `event_type` TINYINT NULL,
    `main_group_id` INTEGER NULL,
    `form_type_id` INTEGER NULL,
    `variation_key` INTEGER NULL,
    `user` VARCHAR(255) NULL,
    `ip` VARCHAR(40) NULL,
    `referrer` VARCHAR(255) NULL,
    `utm_source` VARCHAR(255) NULL,
    `utm_medium` VARCHAR(255) NULL,
    `utm_campaign` VARCHAR(255) NULL,
    `archived` BOOLEAN NULL DEFAULT false,
    `is_unique` BOOLEAN NULL DEFAULT false,
    `screen_type` TINYINT NULL,
    `screen_id` BIGINT NULL,

    INDEX `date`(`date`),
    INDEX `event_type`(`event_type`, `main_group_id`, `form_type_id`, `variation_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_tve_leads_form_summary` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` VARCHAR(10) NULL,
    `main_group_id` INTEGER NULL,
    `form_type_id` INTEGER NULL,
    `variation_key` INTEGER NULL,
    `impression_count` INTEGER NULL DEFAULT 0,
    `unique_visitor_count` INTEGER NULL DEFAULT 0,
    `conversion_count` INTEGER NULL DEFAULT 0,

    INDEX `date`(`date`),
    INDEX `variation_key`(`variation_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_tve_leads_form_variations` (
    `key` BIGINT NOT NULL AUTO_INCREMENT,
    `date_added` DATETIME(0) NULL,
    `date_modified` DATETIME(0) NULL,
    `post_parent` BIGINT NULL,
    `post_status` VARCHAR(20) NULL DEFAULT 'publish',
    `post_title` TEXT NULL,
    `content` LONGTEXT NULL,
    `trigger` VARCHAR(64) NULL,
    `trigger_config` TEXT NULL,
    `tcb_fields` LONGTEXT NULL,
    `display_frequency` INTEGER NULL DEFAULT 0,
    `display_animation` VARCHAR(64) NULL DEFAULT 'instant',
    `position` VARCHAR(32) NULL,
    `form_state` VARCHAR(64) NULL,
    `parent_id` INTEGER NULL DEFAULT 0,
    `state_order` INTEGER NULL DEFAULT 0,
    `cache_impressions` BIGINT NULL,
    `cache_conversions` BIGINT NULL,

    INDEX `parent_id`(`parent_id`),
    INDEX `post_parent`(`post_parent`),
    INDEX `post_status`(`post_status`),
    INDEX `state_order`(`state_order`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_tve_leads_group_options` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `group` INTEGER NOT NULL,
    `description` VARCHAR(255) NULL,
    `show_group_options` LONGTEXT NULL,
    `hide_group_options` LONGTEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_tve_leads_saved_group_options` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `show_group_options` LONGTEXT NULL,
    `hide_group_options` LONGTEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_tve_leads_split_test` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `test_type` INTEGER NULL,
    `main_group_id` INTEGER NULL,
    `date_added` DATETIME(0) NULL,
    `date_started` DATETIME(0) NULL,
    `date_completed` DATETIME(0) NULL,
    `title` VARCHAR(128) NULL,
    `notes` TINYTEXT NULL,
    `auto_win_enabled` INTEGER NULL DEFAULT 0,
    `auto_win_min_conversions` INTEGER NULL,
    `auto_win_min_duration` INTEGER NULL,
    `auto_win_chance_original` DOUBLE NULL,
    `status` ENUM('created', 'running', 'completed', 'archived') NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_tve_leads_split_test_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `test_id` INTEGER NULL,
    `main_group_id` INTEGER NULL,
    `form_type_id` INTEGER NULL,
    `variation_key` INTEGER NULL,
    `is_control` INTEGER NULL DEFAULT 0,
    `is_winner` INTEGER NULL DEFAULT 0,
    `impressions` INTEGER NULL DEFAULT 0,
    `unique_impressions` INTEGER NULL DEFAULT 0,
    `conversions` INTEGER NULL DEFAULT 0,
    `active` TINYINT NOT NULL DEFAULT 1,
    `stopped_date` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_userfeedback_surveys` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(128) NULL,
    `status` ENUM('publish', 'draft', 'trash') NULL DEFAULT 'draft',
    `questions` LONGTEXT NULL,
    `impressions` BIGINT NOT NULL DEFAULT 0,
    `settings` TEXT NULL,
    `notifications` TEXT NULL,
    `publish_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_usermeta` (
    `umeta_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `meta_key` VARCHAR(255) NULL,
    `meta_value` LONGTEXT NULL,

    INDEX `meta_key`(`meta_key`(191)),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`umeta_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_users` (
    `ID` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_login` VARCHAR(60) NOT NULL DEFAULT '',
    `user_pass` VARCHAR(255) NOT NULL DEFAULT '',
    `user_nicename` VARCHAR(50) NOT NULL DEFAULT '',
    `user_email` VARCHAR(100) NOT NULL DEFAULT '',
    `user_url` VARCHAR(100) NOT NULL DEFAULT '',
    `user_registered` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `user_activation_key` VARCHAR(255) NOT NULL DEFAULT '',
    `user_status` INTEGER NOT NULL DEFAULT 0,
    `display_name` VARCHAR(250) NOT NULL DEFAULT '',

    INDEX `user_email`(`user_email`),
    INDEX `user_login_key`(`user_login`),
    INDEX `user_nicename`(`user_nicename`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_wap_nex_forms_temp_report` (
    `Id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    PRIMARY KEY (`Id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_wcpdf_invoice_number` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NULL,
    `date` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `calculated_number` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_wpforms_entries` (
    `entry_id` BIGINT NOT NULL AUTO_INCREMENT,
    `form_id` BIGINT NOT NULL,
    `post_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `status` VARCHAR(30) NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `viewed` BOOLEAN NULL DEFAULT false,
    `starred` BOOLEAN NULL DEFAULT false,
    `fields` LONGTEXT NOT NULL,
    `meta` LONGTEXT NOT NULL,
    `date` DATETIME(0) NOT NULL,
    `date_modified` DATETIME(0) NOT NULL,
    `ip_address` VARCHAR(128) NOT NULL,
    `user_agent` VARCHAR(256) NOT NULL,
    `user_uuid` VARCHAR(36) NOT NULL,

    INDEX `form_id`(`form_id`),
    PRIMARY KEY (`entry_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_wpforms_entry_fields` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `entry_id` BIGINT NOT NULL,
    `form_id` BIGINT NOT NULL,
    `field_id` INTEGER NOT NULL,
    `value` LONGTEXT NOT NULL,
    `date` DATETIME(0) NOT NULL,

    INDEX `entry_id`(`entry_id`),
    INDEX `field_id`(`field_id`),
    INDEX `form_id`(`form_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_wpforms_entry_meta` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `entry_id` BIGINT NOT NULL,
    `form_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `status` VARCHAR(30) NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `data` LONGTEXT NOT NULL,
    `date` DATETIME(0) NOT NULL,

    INDEX `entry_id`(`entry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_yoast_indexable_hierarchy` (
    `indexable_id` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `ancestor_id` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `depth` INTEGER UNSIGNED NULL,
    `blog_id` BIGINT NOT NULL DEFAULT 1,

    INDEX `ancestor_id`(`ancestor_id`),
    INDEX `depth`(`depth`),
    INDEX `indexable_id`(`indexable_id`),
    PRIMARY KEY (`indexable_id`, `ancestor_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_yoast_migrations` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `version` VARCHAR(191) NULL,

    UNIQUE INDEX `mod180_yoast_migrations_version`(`version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_yoast_primary_term` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `post_id` BIGINT NULL,
    `term_id` BIGINT NULL,
    `taxonomy` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `blog_id` BIGINT NOT NULL DEFAULT 1,

    INDEX `post_taxonomy`(`post_id`, `taxonomy`),
    INDEX `post_term`(`post_id`, `term_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_yoast_prominent_words` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `stem` VARCHAR(191) NULL,
    `indexable_id` INTEGER UNSIGNED NULL,
    `weight` FLOAT NULL,

    INDEX `indexable_id`(`indexable_id`),
    INDEX `indexable_id_and_stem`(`indexable_id`, `stem`),
    INDEX `stem`(`stem`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_yoast_seo_links` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `url` VARCHAR(255) NOT NULL,
    `post_id` BIGINT UNSIGNED NOT NULL,
    `target_post_id` BIGINT UNSIGNED NOT NULL,
    `type` VARCHAR(8) NOT NULL,
    `indexable_id` INTEGER UNSIGNED NULL,
    `target_indexable_id` INTEGER UNSIGNED NULL,
    `height` INTEGER UNSIGNED NULL,
    `width` INTEGER UNSIGNED NULL,
    `size` INTEGER UNSIGNED NULL,
    `language` VARCHAR(32) NULL,
    `region` VARCHAR(32) NULL,

    INDEX `indexable_link_direction`(`indexable_id`, `type`),
    INDEX `link_direction`(`post_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mod180_yoast_seo_meta` (
    `object_id` BIGINT UNSIGNED NOT NULL,
    `internal_link_count` INTEGER UNSIGNED NULL,
    `incoming_link_count` INTEGER UNSIGNED NULL,

    UNIQUE INDEX `object_id`(`object_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
