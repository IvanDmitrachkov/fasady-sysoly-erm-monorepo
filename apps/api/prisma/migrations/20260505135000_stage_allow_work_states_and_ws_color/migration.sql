ALTER TABLE `Stage`
  ADD COLUMN `allowWorkStates` BOOLEAN NOT NULL DEFAULT true;

UPDATE `Stage`
SET `allowWorkStates` = false
WHERE `slug` IN ('new', 'ready', 'ship');
