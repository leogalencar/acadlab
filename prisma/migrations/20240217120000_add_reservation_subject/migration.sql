ALTER TABLE `Reservation`
    ADD COLUMN `subject` VARCHAR(191) NULL;

ALTER TABLE `ReservationRecurrence`
    ADD COLUMN `subject` VARCHAR(191) NULL;
