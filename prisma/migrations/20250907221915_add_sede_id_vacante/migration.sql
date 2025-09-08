/*
  Warnings:

  - A unique constraint covering the columns `[empresaId,procesoId,nombre,fechaInicio,departamentoId,sedeId,estado]` on the table `Vacante` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sedeId` to the `Vacante` table without a default value. This is not possible if the table is not empty.
  - Made the column `fechaInicio` on table `Vacante` required. This step will fail if there are existing NULL values in that column.
  - Made the column `departamentoId` on table `Vacante` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."Vacante" DROP CONSTRAINT "Vacante_departamentoId_fkey";

-- DropIndex
DROP INDEX "public"."Vacante_empresaId_procesoId_nombre_fechaInicio_departamento_key";

-- AlterTable
ALTER TABLE "public"."Vacante" ADD COLUMN     "sedeId" UUID NOT NULL,
ALTER COLUMN "fechaInicio" SET NOT NULL,
ALTER COLUMN "departamentoId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Vacante_empresaId_procesoId_nombre_fechaInicio_departamento_key" ON "public"."Vacante"("empresaId", "procesoId", "nombre", "fechaInicio", "departamentoId", "sedeId", "estado");

-- AddForeignKey
ALTER TABLE "public"."Vacante" ADD CONSTRAINT "Vacante_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "public"."Departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante" ADD CONSTRAINT "Vacante_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
