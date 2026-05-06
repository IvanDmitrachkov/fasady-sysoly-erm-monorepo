-- Create enum for order comment type
CREATE TABLE `OrderComment` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('NOTE', 'DEFECT', 'INCIDENT') NOT NULL DEFAULT 'NOTE',
    `text` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrderComment_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign keys
ALTER TABLE `OrderComment`
    ADD CONSTRAINT `OrderComment_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OrderComment`
    ADD CONSTRAINT `OrderComment_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
