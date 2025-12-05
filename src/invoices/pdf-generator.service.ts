import { Injectable } from '@nestjs/common';
import { createWriteStream } from 'fs';
import { Invoice } from './invoice.interface';

const PDFDocument = require('pdfkit');

@Injectable()
export class PdfGeneratorService {

  private readonly STYLES = {
    title: { size: 20, font: 'Helvetica-Bold', color: '#333' },
    subtitle: { size: 10, font: 'Helvetica', color: '#555' },
    sectionTitle: { size: 10, font: 'Helvetica-Bold', color: '#333' },
    body: { size: 8, font: 'Helvetica', color: '#555' },
    table: { size: 7, font: 'Helvetica', color: '#555' },
    tableHeader: { size: 7, font: 'Helvetica-Bold', color: '#333' },
    rowHeight: 14,
    margins: { page: 40, section: 20 }
  };

  private applyStyle(doc: any, styleKey: keyof PdfGeneratorService['STYLES']) {
    const s = this.STYLES[styleKey] as any;
    if (!s.size) return;
    doc.fontSize(s.size).font(s.font).fillColor(s.color);
  }

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
        this.drawPaymentDetails(doc, invoiceData);

        doc.end();
        stream.on('finish', () => resolve());
        stream.on('error', reject);

      } catch (err) {
        reject(err);
      }
    });
  }

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

    doc.moveDown(2);
  }

  private drawItemsTable(doc: any, invoiceData: Omit<Invoice, 'id'>): void {
    const startX = 40;
    const endX = 560;

    // Altezza minima riga
    const baseRowHeight = 16;

    // Font tabella
    this.applyStyle(doc, "table");

    const columns = [
      { key: "codiceArticolo", label: "Codice", x: 40, width: 55 },
      { key: "descrizione", label: "Descrizione", x: 100, width: 215 },
      { key: "quantita", label: "Q.tà", x: 320, width: 40 },
      { key: "prezzoUnitario", label: "Prezzo", x: 365, width: 60 },
      { key: "unitaMisura", label: "UM", x: 430, width: 28 },
      { key: "scontoMaggiorazione", label: "Sconto", x: 463, width: 28 },
      { key: "aliquotaIva", label: "%IVA", x: 494, width: 26 },
      { key: "importo", label: "Totale", x: 525, width: 45 },
    ];

    // HEADER
    this.applyStyle(doc, "tableHeader");
    let y = doc.y;

    doc.moveTo(startX, y).lineTo(endX, y).stroke();
    y += 4;

    columns.forEach(col =>
      doc.text(col.label, col.x, y, { width: col.width })
    );

    y += baseRowHeight;
    doc.moveTo(startX, y).lineTo(endX, y).stroke();

    this.applyStyle(doc, "table");

    // ROWS
    invoiceData.linee.forEach((line) => {
      const cleanDesc = (line.descrizione || "").replace(/\|/g, " ");

      // Calcolo altezza descrizione
      const dHeight = doc.heightOfString(cleanDesc, {
        width: 200,
        align: "left",
      });

      // Altezza riga = max tra min-base + altezza testo
      let rowHeight = Math.max(baseRowHeight, dHeight + 6);

      // Hard limit per sicurezza
      if (rowHeight > 40) rowHeight = 40;

      // Page break intelligente
      const bottomPage = doc.page.height - doc.page.margins.bottom - 40;
      if (y + rowHeight > bottomPage) {
        doc.addPage();
        y = doc.y;

        // ridisegno header breve
        this.applyStyle(doc, "tableHeader");
        doc.moveTo(startX, y).lineTo(endX, y).stroke();
        y += 4;
        columns.forEach(col =>
          doc.text(col.label, col.x, y, { width: col.width })
        );
        y += baseRowHeight;
        doc.moveTo(startX, y).lineTo(endX, y).stroke();
        this.applyStyle(doc, "table");
      }

      const textY = y + 5;

      columns.forEach((col) => {
        const value =
          col.key === "descrizione"
            ? cleanDesc
            : (line[col.key] || "-");

        doc.text(value, col.x, textY, {
          width: col.width,
          align: "left",
        });
      });

      // linea inferiore della riga
      y += rowHeight;
      doc
        .moveTo(startX, y)
        .lineTo(endX, y)
        .lineWidth(0.5)
        .strokeColor("#aaa")
        .stroke();
    });

    doc.y = y + 20;
  }

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

    doc.y = yPos + 30;
  }

  private drawPaymentDetails(doc: any, invoiceData: Omit<Invoice, 'id'>): void {
    if (!invoiceData.dettagliPagamento || invoiceData.dettagliPagamento.length === 0) {
      return;
    }

    const startY = doc.y;
    const startX1 = 50;
    const startX2 = 200;

    doc.save()
      .moveTo(startX1, startY)
      .lineTo(555, startY)
      .lineWidth(1)
      .strokeColor('#000000')
      .stroke()
      .restore();

    let yPos = startY + 15;

    this.applyStyle(doc, 'sectionTitle');
    doc.text('DETTAGLI PAGAMENTO', startX1, yPos);
    yPos += 20;

    if (invoiceData.condizioniPagamento) {
      this.applyStyle(doc, 'body');
      doc.text(`Condizioni:`, startX1, yPos);
      doc.text(`${invoiceData.condizioniPagamento}`, startX2, yPos);
      yPos += 15;
    }

    invoiceData.dettagliPagamento.forEach((dettaglio, index) => {
      if (invoiceData.dettagliPagamento.length > 1) {
        this.applyStyle(doc, 'sectionTitle');
        doc.text(`Rata ${index + 1}:`, startX1, yPos);
        yPos += 15;
      }

      this.applyStyle(doc, 'body');

      if (dettaglio.modalitaPagamentoDescrizione) {
        doc.text(`Modalità:`, startX1, yPos);
        doc.text(`${dettaglio.modalitaPagamentoDescrizione} (${dettaglio.modalitaPagamento})`, startX2, yPos);
        yPos += 12;
      }

      if (dettaglio.importoPagamento) {
        doc.text(`Importo:`, startX1, yPos);
        doc.text(`${dettaglio.importoPagamento}`, startX2, yPos);
        yPos += 12;
      }

      if (dettaglio.dataScadenzaPagamento) {
        doc.text(`Scadenza:`, startX1, yPos);
        doc.text(`${dettaglio.dataScadenzaPagamento}`, startX2, yPos);
        yPos += 12;
      }

      if (dettaglio.iban) {
        doc.text(`IBAN:`, startX1, yPos);
        doc.text(`${dettaglio.iban}`, startX2, yPos);
        yPos += 12;
      }

      if (dettaglio.beneficiario) {
        doc.text(`Beneficiario:`, startX1, yPos);
        doc.text(`${dettaglio.beneficiario}`, startX2, yPos);
        yPos += 12;
      }

      if (index < invoiceData.dettagliPagamento.length - 1) {
        yPos += 10;
      }
    });
  }
}