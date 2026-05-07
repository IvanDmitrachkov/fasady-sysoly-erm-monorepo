CREATE TABLE `OrderMaterialEntry` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `stageId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `unit` VARCHAR(191) NOT NULL,
  `quantity` DOUBLE NOT NULL,
  `comment` TEXT NULL,
  `usedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `OrderMaterialEntry_orderId_usedAt_idx`(`orderId`, `usedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OrderMaterialEntry`
  ADD CONSTRAINT `OrderMaterialEntry_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `OrderMaterialEntry_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `OrderMaterialEntry_stageId_fkey`
    FOREIGN KEY (`stageId`) REFERENCES `Stage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
