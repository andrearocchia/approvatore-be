-- CreateEnum
CREATE TYPE "Role" AS ENUM ('approvatore', 'segretario', 'admin');

-- CreateEnum
CREATE TYPE "StatoFattura" AS ENUM ('in_attesa', 'approvato', 'rifiutato');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "codiceUnico" SERIAL NOT NULL,
    "stato" "StatoFattura" NOT NULL DEFAULT 'in_attesa',
    "note" TEXT NOT NULL DEFAULT '',
    "numero" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "divisa" TEXT,
    "art73" TEXT NOT NULL,
    "causale" TEXT,
    "codiceDestinatario" TEXT NOT NULL,
    "pecDestinatario" TEXT,
    "cedenteNome" TEXT NOT NULL,
    "cedentePartitaIva" TEXT NOT NULL,
    "cedenteCodiceFiscale" TEXT,
    "cedenteRegimeFiscale" TEXT,
    "cedenteIndirizzo" TEXT NOT NULL,
    "cedenteNumeroCivico" TEXT,
    "cedenteCap" TEXT NOT NULL,
    "cedenteComune" TEXT NOT NULL,
    "cedenteProvincia" TEXT NOT NULL,
    "cedenteNazione" TEXT,
    "cedenteEmail" TEXT,
    "cedenteTelefono" TEXT,
    "cedenteREAUfficio" TEXT,
    "cedenteREANumero" TEXT,
    "cedenteREACapitale" TEXT,
    "cedenteREASocioUnico" TEXT,
    "cedenteREALiquidazione" TEXT,
    "cessionarioNome" TEXT NOT NULL,
    "cessionarioPartitaIva" TEXT NOT NULL,
    "cessionarioCodiceFiscale" TEXT,
    "cessionarioIndirizzo" TEXT NOT NULL,
    "cessionarioNumeroCivico" TEXT,
    "cessionarioCap" TEXT NOT NULL,
    "cessionarioComune" TEXT NOT NULL,
    "cessionarioProvincia" TEXT NOT NULL,
    "cessionarioNazione" TEXT,
    "totale" TEXT NOT NULL,
    "imponibile" TEXT NOT NULL,
    "imposta" TEXT NOT NULL,
    "aliquota" TEXT NOT NULL,
    "esigibilitaIVA" TEXT,
    "modalitaPagamento" TEXT,
    "condizioniPagamento" TEXT,
    "dettagliPagamento" TEXT,
    "dataRiferimentoTerminiPagamento" TEXT,
    "giorniTerminiPagamento" TEXT,
    "scadenzaPagamento" TEXT,
    "importoPagamento" TEXT,
    "terzoIntermediarioDenominazione" TEXT,
    "terzoIntermediarioPartitaIva" TEXT,
    "terzoIntermediarioCodiceFiscale" TEXT,
    "soggettoEmittente" TEXT,
    "linee" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_codiceUnico_key" ON "Invoice"("codiceUnico");
