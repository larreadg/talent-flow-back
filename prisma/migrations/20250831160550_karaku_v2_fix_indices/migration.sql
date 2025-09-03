/*
  Warnings:

  - A unique constraint covering the columns `[procesoId,etapaId]` on the table `Proceso_Etapa` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "Etapa_empresaId_activo_idx" ON "public"."Etapa"("empresaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Proceso_Etapa_procesoId_etapaId_key" ON "public"."Proceso_Etapa"("procesoId", "etapaId");
