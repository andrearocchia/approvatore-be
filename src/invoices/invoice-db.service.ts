import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Invoice } from './invoice-pdf.service';

const prisma = new PrismaClient();

@Injectable()
export class InvoiceDbService {
  async saveInvoice(invoiceData: Omit<Invoice, 'id'>): Promise<number> {
    const invoice = await prisma.invoice.create({
      data: {
        stato: 'in_attesa',
        note: '',
        
        numero: invoiceData.numero,
        data: invoiceData.data,
        tipoDocumento: invoiceData.tipoDocumento,
        divisa: invoiceData.divisa,
        art73: invoiceData.art73,
        causale: invoiceData.causale,
        codiceDestinatario: invoiceData.codiceDestinatario,
        pecDestinatario: invoiceData.pecDestinatario,
        
        cedenteNome: invoiceData.cedente.nome,
        cedentePartitaIva: invoiceData.cedente.partitaIva,
        cedenteCodiceFiscale: invoiceData.cedente.codiceFiscale,
        cedenteRegimeFiscale: invoiceData.cedente.regimeFiscale,
        cedenteIndirizzo: invoiceData.cedente.indirizzo,
        cedenteNumeroCivico: invoiceData.cedente.numeroCivico,
        cedenteCap: invoiceData.cedente.cap,
        cedenteComune: invoiceData.cedente.comune,
        cedenteProvincia: invoiceData.cedente.provincia,
        cedenteNazione: invoiceData.cedente.nazione,
        cedenteEmail: invoiceData.cedente.email,
        cedenteTelefono: invoiceData.cedente.telefono,
        cedenteREAUfficio: invoiceData.cedente.iscrizioneREA?.ufficio,
        cedenteREANumero: invoiceData.cedente.iscrizioneREA?.numeroREA,
        cedenteREACapitale: invoiceData.cedente.iscrizioneREA?.capitaleSociale,
        cedenteREASocioUnico: invoiceData.cedente.iscrizioneREA?.socioUnico,
        cedenteREALiquidazione: invoiceData.cedente.iscrizioneREA?.statoLiquidazione,
        
        cessionarioNome: invoiceData.cessionario.nome,
        cessionarioPartitaIva: invoiceData.cessionario.partitaIva,
        cessionarioCodiceFiscale: invoiceData.cessionario.codiceFiscale,
        cessionarioIndirizzo: invoiceData.cessionario.indirizzo,
        cessionarioNumeroCivico: invoiceData.cessionario.numeroCivico,
        cessionarioCap: invoiceData.cessionario.cap,
        cessionarioComune: invoiceData.cessionario.comune,
        cessionarioProvincia: invoiceData.cessionario.provincia,
        cessionarioNazione: invoiceData.cessionario.nazione,
        
        totale: invoiceData.totale,
        imponibile: invoiceData.imponibile,
        imposta: invoiceData.imposta,
        aliquota: invoiceData.aliquota,
        esigibilitaIVA: invoiceData.esigibilitaIVA,
        
        modalitaPagamento: invoiceData.modalitaPagamento,
        condizioniPagamento: invoiceData.condizioniPagamento,
        dettagliPagamento: invoiceData.dettagliPagamento,
        dataRiferimentoTerminiPagamento: invoiceData.dataRiferimentoTerminiPagamento,
        giorniTerminiPagamento: invoiceData.giorniTerminiPagamento,
        scadenzaPagamento: invoiceData.scadenzaPagamento,
        importoPagamento: invoiceData.importoPagamento,
        
        terzoIntermediarioDenominazione: invoiceData.terzoIntermediario?.denominazione,
        terzoIntermediarioPartitaIva: invoiceData.terzoIntermediario?.partitaIva,
        terzoIntermediarioCodiceFiscale: invoiceData.terzoIntermediario?.codiceFiscale,
        
        soggettoEmittente: invoiceData.soggettoEmittente,
        
        linee: JSON.stringify(invoiceData.linee),
      },
    });
    
    return invoice.codiceUnico;
  }

  async getInvoiceById(codiceUnico: number) {
    const invoice = await prisma.invoice.findUnique({
      where: { codiceUnico },
    });
    
    if (!invoice) return null;
    
    return this.mapToInvoice(invoice);
  }

  async getAllInvoices() {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    return invoices.map(inv => this.mapToInvoice(inv));
  }

  async getStandByInvoices() {
    const invoices = await prisma.invoice.findMany({
      where: { stato: 'in_attesa' },
      orderBy: { createdAt: 'desc' },
    });
    
    return invoices.map(inv => this.mapToInvoice(inv));
  }

  private mapToInvoice(dbInvoice: any): Invoice {
    return {
      id: dbInvoice.codiceUnico.toString(),
      numero: dbInvoice.numero,
      data: dbInvoice.data,
      tipoDocumento: dbInvoice.tipoDocumento,
      divisa: dbInvoice.divisa,
      art73: dbInvoice.art73,
      causale: dbInvoice.causale,
      codiceDestinatario: dbInvoice.codiceDestinatario,
      pecDestinatario: dbInvoice.pecDestinatario,
      
      cedente: {
        nome: dbInvoice.cedenteNome,
        partitaIva: dbInvoice.cedentePartitaIva,
        codiceFiscale: dbInvoice.cedenteCodiceFiscale,
        regimeFiscale: dbInvoice.cedenteRegimeFiscale,
        indirizzo: dbInvoice.cedenteIndirizzo,
        numeroCivico: dbInvoice.cedenteNumeroCivico,
        cap: dbInvoice.cedenteCap,
        comune: dbInvoice.cedenteComune,
        provincia: dbInvoice.cedenteProvincia,
        nazione: dbInvoice.cedenteNazione,
        email: dbInvoice.cedenteEmail,
        telefono: dbInvoice.cedenteTelefono,
        iscrizioneREA: dbInvoice.cedenteREAUfficio ? {
          ufficio: dbInvoice.cedenteREAUfficio,
          numeroREA: dbInvoice.cedenteREANumero,
          capitaleSociale: dbInvoice.cedenteREACapitale,
          socioUnico: dbInvoice.cedenteREASocioUnico,
          statoLiquidazione: dbInvoice.cedenteREALiquidazione,
        } : undefined,
      },
      
      cessionario: {
        nome: dbInvoice.cessionarioNome,
        partitaIva: dbInvoice.cessionarioPartitaIva,
        codiceFiscale: dbInvoice.cessionarioCodiceFiscale,
        indirizzo: dbInvoice.cessionarioIndirizzo,
        numeroCivico: dbInvoice.cessionarioNumeroCivico,
        cap: dbInvoice.cessionarioCap,
        comune: dbInvoice.cessionarioComune,
        provincia: dbInvoice.cessionarioProvincia,
        nazione: dbInvoice.cessionarioNazione,
      },
      
      linee: JSON.parse(dbInvoice.linee),
      
      totale: dbInvoice.totale,
      imponibile: dbInvoice.imponibile,
      imposta: dbInvoice.imposta,
      aliquota: dbInvoice.aliquota,
      esigibilitaIVA: dbInvoice.esigibilitaIVA,
      
      modalitaPagamento: dbInvoice.modalitaPagamento,
      condizioniPagamento: dbInvoice.condizioniPagamento,
      dettagliPagamento: dbInvoice.dettagliPagamento,
      dataRiferimentoTerminiPagamento: dbInvoice.dataRiferimentoTerminiPagamento,
      giorniTerminiPagamento: dbInvoice.giorniTerminiPagamento,
      scadenzaPagamento: dbInvoice.scadenzaPagamento,
      importoPagamento: dbInvoice.importoPagamento,
      
      terzoIntermediario: dbInvoice.terzoIntermediarioDenominazione ? {
        denominazione: dbInvoice.terzoIntermediarioDenominazione,
        partitaIva: dbInvoice.terzoIntermediarioPartitaIva,
        codiceFiscale: dbInvoice.terzoIntermediarioCodiceFiscale,
      } : undefined,
      
      soggettoEmittente: dbInvoice.soggettoEmittente,
    };
  }
}