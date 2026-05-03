const command = process.argv[2] ?? "this command";

console.error(
  [
    `${command} is disabled for the shared database workflow.`,
    "",
    "Do not apply Prisma schema changes from a local machine.",
    "Create and commit migration files, then let CI/CD run db:baseline and db:migrate:deploy.",
  ].join("\n"),
);

process.exit(1);
