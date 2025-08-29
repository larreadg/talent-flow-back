-- CreateEnum
CREATE TYPE "public"."VacanteEstado" AS ENUM ('abierta', 'pausada', 'cerrada', 'cancelada');

-- CreateEnum
CREATE TYPE "public"."VacanteEtapaEstado" AS ENUM ('pendiente', 'en_progreso', 'cumplida', 'vencida', 'omitida');

-- CreateTable
CREATE TABLE "public"."Etapa" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "slaDias" INTEGER NOT NULL,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Vacante" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "sedeId" UUID,
    "departamentoId" UUID,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "estado" "public"."VacanteEstado" NOT NULL DEFAULT 'abierta',
    "fechaInicio" TIMESTAMPTZ(6),
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Vacante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Vacante_Etapa" (
    "id" UUID NOT NULL,
    "vacanteId" UUID NOT NULL,
    "etapaId" UUID NOT NULL,
    "departamentoId" UUID,
    "orden" INTEGER NOT NULL,
    "slaDias" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMPTZ(6),
    "fechaFinPlan" TIMESTAMPTZ(6),
    "fechaCumplimiento" TIMESTAMPTZ(6),
    "retrasoDias" INTEGER,
    "estado" "public"."VacanteEtapaEstado" NOT NULL DEFAULT 'pendiente',
    "comentarios" TEXT,
    "recursos" TEXT,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Vacante_Etapa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Etapa_empresaId_idx" ON "public"."Etapa"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Etapa_empresaId_nombre_key" ON "public"."Etapa"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "Vacante_empresaId_idx" ON "public"."Vacante"("empresaId");

-- CreateIndex
CREATE INDEX "Vacante_empresaId_activo_idx" ON "public"."Vacante"("empresaId", "activo");

-- CreateIndex
CREATE INDEX "Vacante_empresaId_estado_idx" ON "public"."Vacante"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "Vacante_empresaId_fechaInicio_idx" ON "public"."Vacante"("empresaId", "fechaInicio");

-- CreateIndex
CREATE INDEX "Vacante_Etapa_vacanteId_idx" ON "public"."Vacante_Etapa"("vacanteId");

-- CreateIndex
CREATE INDEX "Vacante_Etapa_etapaId_idx" ON "public"."Vacante_Etapa"("etapaId");

-- CreateIndex
CREATE INDEX "Vacante_Etapa_departamentoId_idx" ON "public"."Vacante_Etapa"("departamentoId");

-- CreateIndex
CREATE INDEX "Vacante_Etapa_estado_idx" ON "public"."Vacante_Etapa"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Vacante_Etapa_vacanteId_orden_key" ON "public"."Vacante_Etapa"("vacanteId", "orden");

-- AddForeignKey
ALTER TABLE "public"."Etapa" ADD CONSTRAINT "Etapa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante" ADD CONSTRAINT "Vacante_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante" ADD CONSTRAINT "Vacante_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante" ADD CONSTRAINT "Vacante_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "public"."Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante_Etapa" ADD CONSTRAINT "Vacante_Etapa_vacanteId_fkey" FOREIGN KEY ("vacanteId") REFERENCES "public"."Vacante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante_Etapa" ADD CONSTRAINT "Vacante_Etapa_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "public"."Etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante_Etapa" ADD CONSTRAINT "Vacante_Etapa_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "public"."Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
