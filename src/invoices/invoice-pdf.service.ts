import { Injectable } from '@nestjs/common';
import { parseStringPromise } from 'xml2js';
import { readFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { PdfGeneratorService, InvoiceData } from './pdf-generator.service';

export interface Invoice {
  id: string;
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
  modalitaPagamento?: string;
  condizioniPagamento?: string;
  dettagliPagamento?: string;
  dataRiferimentoTerminiPagamento?: string;
  giorniTerminiPagamento?: string;
  scadenzaPagamento?: string;
  importoPagamento?: string;
  terzoIntermediario?: {
    denominazione?: string;
    partitaIva?: string;
    codiceFiscale?: string;
  };
  soggettoEmittente?: string;
}

@Injectable()
export class InvoicePdfService {
  constructor(private readonly pdfGenerator: PdfGeneratorService) {}

  // =============================
  // Helper
  // =============================
  safeGet(obj: any, defaultValue = 'N/A'): string {
    if (!obj) return defaultValue;
    return Array.isArray(obj) ? obj[0] : obj;
  }

  extractInvoiceData(parsedXML: any): Omit<Invoice, 'id'> {
    const rootKey = Object.keys(parsedXML).find(k => k.includes('FatturaElettronica'));
    if (!rootKey) throw new Error('Root FatturaElettronica non trovata');

    const root = parsedXML[rootKey];
    const header = root['FatturaElettronicaHeader']?.[0] || root['p:FatturaElettronicaHeader']?.[0];
    const body = root['FatturaElettronicaBody']?.[0] || root['p:FatturaElettronicaBody']?.[0];
    if (!header || !body) throw new Error('Header o Body mancanti');

    // Dati Trasmissione
    const datiTrasmissione = header.DatiTrasmissione?.[0];
    
    // Cedente/Prestatore
    const cedente = header.CedentePrestatore?.[0];
    const cedenteAnagrafica = cedente?.DatiAnagrafici?.[0];
    const cedenteSede = cedente?.Sede?.[0];
    const cedenteContatti = cedente?.Contatti?.[0];
    const cedenteREA = cedente?.IscrizioneREA?.[0];
    
    // Cessionario/Committente
    const cessionario = header.CessionarioCommittente?.[0];
    const cessionarioAnagrafica = cessionario?.DatiAnagrafici?.[0];
    const cessionarioSede = cessionario?.Sede?.[0];
    
    // Terzo Intermediario
    const terzoIntermediario = header.TerzoIntermediarioOSoggettoEmittente?.[0];
    const terzoAnagrafica = terzoIntermediario?.DatiAnagrafici?.[0];
    
    // Soggetto Emittente
    const soggettoEmittente = header.SoggettoEmittente?.[0];
    
    // Dati Generali Documento
    const datiGenerali = body.DatiGenerali?.[0]?.DatiGeneraliDocumento?.[0];
    
    // Dati Beni Servizi
    const datiBeniServizi = body.DatiBeniServizi?.[0];
    const linee = datiBeniServizi?.DettaglioLinee || [];
    const riepilogo = datiBeniServizi?.DatiRiepilogo?.[0];
    
    // Dati Pagamento
    const datiPagamento = body.DatiPagamento?.[0];
    const dettaglioPagamento = datiPagamento?.DettaglioPagamento?.[0];

    return {
      // Dati Generali Documento
      numero: this.safeGet(datiGenerali?.Numero),
      data: this.safeGet(datiGenerali?.Data),
      tipoDocumento: this.safeGet(datiGenerali?.TipoDocumento),
      divisa: this.safeGet(datiGenerali?.Divisa, undefined),
      art73: this.safeGet(datiGenerali?.Art73, 'NO'),
      causale: this.safeGet(datiGenerali?.Causale, undefined),
      
      // Dati Trasmissione
      codiceDestinatario: this.safeGet(datiTrasmissione?.CodiceDestinatario),
      pecDestinatario: this.safeGet(datiTrasmissione?.PECDestinatario, undefined),
      
      // Cedente/Prestatore
      cedente: {
        nome: this.safeGet(cedenteAnagrafica?.Anagrafica?.[0]?.Denominazione),
        partitaIva: this.safeGet(cedenteAnagrafica?.IdFiscaleIVA?.[0]?.IdCodice),
        codiceFiscale: this.safeGet(cedenteAnagrafica?.CodiceFiscale, undefined),
        regimeFiscale: this.safeGet(cedenteAnagrafica?.RegimeFiscale, undefined),
        indirizzo: this.safeGet(cedenteSede?.Indirizzo),
        numeroCivico: this.safeGet(cedenteSede?.NumeroCivico, undefined),
        cap: this.safeGet(cedenteSede?.CAP),
        comune: this.safeGet(cedenteSede?.Comune),
        provincia: this.safeGet(cedenteSede?.Provincia),
        nazione: this.safeGet(cedenteSede?.Nazione, undefined),
        email: this.safeGet(cedenteContatti?.Email, ''),
        telefono: this.safeGet(cedenteContatti?.Telefono, ''),
        iscrizioneREA: cedenteREA ? {
          ufficio: this.safeGet(cedenteREA.Ufficio, undefined),
          numeroREA: this.safeGet(cedenteREA.NumeroREA, undefined),
          capitaleSociale: this.safeGet(cedenteREA.CapitaleSociale, undefined),
          socioUnico: this.safeGet(cedenteREA.SocioUnico, undefined),
          statoLiquidazione: this.safeGet(cedenteREA.StatoLiquidazione, undefined),
        } : undefined,
      },
      
      // Cessionario/Committente
      cessionario: {
        nome: this.safeGet(cessionarioAnagrafica?.Anagrafica?.[0]?.Denominazione),
        partitaIva: this.safeGet(cessionarioAnagrafica?.IdFiscaleIVA?.[0]?.IdCodice),
        codiceFiscale: this.safeGet(cessionarioAnagrafica?.CodiceFiscale, undefined),
        indirizzo: this.safeGet(cessionarioSede?.Indirizzo),
        numeroCivico: this.safeGet(cessionarioSede?.NumeroCivico, undefined),
        cap: this.safeGet(cessionarioSede?.CAP),
        comune: this.safeGet(cessionarioSede?.Comune),
        provincia: this.safeGet(cessionarioSede?.Provincia),
        nazione: this.safeGet(cessionarioSede?.Nazione, undefined),
      },
      
      // Linee Dettaglio
      linee: linee.map(linea => ({
        numeroLinea: this.safeGet(linea.NumeroLinea, undefined),
        codiceArticolo: this.safeGet(linea.CodiceArticolo?.[0]?.CodiceValore, undefined),
        descrizione: this.safeGet(linea.Descrizione),
        quantita: this.safeGet(linea.Quantita),
        unitaMisura: this.safeGet(linea.UnitaMisura, undefined),
        prezzoUnitario: this.safeGet(linea.PrezzoUnitario),
        scontoMaggiorazione: this.safeGet(linea.ScontoMaggiorazione?.[0]?.Percentuale, undefined),
        aliquotaIva: this.safeGet(linea.AliquotaIVA, undefined),
        importo: this.safeGet(linea.PrezzoTotale || linea.ImportoLinea),
      })),
      
      // Totali
      totale: this.safeGet(datiGenerali?.ImportoTotaleDocumento || riepilogo?.ImportoTotaleDocumento),
      imponibile: this.safeGet(riepilogo?.ImponibileImporto),
      imposta: this.safeGet(riepilogo?.Imposta),
      aliquota: this.safeGet(riepilogo?.AliquotaIVA),
      esigibilitaIVA: this.safeGet(riepilogo?.EsigibilitaIVA, undefined),
      
      // Dati Pagamento
      modalitaPagamento: this.safeGet(dettaglioPagamento?.ModalitaPagamento, undefined),
      condizioniPagamento: this.safeGet(datiPagamento?.CondizioniPagamento, undefined),
      dettagliPagamento: this.safeGet(dettaglioPagamento?.Beneficiario, undefined),
      dataRiferimentoTerminiPagamento: this.safeGet(dettaglioPagamento?.DataRiferimentoTerminiPagamento, undefined),
      giorniTerminiPagamento: this.safeGet(dettaglioPagamento?.GiorniTerminiPagamento, undefined),
      scadenzaPagamento: this.safeGet(dettaglioPagamento?.DataScadenzaPagamento, undefined),
      importoPagamento: this.safeGet(dettaglioPagamento?.ImportoPagamento, undefined),
      
      // Terzo Intermediario
      terzoIntermediario: terzoIntermediario ? {
        denominazione: this.safeGet(terzoAnagrafica?.Anagrafica?.[0]?.Denominazione, undefined),
        partitaIva: this.safeGet(terzoAnagrafica?.IdFiscaleIVA?.[0]?.IdCodice, undefined),
        codiceFiscale: this.safeGet(terzoAnagrafica?.CodiceFiscale, undefined),
      } : undefined,
      
      // Soggetto Emittente
      soggettoEmittente: this.safeGet(soggettoEmittente, undefined),
    };
  }

  // =============================
  // Conversione dati
  // =============================
  private convertToInvoiceData(invoiceData: Omit<Invoice, 'id'>): InvoiceData {
    return {
      numero: invoiceData.numero,
      data: invoiceData.data,
      tipoDocumento: invoiceData.tipoDocumento,
      art73: invoiceData.art73,
      codiceDestinatario: invoiceData.codiceDestinatario,
      cedente: {
        nome: invoiceData.cedente.nome,
        partitaIva: invoiceData.cedente.partitaIva,
        codiceFiscale: invoiceData.cedente.codiceFiscale,
        regimeFiscale: invoiceData.cedente.regimeFiscale,
        indirizzo: invoiceData.cedente.indirizzo,
        cap: invoiceData.cedente.cap,
        comune: invoiceData.cedente.comune,
        provincia: invoiceData.cedente.provincia,
        email: invoiceData.cedente.email || '',
        telefono: invoiceData.cedente.telefono || '',
      },
      cessionario: {
        nome: invoiceData.cessionario.nome,
        partitaIva: invoiceData.cessionario.partitaIva,
        indirizzo: invoiceData.cessionario.indirizzo,
        cap: invoiceData.cessionario.cap,
        comune: invoiceData.cessionario.comune,
        provincia: invoiceData.cessionario.provincia,
      },
      linee: invoiceData.linee.map(linea => ({
        codiceArticolo: linea.codiceArticolo,
        descrizione: linea.descrizione,
        quantita: linea.quantita,
        prezzoUnitario: linea.prezzoUnitario,
        unitaMisura: linea.unitaMisura,
        scontoMaggiorazione: linea.scontoMaggiorazione,
        aliquotaIva: linea.aliquotaIva,
        importo: linea.importo,
      })),
      totale: invoiceData.totale,
      imponibile: invoiceData.imponibile,
      imposta: invoiceData.imposta,
      aliquota: invoiceData.aliquota,
      modalitaPagamento: invoiceData.modalitaPagamento,
      dettagliPagamento: invoiceData.dettagliPagamento,
      scadenzaPagamento: invoiceData.scadenzaPagamento,
      importoPagamento: invoiceData.importoPagamento,
    };
  }

  // =============================
  // PDF
  // =============================
  public async convertXMLToPDF(xmlContent: string): Promise<Buffer> {
    const cleanXml = xmlContent
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;');

    const parsed = await parseStringPromise(cleanXml, { 
      explicitArray: true, 
      mergeAttrs: false, 
      normalize: true, 
      trim: true 
    });
    
    const invoiceData = this.extractInvoiceData(parsed);
    const pdfData = this.convertToInvoiceData(invoiceData);
    
    const tempPath = join(process.env.PDF_OUTPUT_DIR!, `fattura-${Date.now()}.pdf`);
    await this.pdfGenerator.generatePDF(pdfData, tempPath);

    const buffer = readFileSync(tempPath);
    // PDF rimane salvato nella cartella PDF_OUTPUT_DIR
    return buffer;
  }

  // =============================
  // Leggi XML e ritorna array di Invoice
  // =============================
  public async listInvoicesFromXml(): Promise<Invoice[]> {
    const folderPath = process.env.INVOICE_OUTPUT_DIR;
    if (!folderPath) throw new Error('INVOICE_OUTPUT_DIR non definita');

    const files = readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.xml'));
    const invoices: Invoice[] = [];

    for (const fileName of files) {
      const filePath = join(folderPath, fileName);
      try {
        const xmlContent = readFileSync(filePath, 'utf-8');
        const cleanXml = xmlContent
          .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
          .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;');

        const parsed = await parseStringPromise(cleanXml, { 
          explicitArray: true, 
          mergeAttrs: false, 
          normalize: true, 
          trim: true 
        });
        
        const invoiceData = this.extractInvoiceData(parsed);
        invoices.push({ id: fileName, ...invoiceData });
      } catch (err) {
        console.error(`Errore parsing ${fileName}:`, err.message);
      }
    }

    return invoices;
  }

  public async generatePdfFromData(invoiceData: Omit<Invoice, 'id'>): Promise<Buffer> {
    const pdfData = this.convertToInvoiceData(invoiceData);
    
    const outputDir = process.env.PDF_OUTPUT_DIR!;
    const tempPath = join(outputDir, `fattura-${Date.now()}.pdf`);
    await this.pdfGenerator.generatePDF(pdfData, tempPath);
    const buffer = readFileSync(tempPath);
    return buffer;
  }
}