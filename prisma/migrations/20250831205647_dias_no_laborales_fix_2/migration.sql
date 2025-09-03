/*
  Warnings:

  - You are about to drop the column `activo` on the `Dia_No_Laboral` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Dia_No_Laboral_empresaId_activo_idx";

-- AlterTable
ALTER TABLE "public"."Dia_No_Laboral" DROP COLUMN "activo";
