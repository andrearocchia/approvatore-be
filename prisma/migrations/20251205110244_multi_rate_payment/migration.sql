/*
  Warnings:

  - You are about to drop the column `dataRiferimentoTerminiPagamento` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `giorniTerminiPagamento` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `importoPagamento` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `modalitaPagamento` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `scadenzaPagamento` on the `Invoice` table. All the data in the column will be lost.
  - Made the column `dettagliPagamento` on table `Invoice` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "dataRiferimentoTerminiPagamento",
DROP COLUMN "giorniTerminiPagamento",
DROP COLUMN "importoPagamento",
DROP COLUMN "modalitaPagamento",
DROP COLUMN "scadenzaPagamento",
ALTER COLUMN "dettagliPagamento" SET NOT NULL;
