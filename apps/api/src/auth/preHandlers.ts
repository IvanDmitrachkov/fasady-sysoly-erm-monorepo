import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@prisma/client";

export async function requireJwt(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

export function requireRoles(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (reply.sent) return;
    const payload = request.user as { sub: string; role: Role; customerId: string | null };
    if (!roles.includes(payload.role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  };
}

export function authUserId(request: FastifyRequest): string {
  return (request.user as { sub: string }).sub;
}

export function authPayload(request: FastifyRequest) {
  return request.user as { sub: string; role: Role; customerId: string | null };
}
