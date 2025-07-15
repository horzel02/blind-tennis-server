/*
  Warnings:

  - You are about to drop the column `location` on the `tournament` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `tournament` DROP COLUMN `location`,
    ADD COLUMN `applicationsOpen` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `category` VARCHAR(10) NULL,
    ADD COLUMN `city` VARCHAR(100) NULL,
    ADD COLUMN `country` VARCHAR(100) NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `gender` VARCHAR(10) NULL,
    ADD COLUMN `participant_limit` INTEGER NULL,
    ADD COLUMN `postalCode` VARCHAR(10) NULL,
    ADD COLUMN `registration_deadline` DATETIME(3) NULL,
    ADD COLUMN `street` VARCHAR(255) NULL;
