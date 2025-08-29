/*
  Warnings:

  - You are about to drop the column `token` on the `Usuario` table. All the data in the column will be lost.
  - You are about to drop the column `tokenExpiracion` on the `Usuario` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Usuario" DROP COLUMN "token",
DROP COLUMN "tokenExpiracion";
