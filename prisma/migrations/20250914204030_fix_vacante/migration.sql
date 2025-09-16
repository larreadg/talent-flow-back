-- CreateEnum
CREATE TYPE "public"."Tipo" AS ENUM ('reclutamiento', 'solicitante');

-- CreateEnum
CREATE TYPE "public"."VacanteResultado" AS ENUM ('promocion_interna', 'traslado', 'contratacion_externa');

-- AlterTable
ALTER TABLE "public"."Vacante" ADD COLUMN     "aumento_dotacion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resultado" "public"."VacanteResultado";
