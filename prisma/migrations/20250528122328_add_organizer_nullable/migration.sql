-- AlterTable
ALTER TABLE `tournament` ADD COLUMN `organizer_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `tournament` ADD CONSTRAINT `tournament_organizer_id_fkey` FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
