import { Injectable } from '@nestjs/common';
import { createWriteStream } from 'fs';

const PDFDocument = require('pdfkit');

export interface InvoiceData {
  numero: string;
  data: string;
  tipoDocumento: string;
  art73: string;
  codiceDestinatario: string;
  cedente: {
    nome: string;
    partitaIva: string;
    codiceFiscale?: string;
    regimeFiscale?: string;
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
    codiceArticolo?: string;
    descrizione: string;
    quantita: string;
    prezzoUnitario: string;
    unitaMisura?: string;
    scontoMaggiorazione?: string;
    aliquotaIva?: string;
    importo: string;
  }[];
  totale: string;
  imponibile: string;
  imposta: string;
  aliquota: string;
  modalitaPagamento?: string;
  dettagliPagamento?: string;
  scadenzaPagamento?: string;
  importoPagamento?: string;
}

@Injectable()
export class PdfGeneratorService {
  /**
   * Genera un PDF a partire dai dati della fattura
   */
  public generatePDF(invoiceData: InvoiceData, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const stream = createWriteStream(outputPath);
        doc.pipe(stream);

        // CONTAINER 1: INTESTAZIONE
        this.drawTitle(doc, invoiceData);

        // CONTAINER 2: CEDENTE/CESSIONARIO
        this.drawPartiesSection(doc, invoiceData);

        // CONTAINER 3: TABELLA ARTICOLI
        this.drawItemsTable(doc, invoiceData);

        // TOTALI
        this.drawTotals(doc, invoiceData);

        doc.end();
        stream.on('finish', () => resolve());
        stream.on('error', reject);

      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * CONTAINER 1: INTESTAZIONE e NUMERO-DATA FATTURA
   */
  private drawTitle(doc: any, invoiceData: InvoiceData): void {
    const startY = doc.y;

    doc.fontSize(20).font('Helvetica-Bold').fillColor('#333')
      .text('FATTURA ELETTRONICA', 40, startY, { align: 'center', width: 515 });

    doc.fontSize(10).font('Helvetica').fillColor('#555')
      .text(`Numero: ${invoiceData.numero} | Data: ${invoiceData.data}`, 40, startY + 25, { align: 'center', width: 515 });

    doc.y = startY + 50;

    doc.save()
      .moveTo(40, doc.y)      // x1, y
      .lineTo(555, doc.y)     // x2, stesso y
      .lineWidth(1)
      .strokeColor('#000000')
      .stroke()
      .restore();

    doc.moveDown(1);
  }

  /**
   * CONTAINER 2: CEDENTE/PRESTATORE e CESSIONARIO/COMMITTENTE
   */
  private drawPartiesSection(doc: any, invoiceData: InvoiceData): void {
    const startY = doc.y;

    // SEZIONE SUPERIORE: CEDENTE/PRESTATORE
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#333')
      .text('FORNITORE', 50, startY);

    let yPos = startY + 17;
    doc.font('Helvetica').fontSize(8).fillColor('#555');

    doc.text(`Denominazione:`, 50, yPos);
    doc.text(`${invoiceData.cedente.nome}`, 150, yPos);
    yPos += 10;

    doc.text(`Identificativo fiscale:`, 50, yPos);
    doc.text(`${invoiceData.cedente.partitaIva}`, 150, yPos);
    yPos += 10;

    if (invoiceData.cedente.codiceFiscale) {
      doc.text(`Codice fiscale:`, 50, yPos);
      doc.text(`${invoiceData.cedente.codiceFiscale}`, 150, yPos);
      yPos += 10;
    }

    if (invoiceData.cedente.regimeFiscale) {
      doc.text(`Regime fiscale:`, 50, yPos);
      doc.text(`${invoiceData.cedente.regimeFiscale}`, 150, yPos);
      yPos += 10;
    }

    doc.text(`Indirizzo:`, 50, yPos);
    doc.text(`${invoiceData.cedente.indirizzo}`, 150, yPos);
    yPos += 10;
    doc.text(`Comune:`, 50, yPos);
    doc.text(`${invoiceData.cedente.comune}`, 150, yPos);
    yPos += 10;
    doc.text(`Cap:`, 50, yPos);
    doc.text(`${invoiceData.cedente.cap}`, 150, yPos);
    yPos += 10;
    doc.text(`Telefono:`, 50, yPos);
    doc.text(`${invoiceData.cedente.telefono}`, 150, yPos);
    yPos += 10;
    doc.text(`Email:`, 50, yPos);
    doc.text(`${invoiceData.cedente.email}`, 150, yPos);

    // SEZIONE INFERIORE: CESSIONARIO/COMMITTENTE
    yPos += 20;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#333')
      .text('CLIENTE', 50, yPos);

    yPos += 17;
    doc.font('Helvetica').fontSize(8).fillColor('#555');

    doc.text(`Denominazione:`, 50, yPos);
    doc.text(`${invoiceData.cessionario.nome}`, 150, yPos);
    yPos += 10;
    doc.text(`Identificativo fiscale:`, 50, yPos);
    doc.text(`${invoiceData.cessionario.partitaIva}`, 150, yPos);
    yPos += 10;
    doc.text(`Indirizzo:`, 50, yPos);
    doc.text(`${invoiceData.cessionario.indirizzo}`, 150, yPos);
    yPos += 10;
    doc.text(`Comune:`, 50, yPos);
    doc.text(`${invoiceData.cessionario.comune}`, 150, yPos);

    doc.y = yPos + 20;

    doc.save()
      .moveTo(40, doc.y)      // x1, y
      .lineTo(555, doc.y)     // x2, stesso y
      .lineWidth(1)
      .strokeColor('#000000')
      .stroke()
      .restore();

    doc.moveDown(1);
  }

  /**
   * CONTAINER 3: TABELLA ARTICOLI
   */
  private drawItemsTable(doc: any, invoiceData: InvoiceData): void {
    const startY = doc.y;
    const rowHeight = 20;

    // Colonne/intestazioni
    const columns = [
      { label: 'Codice', x: 50, width: 50 },
      { label: 'Descrizione', x: 100, width: 200 },
      { label: 'Q.tà', x: 300, width: 35 },
      { label: 'Prezzo', x: 335, width: 50 },
      { label: 'UM', x: 385, width: 25 },
      { label: 'Sconto', x: 410, width: 45 },
      { label: '%IVA', x: 455, width: 30 },
      { label: 'Totale', x: 485, width: 65 }
    ];

    // Header
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#333');
    columns.forEach(col => {
      doc.text(col.label, col.x, startY);
    });

    let currentY = startY + rowHeight;

    // Righe dati
    doc.font('Helvetica').fontSize(9).fillColor('#555');

    invoiceData.linee.forEach((linea) => {
      doc.text(linea.codiceArticolo || '-', columns[0].x, currentY, { width: columns[0].width });
      doc.text(linea.descrizione, columns[1].x, currentY, { width: columns[1].width });
      doc.text(this.formatNumber(linea.quantita), columns[2].x, currentY, { width: columns[2].width });
      doc.text(this.formatNumber(linea.prezzoUnitario), columns[3].x, currentY, { width: columns[3].width });
      doc.text(linea.unitaMisura || '-', columns[4].x, currentY, { width: columns[4].width });
      doc.text(linea.scontoMaggiorazione ? this.formatNumber(linea.scontoMaggiorazione) : '-', columns[5].x, currentY, { width: columns[5].width });
      doc.text(linea.aliquotaIva ? this.formatNumber(linea.aliquotaIva) : '-', columns[6].x, currentY, { width: columns[6].width });
      doc.text(this.formatNumber(linea.importo), columns[7].x, currentY, { width: columns[7].width });

      currentY += rowHeight;
    });
  }

  /**
   * Funzione per formattare i numeri a 2 decimali
   */
  private formatNumber(value: string | number): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '-' : num.toFixed(2);
  }

  /**
   * TOTALI
   */
  private drawTotals(doc: any, invoiceData: InvoiceData): void {
    const startY = doc.y + 30;
    const startX = 50;

    doc.save()
      .moveTo(40, startY)      // x1, y
      .lineTo(555, startY)     // x2, stesso y
      .lineWidth(1)
      .strokeColor('#000000')
      .stroke()
      .restore();

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#333')
    .text(`TOTALI`, startX, startY + 10)

    let yPos = startY + 30;
    doc.font('Helvetica').fontSize(10).fillColor('#555')
      .text(`Totale Imponibile:`, startX, yPos)
      .text(`${invoiceData.imponibile} €`, 150, yPos);
    yPos += 10;

    doc.text(`IVA (${invoiceData.aliquota ?? '-' }%):`, startX, yPos);
    doc.text(`${invoiceData.imposta} €`, 150, yPos);
    yPos += 15;
    
    doc.save()
      .moveTo(startX, yPos)      // x1, y
      .lineTo(200, yPos)     // x2, stesso y
      .lineWidth(1)
      .strokeColor('#000000')
      .stroke()
      .restore();      

    yPos += 10;

    doc.text(`TOTALE:`, startX, yPos);
    doc.text(`${invoiceData.totale} €`, 150, yPos);
    yPos += 10;

    if (invoiceData.modalitaPagamento) {
      doc.moveDown(1);
      doc.fontSize(10).font('Helvetica').fillColor('#555');
      doc.text(`Modalità pagamento:`);
      doc.text(`${invoiceData.modalitaPagamento}`);
      
      if (invoiceData.scadenzaPagamento) {
        doc.text(`Scadenza:`);
        doc.text(`${invoiceData.scadenzaPagamento}`);
      }
      if (invoiceData.importoPagamento) {
        doc.text(`Importo:`);
        doc.text(`${invoiceData.importoPagamento} €`);
      }
    }
  }
}