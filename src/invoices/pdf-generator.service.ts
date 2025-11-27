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

        const drawContainer = (y: number, height: number) => {
        doc.save()
          .rect(40, y, 515, height)
          .lineWidth(1)
          .strokeColor('#000000')
          .stroke()
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
        // CEDENTE / CESSIONARIO
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
        // TABELLA TIPO DOCUMENTO
        //
        this.drawDocumentInfoTable(doc, invoiceData, drawContainer);

        //
        // RIGHE – TABELLA
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
        // TOTALI
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

  /**
   * Disegna la tabella con le informazioni del documento
   */
  private drawDocumentInfoTable(doc: any, invoiceData: InvoiceData, drawContainer: Function): void {
    doc.moveDown(1);

    const tableStartY = doc.y;
    const rowHeight = 20;
    const tableHeight = rowHeight * 2; // header + 1 riga dati

    // Disegna il container principale
    drawContainer(tableStartY - 5, tableHeight);

    // Definisci le colonne
    const col1X = 50;
    const col2X = 140;
    const col3X = 230;
    const col4X = 340;
    const col5X = 450;

    // HEADER con sfondo grigio
    doc.save()
      .rect(40, tableStartY - 5, 515, rowHeight)
      .fill('#f0f0f0')
      .restore();

    // Testi header
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#333');
    const headerY = tableStartY;
    doc.text('Tipologia documento', col1X, headerY);
    doc.text('Art.73', col2X, headerY);
    doc.text('Numero documento', col3X, headerY);
    doc.text('Data documento', col4X, headerY);
    doc.text('Codice destinatario', col5X, headerY);

    // RIGA DATI
    doc.font('Helvetica').fontSize(8).fillColor('#555');
    const dataY = tableStartY + rowHeight;
    
    // Mappa tipo documento (codici standard fattura elettronica)
    const tipoDocumentoMap: { [key: string]: string } = {
      'TD01': 'Fattura',
      'TD02': 'Acconto/Anticipo su fattura',
      'TD03': 'Acconto/Anticipo su parcella',
      'TD04': 'Nota di Credito',
      'TD05': 'Nota di Debito',
      'TD06': 'Parcella',
      'TD20': 'Autofattura',
      'TD21': 'Autofattura per splafonamento',
      'TD22': 'Estrazione beni da Deposito IVA',
      'TD23': 'Estrazione beni da Deposito IVA con versamento IVA',
      'TD24': 'Fattura differita',
      'TD25': 'Fattura differita di cui art.21 c.4 lett. a)',
      'TD26': 'Cessione di beni ammortizzabili',
      'TD27': 'Fattura per autoconsumo'
    };

    const tipoDocText = tipoDocumentoMap[invoiceData.tipoDocumento] || invoiceData.tipoDocumento;
    
    doc.text(tipoDocText, col1X, dataY);
    doc.text(invoiceData.art73, col2X, dataY);
    doc.text(invoiceData.numero, col3X, dataY);
    doc.text(invoiceData.data, col4X, dataY);
    doc.text(invoiceData.codiceDestinatario, col5X, dataY);

    doc.moveDown(2);
  }
}