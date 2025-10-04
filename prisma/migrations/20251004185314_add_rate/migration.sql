-- CreateTable
CREATE TABLE "Rate" (
    "id" TEXT NOT NULL,
    "raw" DECIMAL(14,4) NOT NULL,
    "ema" DECIMAL(14,4) NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rate_createdAt_idx" ON "Rate"("createdAt");
