/*
  Warnings:

  - You are about to drop the column `aumento_dotacion` on the `Vacante` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Vacante" DROP COLUMN "aumento_dotacion",
ADD COLUMN     "aumentoDotacion" BOOLEAN NOT NULL DEFAULT false;
