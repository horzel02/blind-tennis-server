/*
  Warnings:

  - Made the column `organizer_id` on table `tournament` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `tournament` DROP FOREIGN KEY `tournament_organizer_id_fkey`;

-- DropIndex
DROP INDEX `tournament_organizer_id_fkey` ON `tournament`;

-- AlterTable
ALTER TABLE `tournament` MODIFY `organizer_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `tournament` ADD CONSTRAINT `tournament_organizer_id_fkey` FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
