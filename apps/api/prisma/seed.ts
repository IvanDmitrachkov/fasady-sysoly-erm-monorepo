import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resolveSqliteDatabaseUrl } from "../src/lib/database-url.js";
import { DEFAULT_ORDER_WORK_STATES } from "../src/lib/default-order-work-states";
import { DEFAULT_STAGES } from "../src/lib/default-stages";

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = resolveSqliteDatabaseUrl(process.env.DATABASE_URL);
}

const prisma = new PrismaClient();

async function main() {
  for (const s of DEFAULT_STAGES) {
    await prisma.stage.upsert({
      where: { slug: s.slug },
      create: { ...s },
      update: { name: s.name, sortOrder: s.sortOrder, isComplete: s.isComplete, allowWorkStates: s.allowWorkStates },
    });
  }

  for (const w of DEFAULT_ORDER_WORK_STATES) {
    await prisma.orderWorkState.upsert({
      where: { slug: w.slug },
      create: { id: w.id, slug: w.slug, name: w.name, sortOrder: w.sortOrder },
      update: { name: w.name, sortOrder: w.sortOrder },
    });
  }

  const millingTypes = [
    ["straight", "Прямой"],
    ["premier", "Премьер"],
    ["wave-1", "Волна 1"],
    ["wave-2", "Волна 2"],
    ["step", "Степ"],
    ["baden", "Баден"],
    ["kant", "Кант"],
    ["reiki", "Рейки"],
    ["capriccio", "Капричо"],
    ["brilon", "Брилон"],
    ["albero", "Альберо"],
    ["cone-sampling", "Выборка с конусом"],
    ["sampling", "Выборка"],
    ["forest", "Лес"],
  ] as const;
  for (const [i, [slug, name]] of millingTypes.entries()) {
    await prisma.millingType.upsert({
      where: { slug },
      create: { slug, name, pricePerM2: 0, sortOrder: i * 10, active: true },
      update: { name, sortOrder: i * 10, active: true },
    });
  }

  const coatingTypes = [
    ["enamel", "Эмаль"],
    ["film", "Пленка"],
  ] as const;
  for (const [i, [slug, name]] of coatingTypes.entries()) {
    await prisma.coatingType.upsert({
      where: { slug },
      create: { slug, name, pricePerM2: 0, sortOrder: i * 10, active: true },
      update: { name, sortOrder: i * 10, active: true },
    });
  }

  const handleTypes = [
    ["none", "Нет"],
    ["l-height", "L, по высоте"],
    ["u-height", "U, по высоте"],
    ["c-height", "C, по высоте"],
    ["l-width", "L, по ширине"],
    ["u-width", "U, по ширине"],
    ["c-width", "C, по ширине"],
  ] as const;
  for (const [i, [slug, name]] of handleTypes.entries()) {
    await prisma.handleType.upsert({
      where: { slug },
      create: { slug, name, pricePerMeter: 0, sortOrder: i * 10, active: true },
      update: { name, sortOrder: i * 10, active: true },
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
      firstName: "Админ",
      lastName: "Демо",
    },
    update: {
      passwordHash,
      role: Role.ADMIN,
      firstName: "Админ",
      lastName: "Демо",
    },
  });

  const workerHash = await bcrypt.hash("Worker123!", 10);
  await prisma.user.upsert({
    where: { email: "worker@example.com" },
    create: {
      email: "worker@example.com",
      passwordHash: workerHash,
      role: Role.WORKER,
      firstName: "Иван",
      lastName: "Цехов",
      patronymic: "Петрович",
    },
    update: {
      passwordHash: workerHash,
      role: Role.WORKER,
      firstName: "Иван",
      lastName: "Цехов",
      patronymic: "Петрович",
    },
  });

  const customerHash = await bcrypt.hash("Customer123!", 10);
  await prisma.user.upsert({
    where: { email: "customer@example.com" },
    create: {
      email: "customer@example.com",
      passwordHash: customerHash,
      role: Role.CUSTOMER,
      customerId: demoCustomer.id,
      firstName: "Мария",
      lastName: "Заказчикова",
    },
    update: {
      passwordHash: customerHash,
      role: Role.CUSTOMER,
      customerId: demoCustomer.id,
      firstName: "Мария",
      lastName: "Заказчикова",
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
