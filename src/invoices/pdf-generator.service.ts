import { Injectable } from '@nestjs/common';
import { createWriteStream } from 'fs';
import { Invoice } from './invoice-pdf.service';

const PDFDocument = require('pdfkit');

@Injectable()
export class PdfGeneratorService {

  // STYLES CENTRALIZZATI
  private readonly STYLES = {
    title: { size: 20, font: 'Helvetica-Bold', color: '#333' },
    subtitle: { size: 10, font: 'Helvetica', color: '#555' },
    sectionTitle: { size: 10, font: 'Helvetica-Bold', color: '#333' },
    body: { size: 8, font: 'Helvetica', color: '#555' },
    table: { size: 9, font: 'Helvetica', color: '#555' },
    tableHeader: { size: 9, font: 'Helvetica-Bold', color: '#333' },
    rowHeight: 20,
    margins: { page: 40, section: 20 }
  };

  // Helper per applicare gli stili
  private applyStyle(doc: any, styleKey: keyof PdfGeneratorService['STYLES']) {
    const s = this.STYLES[styleKey] as any;
    if (!s.size) return; // evita errori sui valori numerici come rowHeight
    doc.fontSize(s.size).font(s.font).fillColor(s.color);
  }

  /**
   * Genera un PDF a partire dai dati della fattura
   */
  public generatePDF(invoiceData: Omit<Invoice, 'id'>, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const stream = createWriteStream(outputPath);
        doc.pipe(stream);

        this.drawTitle(doc, invoiceData);
        this.drawPartiesSection(doc, invoiceData);
        this.drawItemsTable(doc, invoiceData);
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
   * CONTAINER 1: INTESTAZIONE
   */
  private drawTitle(doc: any, invoiceData: Omit<Invoice, 'id'>): void {
    const startY = doc.y;

    this.applyStyle(doc, 'title');
    doc.text('FATTURA ELETTRONICA', 40, startY, { align: 'center', width: 515 });

    this.applyStyle(doc, 'subtitle');
    doc.text(`Numero: ${invoiceData.numero} | Data: ${invoiceData.data}`, 40, startY + 25, { align: 'center', width: 515 });

    doc.y = startY + 50;

    doc.save()
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .lineWidth(1)
      .strokeColor('#000000')
      .stroke()
      .restore();

    doc.moveDown(1);
  }

  /**
   * CONTAINER 2: CEDENTE/PRESTATORE e CESSIONARIO/COMMITTENTE
   */
  private drawPartiesSection(doc: any, invoiceData: Omit<Invoice, 'id'>): void {
    const startY = doc.y;

    this.applyStyle(doc, 'sectionTitle');
    doc.text('FORNITORE', 50, startY);

    let yPos = startY + 17;
    this.applyStyle(doc, 'body');

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

    if (invoiceData.cedente.telefono) {
      doc.text(`Telefono:`, 50, yPos);
      doc.text(`${invoiceData.cedente.telefono}`, 150, yPos);
      yPos += 10;
    }

    if (invoiceData.cedente.email) {
      doc.text(`Email:`, 50, yPos);
      doc.text(`${invoiceData.cedente.email}`, 150, yPos);
    }

    yPos += 20;

    this.applyStyle(doc, 'sectionTitle');
    doc.text('CLIENTE', 50, yPos);

    yPos += 17;
    this.applyStyle(doc, 'body');

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
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .lineWidth(1)
      .strokeColor('#000000')
      .stroke()
      .restore();

    doc.moveDown(1);
  }

  /**
   * CONTAINER 3: TABELLA ARTICOLI
   */
  private drawItemsTable(doc: any, invoiceData: Omit<Invoice, 'id'>): void {
    const startY = doc.y;

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

    this.applyStyle(doc, 'tableHeader');
    columns.forEach(col => {
      doc.text(col.label, col.x, startY);
    });

    let currentY = startY + this.STYLES.rowHeight;

    this.applyStyle(doc, 'table');

    invoiceData.linee.forEach((linea) => {
      doc.text(linea.codiceArticolo || '-', columns[0].x, currentY, { width: columns[0].width });
      doc.text(linea.descrizione, columns[1].x, currentY, { width: columns[1].width });
      doc.text(linea.quantita, columns[2].x, currentY);
      doc.text(linea.prezzoUnitario, columns[3].x, currentY);
      doc.text(linea.unitaMisura || '-', columns[4].x, currentY);
      doc.text(linea.scontoMaggiorazione || '-', columns[5].x, currentY);
      doc.text(linea.aliquotaIva || '-', columns[6].x, currentY);
      doc.text(linea.importo, columns[7].x, currentY);

      currentY += this.STYLES.rowHeight;
    });
  }

  /**
   * TOTALI
   */
  private drawTotals(doc: any, invoiceData: Omit<Invoice, 'id'>): void {
    const startY = doc.y + 30;
    const startX1 = 400;
    const startX2 = 500;

    doc.save()
      .moveTo(50, startY)
      .lineTo(startX2 + 55, startY)
      .lineWidth(1)
      .strokeColor('#000000')
      .stroke()
      .restore();

    this.applyStyle(doc, 'sectionTitle');
    doc.text(`TOTALI`, startX1, startY + 10);

    let yPos = startY + 30;

    this.applyStyle(doc, 'subtitle');
    doc.text(`Totale Imponibile:`, startX1, yPos);
    doc.text(`${invoiceData.imponibile}`, startX2, yPos);
    yPos += 15;

    doc.text(`IVA (${invoiceData.aliquota ?? '-'}%):`, startX1, yPos);
    doc.text(`${invoiceData.imposta}`, startX2, yPos);
    yPos += 20;

    doc.save()
      .moveTo(startX1, yPos)
      .lineTo(startX2 + 55, yPos)
      .lineWidth(1)
      .strokeColor('#000000')
      .stroke()
      .restore();

    yPos += 15;

    this.applyStyle(doc, 'sectionTitle');
    doc.text(`TOTALE:`, startX1, yPos);
    doc.text(`${invoiceData.totale}`, startX2, yPos);

    yPos += 30;

    doc.save()
      .moveTo(startX1, yPos)
      .lineTo(startX2 + 55, yPos)
      .lineWidth(1)
      .strokeColor('#000000')
      .stroke()
      .restore();

    yPos += 15;

    if (invoiceData.modalitaPagamento) {
      this.applyStyle(doc, 'subtitle');
      doc.text(`Modalità pagamento:`, startX1, yPos);
      doc.text(`${invoiceData.modalitaPagamento}`, startX2, yPos);
      yPos += 15;

      if (invoiceData.scadenzaPagamento) {
        doc.text(`Scadenza:`, startX1, yPos);
        doc.text(`${invoiceData.scadenzaPagamento}`, startX2, yPos);
        yPos += 15;
      }

      if (invoiceData.importoPagamento) {
        doc.text(`Importo da pagare:`, startX1, yPos);
        doc.text(`${invoiceData.importoPagamento}`, startX2, yPos);
      }
    }
  }
}