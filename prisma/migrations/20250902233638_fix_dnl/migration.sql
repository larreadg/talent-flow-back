/*
  Warnings:

  - Made the column `empresaId` on table `Dia_No_Laboral` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."Dia_No_Laboral" DROP CONSTRAINT "Dia_No_Laboral_empresaId_fkey";

-- AlterTable
ALTER TABLE "public"."Dia_No_Laboral" ALTER COLUMN "empresaId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Dia_No_Laboral" ADD CONSTRAINT "Dia_No_Laboral_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
