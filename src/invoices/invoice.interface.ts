// Interfaccia unificata per Invoice
export interface DettaglioPagamento {
  modalitaPagamento: string;
  modalitaPagamentoDescrizione?: string;
  dataRiferimentoTerminiPagamento?: string;
  giorniTerminiPagamento?: string;
  dataScadenzaPagamento?: string;
  importoPagamento?: string;
  beneficiario?: string;
  iban?: string;
  bic?: string;
}

export interface Invoice {
  id: string;
  stato: string;
  note: string;
  approvatore: string;
  numero: string;
  data: string;
  tipoDocumento: string;
  divisa?: string;
  art73: string;
  causale?: string;
  codiceDestinatario: string;
  pecDestinatario?: string;
  cedente: {
    nome: string;
    partitaIva: string;
    codiceFiscale?: string;
    regimeFiscale?: string;
    indirizzo: string;
    numeroCivico?: string;
    cap: string;
    comune: string;
    provincia: string;
    nazione?: string;
    email?: string;
    telefono?: string;
    iscrizioneREA?: {
      ufficio?: string;
      numeroREA?: string;
      capitaleSociale?: string;
      socioUnico?: string;
      statoLiquidazione?: string;
    };
  };
  cessionario: {
    nome: string;
    partitaIva: string;
    codiceFiscale?: string;
    indirizzo: string;
    numeroCivico?: string;
    cap: string;
    comune: string;
    provincia: string;
    nazione?: string;
  };
  linee: {
    numeroLinea?: string;
    codiceArticolo?: string;
    descrizione: string;
    quantita: string;
    unitaMisura?: string;
    prezzoUnitario: string;
    scontoMaggiorazione?: string;
    aliquotaIva?: string;
    importo: string;
  }[];
  totale: string;
  imponibile: string;
  imposta: string;
  aliquota: string;
  esigibilitaIVA?: string;
  condizioniPagamento?: string;
  dettagliPagamento: DettaglioPagamento[];
  terzoIntermediario?: {
    denominazione?: string;
    partitaIva?: string;
    codiceFiscale?: string;
  };
  soggettoEmittente?: string;
}