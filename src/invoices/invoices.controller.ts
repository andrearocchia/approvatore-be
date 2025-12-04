import { 
  Controller, 
  Post, 
  Get, 
  HttpException, 
  HttpStatus, 
  Param, 
  Patch,
  UseInterceptors,
  UploadedFiles,
  Body
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(FilesInterceptor('file', 10))
  async convertXmlToPdf(@UploadedFiles() files: Express.Multer.File[]) {
    try {
      if (!files || files.length === 0) {
        throw new HttpException(
          { success: false, message: 'Nessun file XML caricato' },
          HttpStatus.BAD_REQUEST
        );
      }

      const results: { success: true; codiceUnico: number; filename: string }[] = [];
      const errors: { success: false; filename: string; message: string }[] = [];

      for (const file of files) {
        try {
          const xmlContent = file.buffer.toString('utf-8');
          const codiceUnico = await this.pdfService.processXmlAndGeneratePdf(xmlContent);
          results.push({ 
            success: true, 
            codiceUnico, 
            filename: file.originalname 
          });
        } catch (error) {
          errors.push({ 
            success: false, 
            filename: file.originalname, 
            message: error.message 
          });
        }
      }

      return {
        success: errors.length === 0,
        processed: results.length,
        failed: errors.length,
        results,
        errors
      };
    } catch (error) {
      console.error('Errore elaborazione fatture:', error.message);
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

  @Get('processed')
  async getProcessedInvoices() {
    try {
      const invoices = await this.invoiceDbService.getProcessedInvoices();
      return { success: true, invoices };
    } catch (error) {
      console.error('Errore recupero fatture elaborate:', error.message);
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