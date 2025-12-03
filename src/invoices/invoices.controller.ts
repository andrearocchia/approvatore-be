import { 
  Controller, 
  Post, 
  Get, 
  HttpException, 
  HttpStatus, 
  Param, 
  Patch,
  UseInterceptors,
  UploadedFile,
  Body
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceDbService } from './invoice-db.service';
import { StatoFattura } from '@prisma/client';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly pdfService: InvoicePdfService,
    private readonly invoiceDbService: InvoiceDbService,
  ) {}

  @Post('xmlApprove')
  @UseInterceptors(FileInterceptor('file'))
  async convertXmlToPdf(@UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) {
        throw new HttpException(
          { success: false, message: 'File XML mancante' },
          HttpStatus.BAD_REQUEST
        );
      }

      const xmlContent = file.buffer.toString('utf-8');
      const codiceUnico = await this.pdfService.processXmlAndGeneratePdf(xmlContent);

      return {
        success: true,
        codiceUnico,
        message: 'Fattura elaborata con successo'
      };
    } catch (error) {
      console.error('Errore elaborazione fattura:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('all')
  async getAllInvoices() {
    try {
      const invoices = await this.invoiceDbService.getAllInvoices();
      return { success: true, invoices };
    } catch (error) {
      console.error('Errore recupero fatture:', error.message);
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
      return { success: true, invoices };
    } catch (error) {
      console.error('Errore recupero fatture in attesa:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':codiceUnico')
  async getInvoiceStatusAndNote(@Param('codiceUnico') codiceUnico: string) {
    try {
      const invoice = await this.invoiceDbService.getInvoiceById(parseInt(codiceUnico));
      
      if (!invoice) {
        throw new HttpException(
          { success: false, message: 'Fattura non trovata' },
          HttpStatus.NOT_FOUND,
        );
      }

      // Restituisci solo stato e note
      const { stato, note } = invoice;
      
      return { success: true, stato, note };
    } catch (error) {
      console.error('Errore recupero fattura:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':codiceUnico/pdf')
  async getInvoicePdf(@Param('codiceUnico') codiceUnico: string) {
    try {
      const pdfDir = resolve(process.cwd(), process.env.PDF_OUTPUT_DIR || './pdf');
      
      const files = readdirSync(pdfDir);
      const pdfFile = files.find(f => 
        f.startsWith(`fattura-${codiceUnico}-`) && f.endsWith('.pdf')
      );

      if (!pdfFile) {
        throw new HttpException(
          { success: false, message: 'PDF non trovato' },
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
      console.error('Errore recupero PDF:', error.message);
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
      const validStates: StatoFattura[] = ['in_attesa', 'approvato', 'rifiutato'];
      if (!validStates.includes(body.stato as StatoFattura)) {
        throw new HttpException(
          { success: false, message: `Stato non valido: ${body.stato}` },
          HttpStatus.BAD_REQUEST
        );
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
      console.error('Errore aggiornamento stato:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}