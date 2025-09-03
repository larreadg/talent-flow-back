/*
  Warnings:

  - A unique constraint covering the columns `[empresaId,nombre,fecha]` on the table `Dia_No_Laboral` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "Dia_No_Laboral_tipo_nombre_fecha_idx" ON "public"."Dia_No_Laboral"("tipo", "nombre", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Dia_No_Laboral_empresaId_nombre_fecha_key" ON "public"."Dia_No_Laboral"("empresaId", "nombre", "fecha");
