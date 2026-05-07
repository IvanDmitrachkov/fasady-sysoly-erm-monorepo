ALTER TABLE `TimeEntry`
  ADD COLUMN `startedAt` DATETIME(3) NULL,
  ADD COLUMN `endedAt` DATETIME(3) NULL;

CREATE INDEX `TimeEntry_orderId_startedAt_idx` ON `TimeEntry`(`orderId`, `startedAt`);
CREATE INDEX `TimeEntry_orderId_endedAt_idx` ON `TimeEntry`(`orderId`, `endedAt`);

UPDATE `TimeEntry`
SET `startedAt` = `workedAt`,
    `endedAt` = `workedAt`
WHERE `startedAt` IS NULL;
