-- SQLite: добавляем поля, переносим из старой строки «ширина×высота» где возможно, убираем dimensionsMm.
ALTER TABLE "Facade" ADD COLUMN "widthMm" REAL;
ALTER TABLE "Facade" ADD COLUMN "heightMm" REAL;

UPDATE "Facade"
SET
  "widthMm" = CASE
    WHEN instr(lower(replace(replace(replace(replace("dimensionsMm", '×', 'x'), 'х', 'x'), ' ', ''), 'мм', '')), 'x') > 0 THEN
      CAST(trim(substr(
        lower(replace(replace(replace(replace("dimensionsMm", '×', 'x'), 'х', 'x'), ' ', ''), 'мм', '')),
        1,
        instr(lower(replace(replace(replace(replace("dimensionsMm", '×', 'x'), 'х', 'x'), ' ', ''), 'мм', '')), 'x') - 1
      )) AS REAL)
    ELSE NULL
  END,
  "heightMm" = CASE
    WHEN instr(lower(replace(replace(replace(replace("dimensionsMm", '×', 'x'), 'х', 'x'), ' ', ''), 'мм', '')), 'x') > 0 THEN
      CAST(trim(substr(
        lower(replace(replace(replace(replace("dimensionsMm", '×', 'x'), 'х', 'x'), ' ', ''), 'мм', '')),
        instr(lower(replace(replace(replace(replace("dimensionsMm", '×', 'x'), 'х', 'x'), ' ', ''), 'мм', '')), 'x') + 1
      )) AS REAL)
    ELSE NULL
  END;

UPDATE "Facade" SET "widthMm" = 720, "heightMm" = 2000 WHERE "widthMm" IS NULL OR "heightMm" IS NULL OR "widthMm" <= 0 OR "heightMm" <= 0;

-- SQLite 3.35+: удалить старую колонку
CREATE TABLE "Facade_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "milling" TEXT NOT NULL DEFAULT '',
    "coating" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "widthMm" REAL NOT NULL,
    "heightMm" REAL NOT NULL,
    "thicknessMm" REAL NOT NULL,
    "integratedHandle" BOOLEAN NOT NULL DEFAULT false,
    "edgeRadius" REAL,
    "optionsExtra" TEXT,
    "basePrice" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Facade_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "Facade_new" (
    "id", "orderId", "sortIndex", "milling", "coating", "color", "widthMm", "heightMm",
    "thicknessMm", "integratedHandle", "edgeRadius", "optionsExtra", "basePrice", "createdAt", "updatedAt"
)
SELECT
    "id", "orderId", "sortIndex", "milling", "coating", "color", "widthMm", "heightMm",
    "thicknessMm", "integratedHandle", "edgeRadius", "optionsExtra", "basePrice", "createdAt", "updatedAt"
FROM "Facade";
DROP TABLE "Facade";
ALTER TABLE "Facade_new" RENAME TO "Facade";
