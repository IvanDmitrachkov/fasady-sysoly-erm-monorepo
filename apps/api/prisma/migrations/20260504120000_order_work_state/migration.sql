-- CreateTable
CREATE TABLE `OrderWorkState` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OrderWorkState_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed (фиксированные id — совпадают с seed.ts upsert по id)
INSERT INTO `OrderWorkState` (`id`, `slug`, `name`, `sortOrder`, `createdAt`, `updatedAt`) VALUES
('ows-queue-0000-4000-8000-000000000001', 'queue', 'В очереди', 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('ows-inpr-0000-4000-8000-000000000002', 'in_progress', 'В работе', 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('ows-bloc-0000-4000-8000-000000000003', 'blocked', 'Заблокирован', 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('ows-read-0000-4000-8000-000000000004', 'ready', 'Готов на участке', 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `workStateId` VARCHAR(191) NULL;

-- Backfill
UPDATE `Order` o
SET o.`workStateId` = (SELECT w.`id` FROM `OrderWorkState` w WHERE w.`slug` = 'queue' LIMIT 1)
WHERE o.`workStateId` IS NULL;

-- AlterTable
ALTER TABLE `Order` MODIFY COLUMN `workStateId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_workStateId_fkey` FOREIGN KEY (`workStateId`) REFERENCES `OrderWorkState`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
