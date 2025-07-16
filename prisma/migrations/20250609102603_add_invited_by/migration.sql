-- AlterTable: dodajemy nullable invitedBy
ALTER TABLE `TournamentRegistration`
ADD COLUMN `invitedBy` INT NULL DEFAULT NULL;

-- CreateIndex: na tej samej tabeli
CREATE INDEX `TournamentRegistration_invitedBy_idx`
  ON `TournamentRegistration` (`invitedBy`);
