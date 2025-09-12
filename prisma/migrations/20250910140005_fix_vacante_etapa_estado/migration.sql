/*
  Warnings:

  - You are about to drop the column `comentarios` on the `Vacante_Etapa` table. All the data in the column will be lost.
  - You are about to drop the column `recursos` on the `Vacante_Etapa` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."VacanteEtapaEstado" AS ENUM ('abierta', 'pendiente', 'finalizada');

-- AlterTable
ALTER TABLE "public"."Vacante_Etapa" DROP COLUMN "comentarios",
DROP COLUMN "recursos",
ADD COLUMN     "estado" "public"."VacanteEtapaEstado" NOT NULL DEFAULT 'pendiente';
