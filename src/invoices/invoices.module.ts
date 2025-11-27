import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicePdfService } from './invoice-pdf.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicePdfService],
  exports: [InvoicePdfService],
})
export class InvoicesModule {}