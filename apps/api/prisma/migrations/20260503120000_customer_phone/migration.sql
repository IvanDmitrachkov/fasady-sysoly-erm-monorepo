-- Поле появилось в schema.prisma раньше, чем в SQL миграциях.
ALTER TABLE "Customer" ADD COLUMN "phone" TEXT;
