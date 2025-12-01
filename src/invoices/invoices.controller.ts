import { Controller, Post, Get, Body, HttpException, HttpStatus, Param, Patch } from '@nestjs/common';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceDbService } from './invoice-db.service';
import { StatoFattura } from '@prisma/client';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private pdfService: InvoicePdfService,
    private invoiceDbService: InvoiceDbService,
  ) {}

  @Post('xml-to-pdf')
  async convertXmlToPdf(@Body() body: { xmlContent: string }) {
    try {
      if (!body.xmlContent) {
        throw new Error('xmlContent mancante nel body');
      }

      const pdf = await this.pdfService.convertXMLToPDF(body.xmlContent);
      
      return {
        success: true,
        pdf: pdf.toString('base64'),
      };
    } catch (error) {
      console.error('Errore nel controller:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('parse-xml-files')
  async parseXmlFiles() {
    try {
      await this.pdfService.parseAndSaveXmlFiles();
      return {
        success: true,
        message: 'File XML parsati e salvati in DB',
      };
    } catch (error) {
      console.error('Errore nel parsing XML:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('all')
  async getAllInvoices() {
    try {
      const invoices = await this.invoiceDbService.getAllInvoices();
      return {
        success: true,
        invoices,
      };
    } catch (error) {
      console.error('Errore nel recupero fatture:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('standby')
  async getStandByInvoices() {
    try {
      const invoices = await this.invoiceDbService.getStandByInvoices();
      return {
        success: true,
        invoices,
      };
    } catch (error) {
      console.error('Errore nel recupero fatture in attesa:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':codiceUnico')
  async getInvoiceById(@Param('codiceUnico') codiceUnico: string) {
    try {
      const invoice = await this.invoiceDbService.getInvoiceById(parseInt(codiceUnico));
      
      if (!invoice) {
        throw new HttpException(
          { success: false, message: 'Fattura non trovata' },
          HttpStatus.NOT_FOUND,
        );
      }
      
      return {
        success: true,
        invoice,
      };
    } catch (error) {
      console.error('Errore nel recupero fattura:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':codiceUnico/pdf')
  async getInvoicePdf(@Param('codiceUnico') codiceUnico: string) {
    try {
      const pdfDir = process.env.PDF_OUTPUT_DIR;
      if (!pdfDir) {
        throw new Error('PDF_OUTPUT_DIR non configurata');
      }

      // Cerca il file PDF con il codiceUnico
      const files = readdirSync(pdfDir);
      const pdfFile = files.find(f => 
        f.startsWith(`fattura-${codiceUnico}-`) && f.endsWith('.pdf')
      );

      if (!pdfFile) {
        throw new HttpException(
          { success: false, message: 'PDF non trovato per questa fattura' },
          HttpStatus.NOT_FOUND,
        );
      }

      const pdfPath = join(pdfDir, pdfFile);
      const buffer = readFileSync(pdfPath);

      return {
        success: true,
        pdf: buffer.toString('base64'),
        filename: pdfFile,
      };
    } catch (error) {
      console.error('Errore nel recupero PDF:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':codiceUnico/status')
  async updateInvoiceStatus(
    @Param('codiceUnico') codiceUnico: string,
    @Body() body: { stato: string; note?: string }
  ) {
    try {
      // Validazione dello stato
      const validStates: StatoFattura[] = ['in_attesa', 'approvato', 'rifiutato'];
      if (!validStates.includes(body.stato as StatoFattura)) {
        throw new Error(`Stato non valido: ${body.stato}`);
      }

      await this.invoiceDbService.updateInvoiceStatus(
        parseInt(codiceUnico),
        body.stato as StatoFattura,
        body.note
      );
      
      return {
        success: true,
        message: 'Stato fattura aggiornato',
      };
    } catch (error) {
      console.error('Errore nell\'aggiornamento stato:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate-pdf')
  async generatePdf(@Body() body: { invoiceData: any; codiceUnico?: number }) {
    try {
      const buffer = await this.pdfService.generatePdf(
        body.invoiceData,
        body.codiceUnico,
      );
      const base64 = buffer.toString('base64');
      return { pdf: base64 };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}