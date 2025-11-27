import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicePdfService } from './invoice-pdf.service';
import { PdfGeneratorService } from './pdf-generator.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicePdfService, PdfGeneratorService],
  exports: [InvoicePdfService],
})
export class InvoicesModule {}