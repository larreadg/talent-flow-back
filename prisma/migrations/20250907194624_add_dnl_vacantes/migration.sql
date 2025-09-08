-- CreateTable
CREATE TABLE "public"."Vacante_Dia_No_Laboral" (
    "id" UUID NOT NULL,
    "vacanteId" UUID NOT NULL,
    "diaNoLaboralId" UUID NOT NULL,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Vacante_Dia_No_Laboral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vacante_Dia_No_Laboral_vacanteId_diaNoLaboralId_idx" ON "public"."Vacante_Dia_No_Laboral"("vacanteId", "diaNoLaboralId");

-- AddForeignKey
ALTER TABLE "public"."Vacante_Dia_No_Laboral" ADD CONSTRAINT "Vacante_Dia_No_Laboral_diaNoLaboralId_fkey" FOREIGN KEY ("diaNoLaboralId") REFERENCES "public"."Dia_No_Laboral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante_Dia_No_Laboral" ADD CONSTRAINT "Vacante_Dia_No_Laboral_vacanteId_fkey" FOREIGN KEY ("vacanteId") REFERENCES "public"."Vacante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
