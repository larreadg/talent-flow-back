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
CREATE TABLE "public"."Equipo" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "sedeId" UUID NOT NULL,
    "departamentoId" UUID,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "tipo" TEXT,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Usuario" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "departamentoId" UUID,
    "sedeId" UUID,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT,
    "apellido" TEXT,
    "telefono" TEXT,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Rol" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Permiso" (
    "id" UUID NOT NULL,
    "clave" TEXT NOT NULL,
    "recurso" TEXT,
    "accion" TEXT,
    "descripcion" TEXT,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Usuario_Rol" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "rolId" UUID NOT NULL,
    "scopeSedeId" UUID,
    "scopeDepartamentoId" UUID,
    "scopeEquipoId" UUID,
    "validFrom" TIMESTAMPTZ(6),
    "validTo" TIMESTAMPTZ(6),
    "assignedBy" UUID,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Usuario_Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Rol_Permiso" (
    "id" UUID NOT NULL,
    "rolId" UUID NOT NULL,
    "permisoId" UUID NOT NULL,
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Rol_Permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Usuario_Equipo" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "equipoId" UUID NOT NULL,
    "rolEnEquipo" TEXT,
    "validFrom" TIMESTAMPTZ(6),
    "validTo" TIMESTAMPTZ(6),
    "uc" TEXT,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "um" TEXT,
    "fm" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Usuario_Equipo_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Equipo_empresaId_idx" ON "public"."Equipo"("empresaId");

-- CreateIndex
CREATE INDEX "Equipo_sedeId_idx" ON "public"."Equipo"("sedeId");

-- CreateIndex
CREATE INDEX "Equipo_departamentoId_idx" ON "public"."Equipo"("departamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipo_empresaId_sedeId_nombre_key" ON "public"."Equipo"("empresaId", "sedeId", "nombre");

-- CreateIndex
CREATE INDEX "Usuario_empresaId_idx" ON "public"."Usuario"("empresaId");

-- CreateIndex
CREATE INDEX "Usuario_departamentoId_idx" ON "public"."Usuario"("departamentoId");

-- CreateIndex
CREATE INDEX "Usuario_sedeId_idx" ON "public"."Usuario"("sedeId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_empresaId_username_key" ON "public"."Usuario"("empresaId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_empresaId_email_key" ON "public"."Usuario"("empresaId", "email");

-- CreateIndex
CREATE INDEX "Rol_empresaId_idx" ON "public"."Rol"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_empresaId_nombre_key" ON "public"."Rol"("empresaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Permiso_clave_key" ON "public"."Permiso"("clave");

-- CreateIndex
CREATE INDEX "Usuario_Rol_usuarioId_idx" ON "public"."Usuario_Rol"("usuarioId");

-- CreateIndex
CREATE INDEX "Usuario_Rol_rolId_idx" ON "public"."Usuario_Rol"("rolId");

-- CreateIndex
CREATE INDEX "Usuario_Rol_scopeSedeId_idx" ON "public"."Usuario_Rol"("scopeSedeId");

-- CreateIndex
CREATE INDEX "Usuario_Rol_scopeDepartamentoId_idx" ON "public"."Usuario_Rol"("scopeDepartamentoId");

-- CreateIndex
CREATE INDEX "Usuario_Rol_scopeEquipoId_idx" ON "public"."Usuario_Rol"("scopeEquipoId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_Rol_usuarioId_rolId_scopeSedeId_scopeDepartamentoId_key" ON "public"."Usuario_Rol"("usuarioId", "rolId", "scopeSedeId", "scopeDepartamentoId", "scopeEquipoId");

-- CreateIndex
CREATE INDEX "Rol_Permiso_permisoId_idx" ON "public"."Rol_Permiso"("permisoId");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_Permiso_rolId_permisoId_key" ON "public"."Rol_Permiso"("rolId", "permisoId");

-- CreateIndex
CREATE INDEX "Usuario_Equipo_equipoId_idx" ON "public"."Usuario_Equipo"("equipoId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_Equipo_usuarioId_equipoId_key" ON "public"."Usuario_Equipo"("usuarioId", "equipoId");

-- AddForeignKey
ALTER TABLE "public"."Sede" ADD CONSTRAINT "Sede_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Departamento" ADD CONSTRAINT "Departamento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Departamento" ADD CONSTRAINT "Departamento_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Equipo" ADD CONSTRAINT "Equipo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Equipo" ADD CONSTRAINT "Equipo_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Equipo" ADD CONSTRAINT "Equipo_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "public"."Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "public"."Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "public"."Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rol" ADD CONSTRAINT "Rol_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario_Rol" ADD CONSTRAINT "Usuario_Rol_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario_Rol" ADD CONSTRAINT "Usuario_Rol_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "public"."Rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario_Rol" ADD CONSTRAINT "Usuario_Rol_scopeSedeId_fkey" FOREIGN KEY ("scopeSedeId") REFERENCES "public"."Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario_Rol" ADD CONSTRAINT "Usuario_Rol_scopeDepartamentoId_fkey" FOREIGN KEY ("scopeDepartamentoId") REFERENCES "public"."Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario_Rol" ADD CONSTRAINT "Usuario_Rol_scopeEquipoId_fkey" FOREIGN KEY ("scopeEquipoId") REFERENCES "public"."Equipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rol_Permiso" ADD CONSTRAINT "Rol_Permiso_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "public"."Rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rol_Permiso" ADD CONSTRAINT "Rol_Permiso_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "public"."Permiso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario_Equipo" ADD CONSTRAINT "Usuario_Equipo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario_Equipo" ADD CONSTRAINT "Usuario_Equipo_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "public"."Equipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
