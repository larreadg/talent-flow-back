-- CreateEnum
CREATE TYPE "public"."EtapaResponsable" AS ENUM ('reclutamiento', 'solicitante');

-- AlterTable
ALTER TABLE "public"."Proceso_Etapa" ADD COLUMN     "responsable" "public"."EtapaResponsable" NOT NULL DEFAULT 'solicitante';
