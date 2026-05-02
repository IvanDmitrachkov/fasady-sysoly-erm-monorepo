export async function writeAudit(prisma, userId, action, message, entityType, entityId) {
    await prisma.auditLog.create({
        data: { userId, action, message, entityType, entityId },
    });
}
//# sourceMappingURL=audit.js.map