import { Injectable } from '@nestjs/common';
import { parseStringPromise } from 'xml2js';
import { createWriteStream, readFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';

const PDFDocument = require('pdfkit');

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

    await this.generatePDF(invoiceData, tempPath);

    const buffer = readFileSync(tempPath);
    unlinkSync(tempPath);
    return buffer;
  }

  // =============================
  // Genera il PDF Invoice
  // =============================
  private generatePDF(invoiceData: Omit<Invoice, 'id'>, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const stream = createWriteStream(outputPath);
        doc.pipe(stream);

        const drawContainer = (y: number, height: number) => {
        doc.save()
          .rect(40, y, 515, height)  // x, y, larghezza, altezza
          .lineWidth(1)              // spessore bordo
          .strokeColor('#000000')    // colore bordo
          .stroke()                  // disegna il bordo
          .restore();
        };

        //
        // TITOLO o eventuale logo
        //
        doc.fontSize(20).font('Helvetica-Bold').text('', { align: 'center' });
        doc.moveDown(0.5);

        //
        // NUMERO + DATA
        //
        doc.fontSize(10).font('Helvetica').text(`Numero: ${invoiceData.numero} | Data: ${invoiceData.data}`);
        doc.moveDown(1);

        //
        // CEDENTE / CESSIONARIO — COME IL MODALE
        //
        const startY = doc.y;
        const containerHeight = 100;

        drawContainer(startY - 5, containerHeight);

        // COLONNA SINISTRA - CEDENTE / PRESTATORE (FORNITORE)
        doc.font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#333')
          .text('Cedente/Prestatore (fornitore)', 50, startY);

        doc.font('Helvetica').fontSize(8).fillColor('#555')
          .text(`Denominazione: ${invoiceData.cedente.nome}`, 50, startY + 18)
          .text(`Identificativo fiscale ai fini di IVA: ${invoiceData.cedente.partitaIva}`, 50)
          .text(`Indirizzo: ${invoiceData.cedente.indirizzo}`, 50)
          .text(`Comune: ${invoiceData.cedente.comune}`, 50)
          .text(`Cap: ${invoiceData.cedente.cap}`, 50)
          .text(`Telefono: ${invoiceData.cedente.telefono}`, 50)
          .text(`Email: ${invoiceData.cedente.email}`, 50);

        // COLONNA DESTRA - CESSIONARIO / COMMITTENTE
        const rightX = 300;

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#333')
          .text('Cessionario/Committente', rightX, startY);

        doc.font('Helvetica').fontSize(8).fillColor('#555')
          .text(`Identificativo fiscale ai fini di IVA: ${invoiceData.cessionario.partitaIva}`, rightX, startY + 18)
          .text(`Denominazione: ${invoiceData.cessionario.nome}`, rightX)
          .text(`Indirizzo: ${invoiceData.cessionario.indirizzo}`, rightX)
          .text(`Comune: ${invoiceData.cessionario.comune}`, rightX)
          .text(`Cap: ${invoiceData.cessionario.cap}`, rightX);
          
        doc.moveDown(5);

        //
        // RIGHE — TABELLA
        //
        doc.moveDown(1);
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#333').text('');
        doc.moveDown(0.3);

        const col1 = 50;
        const col2 = 200;
        const col3 = 350;
        const col4 = 450;

        // header sfondo grigio
        doc.save()
          .rect(40, doc.y, 515, 18)
          .fill('#f0f0f0')
          .restore();

        doc.moveDown(0.15);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#333');
        doc.text('Descrizione', col1, doc.y + 3);
        doc.text('Quantità', col2, doc.y + 3);
        doc.text('Prezzo Unit.', col3, doc.y + 3);
        doc.text('Importo', col4, doc.y + 3);

        doc.moveDown(1);

        // righe
        doc.font('Helvetica').fontSize(9).fillColor('#555');

        invoiceData.linee.forEach((linea, idx) => {
          // zebra striping
          if (idx % 2 === 0) {
            doc.save()
              .rect(40, doc.y - 2, 515, 15)
              .fill('#fafafa')
              .restore();
          }

          doc.text(linea.descrizione, col1, doc.y);
          doc.text(String(linea.quantita), col2, doc.y);
          doc.text(String(linea.prezzoUnitario), col3, doc.y);
          doc.text(String(linea.importo), col4, doc.y);

          doc.moveDown(1);
        });

        doc.moveDown(2);

        //
        // TOTALI — PIÙ SIMILI AL MODALE
        //
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#333')
          .text(`Totale Imponibile: ${invoiceData.imponibile} €`);
        doc.text(`IVA (${invoiceData.aliquota}%): ${invoiceData.imposta} €`);
        doc.fontSize(12).text(`TOTALE: ${invoiceData.totale} €`);

        doc.end();
        stream.on('finish', () => resolve());
        stream.on('error', reject);

      } catch (err) {
        reject(err);
      }
    });
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
    await this.generatePDF(invoiceData, tempPath);
    const buffer = readFileSync(tempPath);
    unlinkSync(tempPath);
    return buffer;
  }
}
