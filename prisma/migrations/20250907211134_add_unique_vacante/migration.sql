/*
  Warnings:

  - A unique constraint covering the columns `[empresaId,procesoId,nombre,fechaInicio,departamentoId,estado]` on the table `Vacante` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Vacante_empresaId_procesoId_nombre_fechaInicio_departamento_key" ON "public"."Vacante"("empresaId", "procesoId", "nombre", "fechaInicio", "departamentoId", "estado");
