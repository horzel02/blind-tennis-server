-- CreateTable
CREATE TABLE `TournamentUserRole` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tournamentId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TournamentUserRole_tournamentId_idx`(`tournamentId`),
    INDEX `TournamentUserRole_userId_idx`(`userId`),
    UNIQUE INDEX `TournamentUserRole_tournamentId_userId_role_key`(`tournamentId`, `userId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TournamentUserRole` ADD CONSTRAINT `TournamentUserRole_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `tournament`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentUserRole` ADD CONSTRAINT `TournamentUserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
