SET @reservation_has_subject := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Reservation'
    AND COLUMN_NAME = 'subject'
);

SET @reservation_stmt := IF(
  @reservation_has_subject = 0,
  'ALTER TABLE `Reservation` ADD COLUMN `subject` VARCHAR(191) NULL',
  'SELECT 1'
);

PREPARE reservation_stmt FROM @reservation_stmt;
EXECUTE reservation_stmt;
DEALLOCATE PREPARE reservation_stmt;

SET @recurrence_has_subject := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ReservationRecurrence'
    AND COLUMN_NAME = 'subject'
);

SET @recurrence_stmt := IF(
  @recurrence_has_subject = 0,
  'ALTER TABLE `ReservationRecurrence` ADD COLUMN `subject` VARCHAR(191) NULL',
  'SELECT 1'
);

PREPARE recurrence_stmt FROM @recurrence_stmt;
EXECUTE recurrence_stmt;
DEALLOCATE PREPARE recurrence_stmt;
