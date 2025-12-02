import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicePdfService } from './invoice-pdf.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { InvoiceDbService } from './invoice-db.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicePdfService, PdfGeneratorService, InvoiceDbService],
  exports: [InvoicePdfService, InvoiceDbService],
})
export class InvoicesModule {}