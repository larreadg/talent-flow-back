/*
  Warnings:

  - The values [cerrada] on the enum `VacanteEstado` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."VacanteEstado_new" AS ENUM ('abierta', 'pausada', 'finalizada', 'cancelada');
ALTER TABLE "public"."Vacante" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "public"."Vacante" ALTER COLUMN "estado" TYPE "public"."VacanteEstado_new" USING ("estado"::text::"public"."VacanteEstado_new");
ALTER TYPE "public"."VacanteEstado" RENAME TO "VacanteEstado_old";
ALTER TYPE "public"."VacanteEstado_new" RENAME TO "VacanteEstado";
DROP TYPE "public"."VacanteEstado_old";
ALTER TABLE "public"."Vacante" ALTER COLUMN "estado" SET DEFAULT 'abierta';
COMMIT;
