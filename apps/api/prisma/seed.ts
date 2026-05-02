import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_STAGES } from "../src/lib/default-stages";

const prisma = new PrismaClient();

async function main() {
  for (const s of DEFAULT_STAGES) {
    await prisma.stage.upsert({
      where: { slug: s.slug },
      create: { ...s },
      update: { name: s.name, sortOrder: s.sortOrder, isComplete: s.isComplete },
    });
  }

  const demoCustomer = await prisma.customer.upsert({
    where: { id: "demo-customer-id" },
    create: { id: "demo-customer-id", name: "Демо заказчик" },
    update: { name: "Демо заказчик" },
  });

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
      customerId: demoCustomer.id,
    },
    update: {
      passwordHash: customerHash,
      role: Role.CUSTOMER,
      customerId: demoCustomer.id,
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
