/*
  Warnings:

  - Made the column `category` on table `tournament` required. This step will fail if there are existing NULL values in that column.
  - Made the column `city` on table `tournament` required. This step will fail if there are existing NULL values in that column.
  - Made the column `country` on table `tournament` required. This step will fail if there are existing NULL values in that column.
  - Made the column `gender` on table `tournament` required. This step will fail if there are existing NULL values in that column.
  - Made the column `postalCode` on table `tournament` required. This step will fail if there are existing NULL values in that column.
  - Made the column `street` on table `tournament` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `tournament` MODIFY `category` VARCHAR(10) NOT NULL,
    MODIFY `city` VARCHAR(100) NOT NULL,
    MODIFY `country` VARCHAR(100) NOT NULL,
    MODIFY `gender` VARCHAR(10) NOT NULL,
    MODIFY `postalCode` VARCHAR(10) NOT NULL,
    MODIFY `street` VARCHAR(255) NOT NULL;
