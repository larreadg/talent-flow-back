-- CreateEnum
CREATE TYPE "public"."UsuarioTokenTipo" AS ENUM ('activate_account', 'update_pass');

-- CreateEnum
CREATE TYPE "public"."VacanteEstado" AS ENUM ('abierta', 'pausada', 'finalizada', 'cancelada');

-- CreateEnum
CREATE TYPE "public"."VacanteEtapaEstado" AS ENUM ('abierta', 'pendiente', 'finalizada');

-- CreateEnum
CREATE TYPE "public"."EtapaResponsable" AS ENUM ('reclutamiento', 'solicitante');

-- CreateEnum
CREATE TYPE "public"."Tipo" AS ENUM ('reclutamiento', 'solicitante');

-- CreateEnum
CREATE TYPE "public"."VacanteResultado" AS ENUM ('promocion_interna', 'traslado', 'contratacion_externa');

-- CreateEnum
CREATE TYPE "public"."DiaNoLaboralTipo" AS ENUM ('nacional', 'empresa');

-- CreateTable
CREATE TABLE "public"."Empresa" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "razonSocial" TEXT,
    "ruc" TEXT,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Sede" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "region" TEXT,
    "pais" TEXT,
    "timezone" TEXT,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Departamento" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "parentId" UUID,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Departamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Usuario" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "rolId" UUID,
    "departamentoId" UUID,
    "sedeId" UUID,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT,
    "apellido" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMPTZ(6),
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Rol" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Captcha" (
    "id" UUID NOT NULL,
    "ip" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Captcha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Usuario_Token" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tipo" "public"."UsuarioTokenTipo" NOT NULL,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Usuario_Token_pkey" PRIMARY KEY ("id")
);

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
    "slaMaximoDias" SMALLINT,
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
    "responsable" "public"."EtapaResponsable" NOT NULL DEFAULT 'solicitante',
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
    "fechaInicio" DATE NOT NULL,
    "departamentoId" UUID NOT NULL,
    "sedeId" UUID NOT NULL,
    "estado" "public"."VacanteEstado" NOT NULL DEFAULT 'abierta',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "aumentoDotacion" BOOLEAN NOT NULL DEFAULT false,
    "resultado" "public"."VacanteResultado",
    "recursos" TEXT,
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
    "fechaInicio" DATE,
    "fechaFinalizacion" DATE,
    "fechaCumplimiento" DATE,
    "estado" "public"."VacanteEtapaEstado" NOT NULL DEFAULT 'pendiente',
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Vacante_Etapa_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "public"."Dia_No_Laboral" (
    "id" UUID NOT NULL,
    "tipo" "public"."DiaNoLaboralTipo" NOT NULL,
    "empresaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Dia_No_Laboral_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "Empresa_nombre_key" ON "public"."Empresa"("nombre");

-- CreateIndex
CREATE INDEX "Sede_empresaId_idx" ON "public"."Sede"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Sede_empresaId_nombre_key" ON "public"."Sede"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "Departamento_empresaId_parentId_idx" ON "public"."Departamento"("empresaId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Departamento_empresaId_nombre_key" ON "public"."Departamento"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "Usuario_empresaId_idx" ON "public"."Usuario"("empresaId");

-- CreateIndex
CREATE INDEX "Usuario_departamentoId_idx" ON "public"."Usuario"("departamentoId");

-- CreateIndex
CREATE INDEX "Usuario_sedeId_idx" ON "public"."Usuario"("sedeId");

-- CreateIndex
CREATE INDEX "Usuario_rolId_idx" ON "public"."Usuario"("rolId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_empresaId_username_key" ON "public"."Usuario"("empresaId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_empresaId_email_key" ON "public"."Usuario"("empresaId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_nombre_key" ON "public"."Rol"("nombre");

-- CreateIndex
CREATE INDEX "Captcha_ip_idx" ON "public"."Captcha"("ip");

-- CreateIndex
CREATE UNIQUE INDEX "Captcha_challenge_ip_key" ON "public"."Captcha"("challenge", "ip");

-- CreateIndex
CREATE INDEX "Usuario_Token_usuarioId_idx" ON "public"."Usuario_Token"("usuarioId");

-- CreateIndex
CREATE INDEX "Usuario_Token_expiresAt_idx" ON "public"."Usuario_Token"("expiresAt");

-- CreateIndex
CREATE INDEX "Usuario_Token_tipo_idx" ON "public"."Usuario_Token"("tipo");

-- CreateIndex
CREATE INDEX "Etapa_empresaId_activo_idx" ON "public"."Etapa"("empresaId", "activo");

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
CREATE UNIQUE INDEX "Proceso_Etapa_procesoId_etapaId_key" ON "public"."Proceso_Etapa"("procesoId", "etapaId");

-- CreateIndex
CREATE INDEX "Vacante_empresaId_idx" ON "public"."Vacante"("empresaId");

-- CreateIndex
CREATE INDEX "Vacante_empresaId_procesoId_idx" ON "public"."Vacante"("empresaId", "procesoId");

-- CreateIndex
CREATE INDEX "Vacante_empresaId_estado_idx" ON "public"."Vacante"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "Vacante_empresaId_activo_idx" ON "public"."Vacante"("empresaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Vacante_empresaId_procesoId_nombre_fechaInicio_departamento_key" ON "public"."Vacante"("empresaId", "procesoId", "nombre", "fechaInicio", "departamentoId", "sedeId", "estado");

-- CreateIndex
CREATE INDEX "Vacante_Etapa_vacanteId_idx" ON "public"."Vacante_Etapa"("vacanteId");

-- CreateIndex
CREATE INDEX "Vacante_Etapa_procesoEtapaId_idx" ON "public"."Vacante_Etapa"("procesoEtapaId");

-- CreateIndex
CREATE UNIQUE INDEX "Vacante_Etapa_vacanteId_procesoEtapaId_key" ON "public"."Vacante_Etapa"("vacanteId", "procesoEtapaId");

-- CreateIndex
CREATE INDEX "Vacante_Etapa_Comentario_vacanteEtapaId_idx" ON "public"."Vacante_Etapa_Comentario"("vacanteEtapaId");

-- CreateIndex
CREATE INDEX "Dia_No_Laboral_tipo_idx" ON "public"."Dia_No_Laboral"("tipo");

-- CreateIndex
CREATE INDEX "Dia_No_Laboral_empresaId_idx" ON "public"."Dia_No_Laboral"("empresaId");

-- CreateIndex
CREATE INDEX "Dia_No_Laboral_fecha_idx" ON "public"."Dia_No_Laboral"("fecha");

-- CreateIndex
CREATE INDEX "Dia_No_Laboral_tipo_nombre_fecha_idx" ON "public"."Dia_No_Laboral"("tipo", "nombre", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Dia_No_Laboral_empresaId_nombre_fecha_key" ON "public"."Dia_No_Laboral"("empresaId", "nombre", "fecha");

-- CreateIndex
CREATE INDEX "Vacante_Dia_No_Laboral_vacanteId_diaNoLaboralId_idx" ON "public"."Vacante_Dia_No_Laboral"("vacanteId", "diaNoLaboralId");

-- AddForeignKey
ALTER TABLE "public"."Sede" ADD CONSTRAINT "Sede_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Departamento" ADD CONSTRAINT "Departamento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Departamento" ADD CONSTRAINT "Departamento_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "public"."Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "public"."Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario_Token" ADD CONSTRAINT "Usuario_Token_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "public"."Vacante" ADD CONSTRAINT "Vacante_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "public"."Departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante" ADD CONSTRAINT "Vacante_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante_Etapa" ADD CONSTRAINT "Vacante_Etapa_vacanteId_fkey" FOREIGN KEY ("vacanteId") REFERENCES "public"."Vacante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante_Etapa" ADD CONSTRAINT "Vacante_Etapa_procesoEtapaId_fkey" FOREIGN KEY ("procesoEtapaId") REFERENCES "public"."Proceso_Etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante_Etapa_Comentario" ADD CONSTRAINT "Vacante_Etapa_Comentario_vacanteEtapaId_fkey" FOREIGN KEY ("vacanteEtapaId") REFERENCES "public"."Vacante_Etapa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dia_No_Laboral" ADD CONSTRAINT "Dia_No_Laboral_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante_Dia_No_Laboral" ADD CONSTRAINT "Vacante_Dia_No_Laboral_diaNoLaboralId_fkey" FOREIGN KEY ("diaNoLaboralId") REFERENCES "public"."Dia_No_Laboral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vacante_Dia_No_Laboral" ADD CONSTRAINT "Vacante_Dia_No_Laboral_vacanteId_fkey" FOREIGN KEY ("vacanteId") REFERENCES "public"."Vacante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
