import { Injectable } from '@nestjs/common';
import { parseStringPromise } from 'xml2js';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { PdfGeneratorService } from './pdf-generator.service';
import { InvoiceDbService } from './invoice-db.service';

export interface Invoice {
  id: string;
  stato: string;
  note: string,
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
  constructor(
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly invoiceDb: InvoiceDbService,
  ) {}

  /**
   * Metodo principale: elabora XML, salva in DB e genera PDF
   * Restituisce il codiceUnico della fattura
   */
  async processXmlAndGeneratePdf(xmlContent: string): Promise<number> {
    const cleanXml = this.cleanXmlContent(xmlContent);
    const parsed = await parseStringPromise(cleanXml, { 
      explicitArray: true, 
      mergeAttrs: false, 
      normalize: true, 
      trim: true,
      tagNameProcessors: [],
      attrNameProcessors: [],
      valueProcessors: [],
      attrValueProcessors: []
    });
    
    const invoiceData = this.extractInvoiceData(parsed);
    const codiceUnico = await this.invoiceDb.saveInvoice(invoiceData);
    await this.generatePdf(invoiceData, codiceUnico);
    
    return codiceUnico;
  }

  /**
   * Pulisce il contenuto XML da caratteri di controllo non validi
   * preservando i caratteri UTF-8 validi
   */
  private cleanXmlContent(xmlContent: string): string {
    return xmlContent
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;');
  }

  /**
   * Helper per estrarre valori in modo sicuro dall'XML parsato
   */
  private safeGet(obj: any, defaultValue = 'N/A'): string {
    if (!obj || (Array.isArray(obj) && obj.length === 0)) return defaultValue;
    const value = Array.isArray(obj) ? obj[0] : obj;
    return value?.toString() || defaultValue;
  }

  /**
   * Estrae i dati strutturati della fattura dall'XML parsato
   */
  extractInvoiceData(parsedXML: any): Omit<Invoice, 'id'> {
    const rootKey = Object.keys(parsedXML).find(k => k.includes('FatturaElettronica'));
    if (!rootKey) throw new Error('Root FatturaElettronica non trovata');

    const root = parsedXML[rootKey];
    const header = root['FatturaElettronicaHeader']?.[0] || root['p:FatturaElettronicaHeader']?.[0];
    const body = root['FatturaElettronicaBody']?.[0] || root['p:FatturaElettronicaBody']?.[0];
    if (!header || !body) throw new Error('Header o Body mancanti');

    const datiTrasmissione = header.DatiTrasmissione?.[0];
    
    const cedente = header.CedentePrestatore?.[0];
    const cedenteAnagrafica = cedente?.DatiAnagrafici?.[0];
    const cedenteSede = cedente?.Sede?.[0];
    const cedenteContatti = cedente?.Contatti?.[0];
    const cedenteREA = cedente?.IscrizioneREA?.[0];
    
    const cessionario = header.CessionarioCommittente?.[0];
    const cessionarioAnagrafica = cessionario?.DatiAnagrafici?.[0];
    const cessionarioSede = cessionario?.Sede?.[0];
    
    const terzoIntermediario = header.TerzoIntermediarioOSoggettoEmittente?.[0];
    const terzoAnagrafica = terzoIntermediario?.DatiAnagrafici?.[0];
    
    const soggettoEmittente = header.SoggettoEmittente?.[0];
    
    const datiGenerali = body.DatiGenerali?.[0]?.DatiGeneraliDocumento?.[0];
    
    const datiBeniServizi = body.DatiBeniServizi?.[0];
    const linee = datiBeniServizi?.DettaglioLinee || [];
    const riepilogo = datiBeniServizi?.DatiRiepilogo?.[0];
    
    const datiPagamento = body.DatiPagamento?.[0];
    const dettaglioPagamento = datiPagamento?.DettaglioPagamento?.[0];

    return {
      numero: this.safeGet(datiGenerali?.Numero),
      stato: this.safeGet(rootKey, 'in_attesa'),
      note: this.safeGet(rootKey, undefined),
      data: this.safeGet(datiGenerali?.Data),
      tipoDocumento: this.safeGet(datiGenerali?.TipoDocumento),
      divisa: this.safeGet(datiGenerali?.Divisa, undefined),
      art73: this.safeGet(datiGenerali?.Art73, 'NO'),
      causale: this.safeGet(datiGenerali?.Causale, undefined),
      
      codiceDestinatario: this.safeGet(datiTrasmissione?.CodiceDestinatario),
      pecDestinatario: this.safeGet(datiTrasmissione?.PECDestinatario, undefined),
      
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
        email: this.safeGet(cedenteContatti?.Email, undefined),
        telefono: this.safeGet(cedenteContatti?.Telefono, undefined),
        iscrizioneREA: cedenteREA ? {
          ufficio: this.safeGet(cedenteREA.Ufficio, undefined),
          numeroREA: this.safeGet(cedenteREA.NumeroREA, undefined),
          capitaleSociale: this.safeGet(cedenteREA.CapitaleSociale, undefined),
          socioUnico: this.safeGet(cedenteREA.SocioUnico, undefined),
          statoLiquidazione: this.safeGet(cedenteREA.StatoLiquidazione, undefined),
        } : undefined,
      },
      
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
      
      totale: this.safeGet(datiGenerali?.ImportoTotaleDocumento || riepilogo?.ImportoTotaleDocumento),
      imponibile: this.safeGet(riepilogo?.ImponibileImporto),
      imposta: this.safeGet(riepilogo?.Imposta),
      aliquota: this.safeGet(riepilogo?.AliquotaIVA),
      esigibilitaIVA: this.safeGet(riepilogo?.EsigibilitaIVA, undefined),
      
      modalitaPagamento: this.safeGet(dettaglioPagamento?.ModalitaPagamento, undefined),
      condizioniPagamento: this.safeGet(datiPagamento?.CondizioniPagamento, undefined),
      dettagliPagamento: this.safeGet(dettaglioPagamento?.Beneficiario, undefined),
      dataRiferimentoTerminiPagamento: this.safeGet(dettaglioPagamento?.DataRiferimentoTerminiPagamento, undefined),
      giorniTerminiPagamento: this.safeGet(dettaglioPagamento?.GiorniTerminiPagamento, undefined),
      scadenzaPagamento: this.safeGet(dettaglioPagamento?.DataScadenzaPagamento, undefined),
      importoPagamento: this.safeGet(dettaglioPagamento?.ImportoPagamento, undefined),
      
      terzoIntermediario: terzoIntermediario ? {
        denominazione: this.safeGet(terzoAnagrafica?.Anagrafica?.[0]?.Denominazione, undefined),
        partitaIva: this.safeGet(terzoAnagrafica?.IdFiscaleIVA?.[0]?.IdCodice, undefined),
        codiceFiscale: this.safeGet(terzoAnagrafica?.CodiceFiscale, undefined),
      } : undefined,
      
      soggettoEmittente: this.safeGet(soggettoEmittente, undefined),
    };
  }

  /**
   * Genera il PDF della fattura
   */
  async generatePdf(invoiceData: Omit<Invoice, 'id'>, codiceUnico?: number): Promise<Buffer> {
    const outputDir = resolve(process.cwd(), process.env.PDF_OUTPUT_DIR || './pdf');
    const fileName = codiceUnico 
      ? `fattura-${codiceUnico}-${Date.now()}.pdf`
      : `fattura-${Date.now()}.pdf`;
    const tempPath = join(outputDir, fileName);
    
    await this.pdfGenerator.generatePDF(invoiceData, tempPath);
    
    // Piccolo delay per sincronizzazione filesystem
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const buffer = readFileSync(tempPath);
    return buffer;
  }
}