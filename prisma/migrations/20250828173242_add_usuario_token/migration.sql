-- CreateEnum
CREATE TYPE "public"."UsuarioTokenTipo" AS ENUM ('activate_account', 'update_pass');

-- CreateTable
CREATE TABLE "public"."Usuario_Token" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tipo" "public"."UsuarioTokenTipo" NOT NULL,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Usuario_Token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Usuario_Token_usuarioId_idx" ON "public"."Usuario_Token"("usuarioId");

-- CreateIndex
CREATE INDEX "Usuario_Token_expiresAt_idx" ON "public"."Usuario_Token"("expiresAt");

-- CreateIndex
CREATE INDEX "Usuario_Token_tipo_idx" ON "public"."Usuario_Token"("tipo");

-- AddForeignKey
ALTER TABLE "public"."Usuario_Token" ADD CONSTRAINT "Usuario_Token_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
