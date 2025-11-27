import { Controller, Post, Get, Body, HttpException, HttpStatus } from '@nestjs/common';
import { InvoicePdfService } from './invoice-pdf.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private pdfService: InvoicePdfService) {}

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

  @Get('list')
  async listInvoices() {
    try {
      const invoices = await this.pdfService.listInvoicesFromXml();
      return {
        success: true,
        invoices,
      };
    } catch (error) {
      console.error('Errore nel listare fatture:', error.message);
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate-pdf')
  async generatePdf(@Body() invoiceData: any) {
    try {
      const buffer = await this.pdfService.generatePdfFromData(invoiceData);
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