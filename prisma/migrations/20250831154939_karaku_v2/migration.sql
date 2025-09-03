-- CreateEnum
CREATE TYPE "public"."VacanteEstado" AS ENUM ('abierta', 'pausada', 'cerrada', 'cancelada');

-- CreateTable
CREATE TABLE "public"."Etapa" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "slaDias" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Proceso" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Proceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Proceso_Etapa" (
    "id" UUID NOT NULL,
    "procesoId" UUID NOT NULL,
    "etapaId" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Proceso_Etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Vacante" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "procesoId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaInicio" TIMESTAMPTZ(6),
    "departamentoId" UUID,
    "estado" "public"."VacanteEstado" NOT NULL DEFAULT 'abierta',
    "activo" BOOLEAN NOT NULL DEFAULT true,
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
    "procesoEtapaId" UUID NOT NULL,
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
CREATE INDEX "Proceso_empresaId_activo_idx" ON "public"."Proceso"("empresaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Proceso_empresaId_nombre_key" ON "public"."Proceso"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "Proceso_Etapa_procesoId_idx" ON "public"."Proceso_Etapa"("procesoId");

-- CreateIndex
CREATE INDEX "Proceso_Etapa_etapaId_idx" ON "public"."Proceso_Etapa"("etapaId");

-- CreateIndex
CREATE UNIQUE INDEX "Proceso_Etapa_procesoId_orden_key" ON "public"."Proceso_Etapa"("procesoId", "orden");

-- CreateIndex
CREATE INDEX "Vacante_empresaId_idx" ON "public"."Vacante"("empresaId");

-- CreateIndex
CREATE INDEX "Vacante_empresaId_procesoId_idx" ON "public"."Vacante"("empresaId", "procesoId");

-- CreateIndex
CREATE INDEX "Vacante_empresaId_estado_idx" ON "public"."Vacante"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "Vacante_Etapa_vacanteId_idx" ON "public"."Vacante_Etapa"("vacanteId");

-- CreateIndex
CREATE INDEX "Vacante_Etapa_procesoEtapaId_idx" ON "public"."Vacante_Etapa"("procesoEtapaId");

-- CreateIndex
CREATE UNIQUE INDEX "Vacante_Etapa_vacanteId_procesoEtapaId_key" ON "public"."Vacante_Etapa"("vacanteId", "procesoEtapaId");

-- AddForeignKey
ALTER TABLE "public"."Etapa" ADD CONSTRAINT "Etapa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Proceso" ADD CONSTRAINT "Proceso_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Proceso_Etapa" ADD CONSTRAINT "Proceso_Etapa_procesoId_fkey" FOREIGN KEY ("procesoId") REFERENCES "public"."Proceso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Proceso_Etapa" ADD CONSTRAINT "Proceso_Etapa_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "public"."Etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante" ADD CONSTRAINT "Vacante_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante" ADD CONSTRAINT "Vacante_procesoId_fkey" FOREIGN KEY ("procesoId") REFERENCES "public"."Proceso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante" ADD CONSTRAINT "Vacante_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "public"."Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante_Etapa" ADD CONSTRAINT "Vacante_Etapa_vacanteId_fkey" FOREIGN KEY ("vacanteId") REFERENCES "public"."Vacante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante_Etapa" ADD CONSTRAINT "Vacante_Etapa_procesoEtapaId_fkey" FOREIGN KEY ("procesoEtapaId") REFERENCES "public"."Proceso_Etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
