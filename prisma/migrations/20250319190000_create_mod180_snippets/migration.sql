CREATE TABLE `mod180_snippets` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `code` TEXT,
  `tags` TEXT,
  `scope` VARCHAR(100),
  `priority` INT,
  `active` INT DEFAULT 1,
  `modified` DATETIME(3),
  `revision` INT DEFAULT 1,
  `cloud_id` VARCHAR(191),
  PRIMARY KEY (`id`)
);
