import { Injectable } from '@nestjs/common';
import { parseStringPromise } from 'xml2js';
import { readFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { PdfGeneratorService } from './pdf-generator.service';

export interface Invoice {
  id: string;
  numero: string;
  data: string;
  cedente: {
    nome: string;
    partitaIva: string;
    indirizzo: string;
    cap: string;
    comune: string;
    provincia: string;
    email: string;
    telefono: string;
  };
  cessionario: {
    nome: string;
    partitaIva: string;
    indirizzo: string;
    cap: string;
    comune: string;
    provincia: string;
  };
  linee: {
    descrizione: string;
    quantita: string;
    prezzoUnitario: string;
    importo: string;
  }[];
  totale: string;
  imponibile: string;
  imposta: string;
  aliquota: string;
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

    const cedente = header.CedentePrestatore?.[0];
    const cessionario = header.CessionarioCommittente?.[0];
    const datiGenerali = body.DatiGenerali?.[0]?.DatiGeneraliDocumento?.[0];
    const linee = body.DatiBeniServizi?.[0]?.DettaglioLinee || [];
    const riepilogo = body.DatiBeniServizi?.[0]?.DatiRiepilogo?.[0];

    return {
      numero: this.safeGet(datiGenerali?.Numero),
      data: this.safeGet(datiGenerali?.Data),
      cedente: {
        nome: this.safeGet(cedente?.DatiAnagrafici?.[0]?.Anagrafica?.[0]?.Denominazione),
        partitaIva: this.safeGet(cedente?.DatiAnagrafici?.[0]?.IdFiscaleIVA?.[0]?.IdCodice),
        indirizzo: this.safeGet(cedente?.Sede?.[0]?.Indirizzo),
        cap: this.safeGet(cedente?.Sede?.[0]?.CAP),
        comune: this.safeGet(cedente?.Sede?.[0]?.Comune),
        provincia: this.safeGet(cedente?.Sede?.[0]?.Provincia),
        email: this.safeGet(cedente?.Contatti?.[0]?.Email, ''),
        telefono: this.safeGet(cedente?.Contatti?.[0]?.Telefono, ''),
      },
      cessionario: {
        nome: this.safeGet(cessionario?.DatiAnagrafici?.[0]?.Anagrafica?.[0]?.Denominazione),
        partitaIva: this.safeGet(cessionario?.DatiAnagrafici?.[0]?.IdFiscaleIVA?.[0]?.IdCodice),
        indirizzo: this.safeGet(cessionario?.Sede?.[0]?.Indirizzo),
        cap: this.safeGet(cessionario?.Sede?.[0]?.CAP),
        comune: this.safeGet(cessionario?.Sede?.[0]?.Comune),
        provincia: this.safeGet(cessionario?.Sede?.[0]?.Provincia),
      },
      linee: linee.map(linea => ({
        descrizione: this.safeGet(linea.Descrizione),
        quantita: this.safeGet(linea.Quantita),
        prezzoUnitario: this.safeGet(linea.PrezzoUnitario),
        importo: this.safeGet(linea.PrezzoTotale || linea.ImportoLinea),
      })),
      totale: this.safeGet(riepilogo?.ImportoTotaleDocumento),
      imponibile: this.safeGet(riepilogo?.ImponibileImporto),
      imposta: this.safeGet(riepilogo?.Imposta),
      aliquota: this.safeGet(riepilogo?.AliquotaIVA),
    };
  }

  // =============================
  // PDF
  // =============================
  public async convertXMLToPDF(xmlContent: string): Promise<Buffer> {
    console.log(xmlContent);
    const cleanXml = xmlContent
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;');

    const parsed = await parseStringPromise(cleanXml, { explicitArray: true, mergeAttrs: false, normalize: true, trim: true });
    const invoiceData = this.extractInvoiceData(parsed);
    
    const tempPath = join(process.env.INVOICE_OUTPUT_DIR!, `fattura-${Date.now()}.pdf`);

    await this.pdfGenerator.generatePDF(invoiceData, tempPath);

    const buffer = readFileSync(tempPath);
    unlinkSync(tempPath);
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

        const parsed = await parseStringPromise(cleanXml, { explicitArray: true, mergeAttrs: false, normalize: true, trim: true });
        const invoiceData = this.extractInvoiceData(parsed);
        invoices.push({ id: fileName, ...invoiceData });
      } catch (err) {
        console.error(`Errore parsing ${fileName}:`, err.message);
      }
    }

    return invoices;
  }

  public async generatePdfFromData(invoiceData: Omit<Invoice, 'id'>): Promise<Buffer> {
    const outputDir = process.env.INVOICE_OUTPUT_DIR!;
    const tempPath = join(outputDir, `fattura-${Date.now()}.pdf`);
    await this.pdfGenerator.generatePDF(invoiceData, tempPath);
    const buffer = readFileSync(tempPath);
    unlinkSync(tempPath);
    return buffer;
  }
}