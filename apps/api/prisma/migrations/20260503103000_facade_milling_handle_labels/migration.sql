-- Redefine Facade: тексты фрезеровки/ручки вместо FK; данные переносим по именам из справочников.
PRAGMA foreign_keys=OFF;
PRAGMA defer_foreign_keys=ON;

CREATE TABLE "new_Facade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '',
    "widthMm" REAL NOT NULL,
    "heightMm" REAL NOT NULL,
    "thicknessMm" REAL NOT NULL,
    "millingLabel" TEXT NOT NULL DEFAULT '',
    "coatingTypeId" TEXT NOT NULL,
    "handleLabel" TEXT,
    "handleLengthMm" REAL,
    "edgeRadius" REAL,
    "optionsExtra" TEXT,
    "basePrice" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Facade_coatingTypeId_fkey" FOREIGN KEY ("coatingTypeId") REFERENCES "CoatingType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Facade_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Facade" (
  "id", "orderId", "sortIndex", "color", "widthMm", "heightMm", "thicknessMm",
  "millingLabel", "coatingTypeId", "handleLabel", "handleLengthMm", "edgeRadius", "optionsExtra",
  "basePrice", "createdAt", "updatedAt"
)
SELECT
  f."id",
  f."orderId",
  f."sortIndex",
  f."color",
  f."widthMm",
  f."heightMm",
  f."thicknessMm",
  COALESCE((SELECT m."name" FROM "MillingType" m WHERE m."id" = f."millingTypeId"), ''),
  f."coatingTypeId",
  (SELECT h."name" FROM "HandleType" h WHERE h."id" = f."handleTypeId"),
  f."handleLengthMm",
  f."edgeRadius",
  f."optionsExtra",
  f."basePrice",
  f."createdAt",
  f."updatedAt"
FROM "Facade" f;

DROP TABLE "Facade";
ALTER TABLE "new_Facade" RENAME TO "Facade";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
