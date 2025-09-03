/*
  Warnings:

  - You are about to drop the column `retrasoDias` on the `Vacante_Etapa` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."DiaNoLaboralTipo" AS ENUM ('nacional', 'empresa');

-- AlterTable
ALTER TABLE "public"."Vacante_Etapa" DROP COLUMN "retrasoDias";

-- CreateTable
CREATE TABLE "public"."Dia_No_Laboral" (
    "id" UUID NOT NULL,
    "tipo" "public"."DiaNoLaboralTipo" NOT NULL,
    "empresaId" UUID,
    "nombre" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Dia_No_Laboral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dia_No_Laboral_tipo_idx" ON "public"."Dia_No_Laboral"("tipo");

-- CreateIndex
CREATE INDEX "Dia_No_Laboral_empresaId_idx" ON "public"."Dia_No_Laboral"("empresaId");

-- CreateIndex
CREATE INDEX "Dia_No_Laboral_fecha_idx" ON "public"."Dia_No_Laboral"("fecha");

-- CreateIndex
CREATE INDEX "Dia_No_Laboral_empresaId_activo_idx" ON "public"."Dia_No_Laboral"("empresaId", "activo");

-- CreateIndex
CREATE INDEX "Vacante_empresaId_activo_idx" ON "public"."Vacante"("empresaId", "activo");

-- AddForeignKey
ALTER TABLE "public"."Dia_No_Laboral" ADD CONSTRAINT "Dia_No_Laboral_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
