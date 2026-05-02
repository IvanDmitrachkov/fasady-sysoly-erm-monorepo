-- Справочники фрезеровки / покрытия / ручки и переход Facade на FK.

CREATE TABLE "MillingType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerM2" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "MillingType_slug_key" ON "MillingType"("slug");

CREATE TABLE "CoatingType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerM2" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CoatingType_slug_key" ON "CoatingType"("slug");

CREATE TABLE "HandleType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerMeter" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "HandleType_slug_key" ON "HandleType"("slug");

INSERT INTO "MillingType" ("id", "slug", "name", "pricePerM2", "sortOrder", "active", "createdAt", "updatedAt") VALUES
('10000000-0000-4000-8000-000000000001', 'none', 'Без фрезеровки', 0, 0, 1, datetime('now'), datetime('now')),
('10000000-0000-4000-8000-000000000002', 'standard', 'Фрезеровка (типовая)', 2500, 10, 1, datetime('now'), datetime('now'));

INSERT INTO "CoatingType" ("id", "slug", "name", "pricePerM2", "sortOrder", "active", "createdAt", "updatedAt") VALUES
('11000000-0000-4000-8000-000000000001', 'none', 'Без отдельного покрытия', 0, 0, 1, datetime('now'), datetime('now')),
('11000000-0000-4000-8000-000000000002', 'standard', 'Покрытие (типовое)', 1800, 10, 1, datetime('now'), datetime('now'));

INSERT INTO "HandleType" ("id", "slug", "name", "pricePerMeter", "sortOrder", "active", "createdAt", "updatedAt") VALUES
('12000000-0000-4000-8000-000000000002', 'classic', 'Классическая', 8000, 10, 1, datetime('now'), datetime('now'));

CREATE TABLE "Facade_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '',
    "widthMm" REAL NOT NULL,
    "heightMm" REAL NOT NULL,
    "thicknessMm" REAL NOT NULL,
    "millingTypeId" TEXT NOT NULL,
    "coatingTypeId" TEXT NOT NULL,
    "handleTypeId" TEXT,
    "handleLengthMm" REAL,
    "edgeRadius" REAL,
    "optionsExtra" TEXT,
    "basePrice" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Facade_new_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Facade_new_millingTypeId_fkey" FOREIGN KEY ("millingTypeId") REFERENCES "MillingType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Facade_new_coatingTypeId_fkey" FOREIGN KEY ("coatingTypeId") REFERENCES "CoatingType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Facade_new_handleTypeId_fkey" FOREIGN KEY ("handleTypeId") REFERENCES "HandleType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "Facade_new" (
    "id", "orderId", "sortIndex", "color", "widthMm", "heightMm", "thicknessMm",
    "millingTypeId", "coatingTypeId", "handleTypeId", "handleLengthMm",
    "edgeRadius", "optionsExtra", "basePrice", "createdAt", "updatedAt"
)
SELECT
    f."id",
    f."orderId",
    f."sortIndex",
    f."color",
    f."widthMm",
    f."heightMm",
    f."thicknessMm",
    CASE WHEN TRIM(COALESCE(f."milling", '')) = '' THEN '10000000-0000-4000-8000-000000000001' ELSE '10000000-0000-4000-8000-000000000002' END,
    CASE WHEN TRIM(COALESCE(f."coating", '')) = '' THEN '11000000-0000-4000-8000-000000000001' ELSE '11000000-0000-4000-8000-000000000002' END,
    CASE WHEN f."integratedHandle" != 0 THEN '12000000-0000-4000-8000-000000000002' ELSE NULL END,
    CASE WHEN f."integratedHandle" != 0 THEN 800.0 ELSE NULL END,
    f."edgeRadius",
    f."optionsExtra",
    f."basePrice",
    f."createdAt",
    f."updatedAt"
FROM "Facade" AS f;

DROP TABLE "Facade";
ALTER TABLE "Facade_new" RENAME TO "Facade";
