-- AlterTable
ALTER TABLE "public"."Vacante" ALTER COLUMN "fechaInicio" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "public"."Vacante_Etapa" ADD COLUMN     "comentarios" TEXT,
ADD COLUMN     "fechaCumplimiento" DATE,
ADD COLUMN     "fechaFinalizacion" DATE,
ADD COLUMN     "fechaInicio" DATE,
ADD COLUMN     "recursos" TEXT,
ADD COLUMN     "retrasoDias" INTEGER NOT NULL DEFAULT 0;
