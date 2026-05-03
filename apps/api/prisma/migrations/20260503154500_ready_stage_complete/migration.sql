UPDATE `Stage`
SET `isComplete` = TRUE
WHERE `slug` = 'ready';

UPDATE `Order` o
INNER JOIN `Stage` s ON s.`id` = o.`currentStageId`
SET o.`completedAt` = COALESCE(o.`completedAt`, o.`updatedAt`)
WHERE s.`slug` = 'ready'
  AND o.`deletedAt` IS NULL;
