export async function requireJwt(request, reply) {
    try {
        await request.jwtVerify();
    }
    catch {
        return reply.code(401).send({ error: "Unauthorized" });
    }
}
export function requireRoles(...roles) {
    return async (request, reply) => {
        if (reply.sent)
            return;
        const payload = request.user;
        if (!roles.includes(payload.role)) {
            return reply.code(403).send({ error: "Forbidden" });
        }
    };
}
export function authUserId(request) {
    return request.user.sub;
}
export function authPayload(request) {
    return request.user;
}
//# sourceMappingURL=preHandlers.js.map