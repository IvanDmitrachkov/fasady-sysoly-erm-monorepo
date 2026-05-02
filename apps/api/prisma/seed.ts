import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin123!", 10);

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    create: {
      email: "admin@example.com",
      passwordHash,
      role: Role.ADMIN,
    },
    update: { passwordHash, role: Role.ADMIN },
  });

  const workerHash = await bcrypt.hash("Worker123!", 10);
  await prisma.user.upsert({
    where: { email: "worker@example.com" },
    create: {
      email: "worker@example.com",
      passwordHash: workerHash,
      role: Role.WORKER,
    },
    update: { passwordHash: workerHash, role: Role.WORKER },
  });

  const customerHash = await bcrypt.hash("Customer123!", 10);
  await prisma.user.upsert({
    where: { email: "customer@example.com" },
    create: {
      email: "customer@example.com",
      passwordHash: customerHash,
      role: Role.CUSTOMER,
      customerId: "demo-customer",
    },
    update: {
      passwordHash: customerHash,
      role: Role.CUSTOMER,
      customerId: "demo-customer",
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
