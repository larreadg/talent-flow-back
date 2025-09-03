/*
  Warnings:

  - You are about to drop the `Etapa` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Vacante` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Vacante_Etapa` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Etapa" DROP CONSTRAINT "Etapa_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Vacante" DROP CONSTRAINT "Vacante_departamentoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Vacante" DROP CONSTRAINT "Vacante_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Vacante" DROP CONSTRAINT "Vacante_sedeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Vacante_Etapa" DROP CONSTRAINT "Vacante_Etapa_departamentoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Vacante_Etapa" DROP CONSTRAINT "Vacante_Etapa_etapaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Vacante_Etapa" DROP CONSTRAINT "Vacante_Etapa_vacanteId_fkey";

-- DropTable
DROP TABLE "public"."Etapa";

-- DropTable
DROP TABLE "public"."Vacante";

-- DropTable
DROP TABLE "public"."Vacante_Etapa";

-- DropEnum
DROP TYPE "public"."VacanteEstado";

-- DropEnum
DROP TYPE "public"."VacanteEtapaEstado";
