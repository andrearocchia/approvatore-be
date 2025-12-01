import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as chokidar from 'chokidar';
import * as fs from 'fs-extra';
import * as path from 'path';
import { InvoiceDbService } from './invoice-db.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { parseStringPromise } from 'xml2js';

@Injectable()
export class InvoiceWatcherService implements OnModuleInit {
  private readonly logger = new Logger(InvoiceWatcherService.name);
  private readonly watchDir = process.env.INVOICE_OUTPUT_DIR || 'C:/Users/andrea.rocchia/Projects/progetto_eapproval/esempio_fatture/xml';

  constructor(
    private readonly invoiceDb: InvoiceDbService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  onModuleInit() {
    this.logger.log(`Starting XML watcher on ${this.watchDir}`);

    const watcher = chokidar.watch(this.watchDir, {
      persistent: true,
      ignoreInitial: false,
      depth: 0,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      },
    });

    watcher.on('add', async (filePath) => {
      if (path.extname(filePath).toLowerCase() !== '.xml') return;
      this.logger.log(`New XML file detected: ${filePath}`);
      
      try {
        const xmlContent = await fs.readFile(filePath, 'utf-8');
        const cleanXml = xmlContent
          .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
          .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;');

        const parsed = await parseStringPromise(cleanXml, { 
          explicitArray: true, 
          mergeAttrs: false, 
          normalize: true, 
          trim: true 
        });

        const invoiceData = this.invoicePdf.extractInvoiceData(parsed);

        // Salva nel DB
        const codiceUnico = await this.invoiceDb.saveInvoice(invoiceData);
        this.logger.log(`Invoice saved in DB with codiceUnico: ${codiceUnico}`);

        // Genera PDF
        await this.invoicePdf.generatePdf(invoiceData, codiceUnico);
        this.logger.log(`PDF generated for invoice: ${codiceUnico}`);

        // Cancella file XML
        await fs.remove(filePath);
        this.logger.log(`XML file deleted: ${filePath}`);
        
      } catch (err) {
        this.logger.error(`Error processing file ${filePath}`, err);
      }
    });

    watcher.on('error', error => {
      this.logger.error('Watcher error:', error);
    });
  }
}