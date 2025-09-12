-- AlterTable
ALTER TABLE "public"."Vacante" ADD COLUMN     "recursos" TEXT;

-- CreateTable
CREATE TABLE "public"."Vacante_Etapa_Comentario" (
    "id" UUID NOT NULL,
    "vacanteEtapaId" UUID NOT NULL,
    "comentario" TEXT NOT NULL,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Vacante_Etapa_Comentario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vacante_Etapa_Comentario_vacanteEtapaId_idx" ON "public"."Vacante_Etapa_Comentario"("vacanteEtapaId");

-- AddForeignKey
ALTER TABLE "public"."Vacante_Etapa_Comentario" ADD CONSTRAINT "Vacante_Etapa_Comentario_vacanteEtapaId_fkey" FOREIGN KEY ("vacanteEtapaId") REFERENCES "public"."Vacante_Etapa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
