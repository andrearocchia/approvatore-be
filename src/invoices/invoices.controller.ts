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
  Body,
  Res,
  Query
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceDbService } from './invoice-db.service';
import { StatoFattura } from '@prisma/client';
import { readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly pdfService: InvoicePdfService,
    private readonly invoiceDbService: InvoiceDbService,
  ) {}

  // Endpoint POST Arca: Caricamento e elaborazione fatture XML
 @Post('xmlApprove')
  @UseInterceptors(FilesInterceptor('file'))
  async convertXmlToPdf(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('approvatore') approvatore: string,
    @Body('protocolloIva') protocolloIva: string,
    @Body('noteInInvio') noteInInvio: string
  ) {
    try {
      if (!files || files.length === 0) {
        throw new HttpException(
          { success: false, message: 'Nessun file XML caricato' },
          HttpStatus.BAD_REQUEST
        );
      }

      if (!approvatore) {
        throw new HttpException(
          { success: false, message: 'Campo approvatore mancante' },
          HttpStatus.BAD_REQUEST
        );
      }

      if (!protocolloIva) {
        throw new HttpException(
          { success: false, message: 'Campo protocolloIva mancante' },
          HttpStatus.BAD_REQUEST
        );
      }

      const protocolloIvaNum = parseInt(protocolloIva, 10);
      if (isNaN(protocolloIvaNum)) {
        throw new HttpException(
          { success: false, message: 'protocolloIva deve essere un numero valido' },
          HttpStatus.BAD_REQUEST
        );
      }

      const processingPromises = files.map(async (file) => {
        try {
          const xmlContent = file.buffer.toString('utf-8');
          const codiceUnico = await this.pdfService.processXmlAndGeneratePdf(
            xmlContent, 
            approvatore,
            protocolloIvaNum,
            noteInInvio || ''
          );
          
          return { 
            success: true, 
            codiceUnico, 
            filename: file.originalname,
            error: null,
          };
        } catch (error) {
          return { 
            success: false, 
            codiceUnico: null,
            filename: file.originalname, 
            error: error.message || 'Errore di elaborazione sconosciuto',
          };
        }
      });

      const allResults = await Promise.all(processingPromises);

      const results = allResults.filter(r => r.success);
      const errors = allResults
        .filter(r => !r.success)
        .map(r => ({ success: false, filename: r.filename, message: r.error }));

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

  // Endpoint ottieni tutte le fatture
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

  // Endpoint ottieni tutte le fatture per un approvatore
  @Get('standby/:approvatore')
  async getStandByInvoices(@Param('approvatore') approvatore: string) {
    try {
      const invoices = await this.invoiceDbService.getStandByInvoices(approvatore);
      return { success: true, invoices };
    } catch (error) {
      console.error('Errore recupero fatture in attesa:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Endpoint con paginazione e filtri
  @Get('processed')
  async getProcessedInvoices(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('dataDa') dataDa?: string,
    @Query('dataA') dataA?: string,
    @Query('numeroFattura') numeroFattura?: string,
    @Query('fornitore') fornitore?: string,
    @Query('stato') stato?: string,
  ) {
    try {
      const pageNum = page ? parseInt(page, 10) : 1;
      const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 15;

      const filters = {
        dataDa,
        dataA,
        numeroFattura,
        fornitore,
        stato,
      };

      const result = await this.invoiceDbService.getProcessedInvoices(
        pageNum,
        pageSizeNum,
        filters
      );

      return { 
        success: true, 
        ...result
      };
    } catch (error) {
      console.error('Errore recupero fatture elaborate:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Endpoint GET Arca: Verifica stato approvazione fattura
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

  // Endpoint ottieni pdf per codice unico
  @Get(':codiceUnico/pdf')
  async getInvoicePdf(
    @Param('codiceUnico') codiceUnico: string,
    @Res() res: Response
  ) {
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
      
      if (!existsSync(pdfPath)) {
        throw new HttpException(
          { success: false, message: 'File PDF non esistente' },
          HttpStatus.NOT_FOUND,
        );
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${pdfFile}"`);
      res.sendFile(pdfPath);
    } catch (error) {
      console.error('Errore recupero PDF:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Endpoint ottieni stato per codice unico
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