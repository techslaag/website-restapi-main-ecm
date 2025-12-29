-- use your_database

CREATE TABLE IF NOT EXISTS `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


INSERT INTO `_prisma_migrations` (`id`,`checksum`,`finished_at`,`migration_name`,`logs`,`rolled_back_at`,`started_at`,`applied_steps_count`) VALUES ('7fc9773e-56ff-4ac3-b859-dfaed4907136','20873e1f5eb551f4fb46d400097a46fad1ad017e7e826f325dbf14bee356f300','2024-03-08 10:26:18.990','20240308102616_initial',NULL,NULL,'2024-03-08 10:26:16.050',1);

CALL modify_datetime_defaults('database_name');