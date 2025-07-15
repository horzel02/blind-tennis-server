-- AlterTable
ALTER TABLE `tournamentregistration` ADD COLUMN `invitedBy` INTEGER NULL;

-- CreateIndex
CREATE INDEX `TournamentRegistration_invitedBy_idx` ON `TournamentRegistration`(`invitedBy`);
