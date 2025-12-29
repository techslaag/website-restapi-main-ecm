-- AlterTable
ALTER TABLE `Plan` ADD COLUMN `digitalBiweeklyVersion` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `digitalMagazineVersion` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `digitalSpecialIssuesVersion` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `physicalMagazineVersion` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `exclusivity` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `biweeklyDigitalPreview` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `magazineDigitalPreview` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `physicalBiweeklyVersion` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `physicalSpecialIssuesVersion` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `premiumPosts` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `specialIssuesDigitalPreview` BOOLEAN NOT NULL DEFAULT false;
