import { Injectable } from '@nestjs/common';
import { PrismaClient, StatoFattura } from '@prisma/client';
import { Invoice } from './invoice.interface';

const prisma = new PrismaClient();

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ProcessedInvoicesFilters {
  dataDa?: string;
  dataA?: string;
  numeroFattura?: string;
  fornitore?: string;
  stato?: string;
}

@Injectable()
export class InvoiceDbService {

  // Salva fattura in db
  async saveInvoice(
    invoiceData: Omit<Invoice, 'id'>, 
    approvatore: string,
    protocolloIva: number,
    noteInInvio: string
  ): Promise<number> {
    const invoice = await prisma.invoice.create({
      data: {
        stato: invoiceData.stato as StatoFattura,
        note: invoiceData.note,
        noteInInvio: noteInInvio,
        protocolloIva: protocolloIva,
        approvatore,
        
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
        
        condizioniPagamento: invoiceData.condizioniPagamento,
        dettagliPagamento: JSON.stringify(invoiceData.dettagliPagamento),
        
        terzoIntermediarioDenominazione: invoiceData.terzoIntermediario?.denominazione,
        terzoIntermediarioPartitaIva: invoiceData.terzoIntermediario?.partitaIva,
        terzoIntermediarioCodiceFiscale: invoiceData.terzoIntermediario?.codiceFiscale,
        
        soggettoEmittente: invoiceData.soggettoEmittente,
        
        linee: JSON.stringify(invoiceData.linee),
      },
    });
    
    return invoice.codiceUnico;
  }

  // Aggiorna stato fattura
  async updateInvoiceStatus(codiceUnico: number, stato: StatoFattura, note?: string): Promise<void> {
    await prisma.invoice.update({
      where: { codiceUnico },
      data: { 
        stato,
        ...(note !== undefined && { note })
      },
    });
  }

  // Ottieni fattura tramite ID
  async getInvoiceById(codiceUnico: number): Promise<Invoice | null> {
    const invoice = await prisma.invoice.findUnique({
      where: { codiceUnico },
    });
    
    if (!invoice) return null;
    
    return this.mapToInvoice(invoice);
  }

  // Ottieni tutte le fatture
  async getAllInvoices(): Promise<Invoice[]> {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    return invoices.map(inv => this.mapToInvoice(inv));
  }

  // Ottieni tutte le fatture 'in attesa'
  async getStandByInvoices(approvatore: string): Promise<Invoice[]> {
    const invoices = await prisma.invoice.findMany({
      where: { 
        stato: 'in_attesa',
        approvatore
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return invoices.map(inv => this.mapToInvoice(inv));
  }

  // Paginazione tabella storico
  async getProcessedInvoices(
    page: number = 1,
    pageSize: number = 15,
    filters?: ProcessedInvoicesFilters
  ): Promise<PaginatedResult<Invoice>> {
    // Costruisci la where clause
    const where: any = {
      stato: { in: ['approvato', 'rifiutato'] }
    };

    // Applica filtri se presenti
    if (filters) {
      if (filters.dataDa) {
        // data è String in Prisma, non DateTime
        where.data = { ...where.data, gte: filters.dataDa };
      }
      if (filters.dataA) {
        // data è String in Prisma, non DateTime
        where.data = { ...where.data, lte: filters.dataA };
      }
      if (filters.numeroFattura) {
        // Case-insensitive search
        where.numero = { contains: filters.numeroFattura, mode: 'insensitive' };
      }
      if (filters.fornitore) {
        // Case-insensitive search
        where.cedenteNome = { contains: filters.fornitore, mode: 'insensitive' };
      }
      if (filters.stato && filters.stato !== 'tutti') {
        where.stato = filters.stato;
      }
    }

    // Esegui query con paginazione
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where })
    ]);

    return {
      data: invoices.map(inv => this.mapToInvoice(inv)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private safeJsonParse(jsonString: string, fallback: any = []): any {
    try {
      if (!jsonString) return fallback;
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn(`[InvoiceDbService] Errore parsing JSON: "${jsonString}". Uso fallback.`, error);
      return fallback;
    }
  }

  private mapToInvoice(dbInvoice: any): Invoice {
    return {
      id: dbInvoice.codiceUnico.toString(),
      stato: dbInvoice.stato,
      note: dbInvoice.note,
      noteInInvio: dbInvoice.noteInInvio,
      protocolloIva: dbInvoice.protocolloIva,
      approvatore: dbInvoice.approvatore,
      numero: dbInvoice.numero,
      data: dbInvoice.data,
      tipoDocumento: dbInvoice.tipoDocumento,
      divisa: dbInvoice.divisa,
      art73: dbInvoice.art73,
      causale: dbInvoice.causale,
      codiceDestinatario: dbInvoice.codiceDestinatario,
      pecDestinatario: dbInvoice.pecDestinatario,
      updatedAt: dbInvoice.updatedAt,

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

      linee: this.safeJsonParse(dbInvoice.linee),

      totale: dbInvoice.totale,
      imponibile: dbInvoice.imponibile,
      imposta: dbInvoice.imposta,
      aliquota: dbInvoice.aliquota,
      esigibilitaIVA: dbInvoice.esigibilitaIVA,

      condizioniPagamento: dbInvoice.condizioniPagamento,
      dettagliPagamento: this.safeJsonParse(dbInvoice.dettagliPagamento),

      terzoIntermediario: dbInvoice.terzoIntermediarioDenominazione ? {
        denominazione: dbInvoice.terzoIntermediarioDenominazione,
        partitaIva: dbInvoice.terzoIntermediarioPartitaIva,
        codiceFiscale: dbInvoice.terzoIntermediarioCodiceFiscale,
      } : undefined,

      soggettoEmittente: dbInvoice.soggettoEmittente,
    };
  }
}