-- AlterTable
ALTER TABLE `tournament` ADD COLUMN `type` VARCHAR(10) NOT NULL DEFAULT 'open';

-- CreateTable
CREATE TABLE `TournamentRegistration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tournamentId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'pending',
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `TournamentRegistration_tournamentId_index`(`tournamentId`),
    INDEX `TournamentRegistration_userId_index`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TournamentRegistration` ADD CONSTRAINT `TournamentRegistration_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `tournament`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentRegistration` ADD CONSTRAINT `TournamentRegistration_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
