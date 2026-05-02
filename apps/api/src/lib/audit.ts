import type { PrismaClient } from "@prisma/client";

export async function writeAudit(
  prisma: PrismaClient,
  userId: string,
  action: string,
  message: string,
  entityType?: string,
  entityId?: string,
) {
  await prisma.auditLog.create({
    data: { userId, action, message, entityType, entityId },
  });
}
