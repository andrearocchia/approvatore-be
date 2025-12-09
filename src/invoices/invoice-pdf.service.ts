import { Injectable } from '@nestjs/common';
import { parseStringPromise } from 'xml2js';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { PdfGeneratorService } from './pdf-generator.service';
import { InvoiceDbService } from './invoice-db.service';
import { Invoice } from './invoice.interface';

@Injectable()
export class InvoicePdfService {
  constructor(
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly invoiceDb: InvoiceDbService,
  ) {}

  private readonly MODALITA_PAGAMENTO_MAP: Record<string, string> = {
    'MP01': 'Contanti',
    'MP02': 'Assegno',
    'MP05': 'Bonifico',
    'MP08': 'Carta di pagamento',
    'MP12': 'RID/Addebito diretto',
    'MP22': 'PagoPA',
  };

  private getModalitaPagamentoDescrizione(codice: string): string {
    return this.MODALITA_PAGAMENTO_MAP[codice] || codice;
  }

  async processXmlAndGeneratePdf(xmlContent: string, approvatore: string): Promise<number> {
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
    const codiceUnico = await this.invoiceDb.saveInvoice(invoiceData, approvatore);
    await this.generatePdf(invoiceData, codiceUnico);
    
    return codiceUnico;
  }

  private cleanXmlContent(xmlContent: string): string {
    return xmlContent
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;');
  }

  private formatNumber(value: string | number | undefined): string {
    if (value === undefined || value === null || value === '') return 'N/A';
    
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    
    return num.toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  private addCurrencySymbol(value: string, divisa?: string): string {
    if (value === 'N/A') {
      return value;
    }

    const symbols: Record<string, string> = {
      EUR: '€',
      USD: '$',
      GBP: '£',
      CHF: 'CHF',
      JPY: '¥',
      CAD: 'C$',
      AUD: 'A$',
      NZD: 'NZ$',
      SEK: 'kr',
      NOK: 'kr',
      DKK: 'kr',
      CNY: '¥',
      HKD: 'HK$',
      SGD: 'S$',
      INR: '₹'
    };

    const symbol = symbols[divisa ?? ''] ?? '';

    return symbol ? `${symbol} ${value}` : value;
  }

  private safeGet(obj: any, defaultValue = 'N/A'): string {
    if (!obj || (Array.isArray(obj) && obj.length === 0)) return defaultValue;
    const value = Array.isArray(obj) ? obj[0] : obj;
    return value?.toString() || defaultValue;
  }

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
    const dettaglioPagamentoArray = datiPagamento?.DettaglioPagamento || [];

    const divisa = this.safeGet(datiGenerali?.Divisa, undefined);

    const dettagliPagamento = dettaglioPagamentoArray.map((dp: any) => {
      const modalitaCodice = this.safeGet(dp.ModalitaPagamento, undefined);
      return {
        modalitaPagamento: modalitaCodice,
        modalitaPagamentoDescrizione: modalitaCodice ? this.getModalitaPagamentoDescrizione(modalitaCodice) : undefined,
        dataRiferimentoTerminiPagamento: this.safeGet(dp.DataRiferimentoTerminiPagamento, undefined),
        giorniTerminiPagamento: this.safeGet(dp.GiorniTerminiPagamento, undefined),
        dataScadenzaPagamento: this.safeGet(dp.DataScadenzaPagamento, undefined),
        importoPagamento: this.addCurrencySymbol(this.formatNumber(this.safeGet(dp.ImportoPagamento, undefined)), divisa),
        beneficiario: this.safeGet(dp.Beneficiario, undefined),
        iban: this.safeGet(dp.IBAN, undefined),
        bic: this.safeGet(dp.BIC, undefined),
      };
    });

    return {
      numero: this.safeGet(datiGenerali?.Numero),
      stato: 'in_attesa',
      note: '',
      approvatore: '',
      data: this.safeGet(datiGenerali?.Data),
      tipoDocumento: this.safeGet(datiGenerali?.TipoDocumento),
      divisa: divisa,
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
      
      linee: linee.map((linea: any) => ({
        numeroLinea: this.safeGet(linea.NumeroLinea, undefined),
        codiceArticolo: this.safeGet(linea.CodiceArticolo?.[0]?.CodiceValore, undefined),
        descrizione: this.safeGet(linea.Descrizione),
        quantita: this.formatNumber(this.safeGet(linea.Quantita)),
        unitaMisura: this.safeGet(linea.UnitaMisura, undefined),
        prezzoUnitario: this.addCurrencySymbol(this.formatNumber(this.safeGet(linea.PrezzoUnitario)), divisa),
        scontoMaggiorazione: this.safeGet(linea.ScontoMaggiorazione?.[0]?.Percentuale, undefined),
        aliquotaIva: this.safeGet(linea.AliquotaIVA, undefined),
        importo: this.addCurrencySymbol(this.formatNumber(this.safeGet(linea.PrezzoTotale || linea.ImportoLinea)), divisa),
      })),
      
      totale: this.addCurrencySymbol(this.formatNumber(this.safeGet(datiGenerali?.ImportoTotaleDocumento || riepilogo?.ImportoTotaleDocumento)), divisa),
      imponibile: this.addCurrencySymbol(this.formatNumber(this.safeGet(riepilogo?.ImponibileImporto)), divisa),
      imposta: this.addCurrencySymbol(this.formatNumber(this.safeGet(riepilogo?.Imposta)), divisa),
      aliquota: this.formatNumber(this.safeGet(riepilogo?.AliquotaIVA)),
      esigibilitaIVA: this.safeGet(riepilogo?.EsigibilitaIVA, undefined),
      
      condizioniPagamento: this.safeGet(datiPagamento?.CondizioniPagamento, undefined),
      dettagliPagamento,
      
      terzoIntermediario: terzoIntermediario ? {
        denominazione: this.safeGet(terzoAnagrafica?.Anagrafica?.[0]?.Denominazione, undefined),
        partitaIva: this.safeGet(terzoAnagrafica?.IdFiscaleIVA?.[0]?.IdCodice, undefined),
        codiceFiscale: this.safeGet(terzoAnagrafica?.CodiceFiscale, undefined),
      } : undefined,
      
      soggettoEmittente: this.safeGet(soggettoEmittente, undefined),
    };
  }

  async generatePdf(invoiceData: Omit<Invoice, 'id'>, codiceUnico?: number): Promise<Buffer> {
    const outputDir = resolve(process.cwd(), process.env.PDF_OUTPUT_DIR || './pdf');
    const fileName = codiceUnico 
      ? `fattura-${codiceUnico}-${Date.now()}.pdf`
      : `fattura-${Date.now()}.pdf`;
    const tempPath = join(outputDir, fileName);
    
    await this.pdfGenerator.generatePDF(invoiceData, tempPath);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const buffer = readFileSync(tempPath);
    return buffer;
  }
}