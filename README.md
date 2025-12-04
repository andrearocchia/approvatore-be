# Approvatore Backend

Backend per la gestione del sistema di approvazione documentale con elaborazione di fatture elettroniche XML, costruito con **NestJS**, **Prisma** e **PostgreSQL**.

## Tecnologie Principali

- **NestJS** - Framework Node.js modulare e scalabile
- **Prisma** - ORM per la gestione del database
- **PostgreSQL** - Database relazionale
- **JWT** - Autenticazione token-based
- **Passport.js** - Strategia di autenticazione
- **bcryptjs** - Hash sicuro delle password
- **PDFKit** - Generazione PDF
- **xml2js** - Parsing fatture elettroniche XML
- **Docker** - Containerizzazione dell'ambiente

## Prerequisiti

- Node.js >= 16
- npm
- PostgreSQL 12+
- Docker (opzionale)

## Installazione

1. **Clonare il repository**
   ```bash
   git clone https://github.com/andrearocchia/approvatore-be
   cd approvatore-backend
   ```

2. **Installare le dipendenze**
   ```bash
   npm install
   ```

3. **Configurare le variabili di ambiente**
   
   Creare un file `.env` nella radice del progetto:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/invoicesdb?schema=public"
   JWT_SECRET="your-secret-key"
   JWT_EXPIRES_IN="3600"
   PDF_OUTPUT_DIR="/path/to/pdf/output"
   ```

4. **Avviare il container PostgreSQL** (se si usa Docker)
   ```bash
   docker-compose up -d
   ```

5. **Eseguire le migrazioni del database**
   ```bash
   npx prisma migrate dev --name init
   ```

6. **Avviare l'applicazione in modalità sviluppo**
   ```bash
   npm run start:dev
   ```

L'applicazione sarà disponibile su `http://localhost:80` o `http://localhost`

## Struttura del Progetto

```
src/
├── auth/                      # Modulo autenticazione
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── jwt.strategy.ts
│   ├── jwt-auth.guard.ts
│   ├── roles.guard.ts
│   └── roles.decorator.ts
├── users/                     # Modulo gestione utenti
│   ├── users.service.ts
│   ├── users.controller.ts
│   └── users.module.ts
├── invoices/                  # Modulo fatture elettroniche
│   ├── invoices.controller.ts
│   ├── invoices.module.ts
│   ├── invoice-pdf.service.ts
│   ├── invoice-db.service.ts
│   └── pdf-generator.service.ts
├── prisma/                    # Configurazione database
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── app.module.ts
└── main.ts
```

## Autenticazione e Autorizzazione

### JWT Strategy

L'autenticazione avviene tramite JWT (JSON Web Tokens) estratti dall'header `Authorization: Bearer <token>`.

**Flusso di login:**
1. Client invia credenziali (username, password)
2. Backend valida le credenziali con bcrypt
3. Se valide, genera un JWT con payload: `{ sub, username, role }`
4. Token inviato al client con scadenza configurabile (default: 3600s)

### Guards

- **JwtAuthGuard** - Protegge le rotte richiedendo un token valido
- **RolesGuard** - Controlla che il ruolo dell'utente sia autorizzato per la risorsa

### Ruoli Disponibili

```typescript
enum Role {
  approvatore  // Può approvare/rifiutare fatture
  segretario   // Può caricare e visualizzare fatture
  admin        // Accesso completo al sistema
}
```

### Decorator Ruoli

```typescript
@Roles('admin', 'approvatore')
@Get('/protected')
protectedRoute() { ... }
```

## Sistema di Gestione Fatture Elettroniche

### Workflow Elaborazione

Il sistema gestisce l'elaborazione delle fatture elettroniche in formato XML (FatturaPA):

1. **Caricamento XML** - Upload del file XML tramite endpoint dedicato
2. **Parsing XML** - Estrazione dati strutturati secondo standard FatturaPA
3. **Salvataggio Database** - Memorizzazione con codice univoco progressivo (stato: `in_attesa`)
4. **Generazione PDF** - Creazione automatica PDF formattato
5. **Approvazione** - Workflow di revisione con cambio stato (`approvato`/`rifiutato`)

### Architettura dei Servizi

| Servizio | Responsabilità | Tecnologie |
|----------|----------------|------------|
| **InvoicePdfService** | Parsing XML, estrazione dati, conversione XML-to-PDF | xml2js, fs |
| **InvoiceDbService** | Persistenza database (CRUD, gestione stati) | Prisma |
| **PdfGeneratorService** | Generazione layout PDF professionale | PDFKit |

## API Endpoints

### Autenticazione

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/auth/login` | Login utente, restituisce JWT token |

### Fatture

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/invoices/xmlApprove` | Upload e elaborazione file XML |
| GET | `/invoices/all` | Recupera tutte le fatture |
| GET | `/invoices/standby` | Recupera fatture in attesa di approvazione |
| GET | `/invoices/:codiceUnico` | Recupera stato e note di una fattura |
| GET | `/invoices/:codiceUnico/pdf` | Recupera PDF in formato base64 |
| PATCH | `/invoices/:codiceUnico/status` | Aggiorna stato fattura |

### Dettaglio Endpoint Principali

#### POST `/invoices/xmlApprove`

Upload e elaborazione fattura elettronica.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (file XML)

**Response:**
```json
{
  "success": true,
  "codiceUnico": 123,
  "message": "Fattura elaborata con successo"
}
```

#### GET `/invoices/:codiceUnico`

Recupera stato e note di una fattura specifica.

**Response:**
```json
{
  "success": true,
  "stato": "approvato",
  "note": "Fattura verificata e approvata"
}
```

Stati possibili: `in_attesa`, `approvato`, `rifiutato`

#### PATCH `/invoices/:codiceUnico/status`

Aggiorna lo stato di approvazione.

**Request Body:**
```json
{
  "stato": "approvato",
  "note": "Fattura verificata e approvata"
}
```

#### GET `/invoices/:codiceUnico/pdf`

Recupera il PDF generato della fattura.

**Response:**
```json
{
  "success": true,
  "pdf": "base64-encoded-pdf-content",
  "filename": "fattura-123-1234567890.pdf"
}
```

## Database Schema

### Invoice Model

```prisma
model Invoice {
  id                    Int          @id @default(autoincrement())
  codiceUnico           Int          @unique @default(autoincrement())
  stato                 StatoFattura @default(in_attesa)
  note                  String       @default("")
  
  // Dati generali fattura
  numero                String
  data                  String
  tipoDocumento         String
  divisa                String?
  art73                 String
  causale               String?
  codiceDestinatario    String
  pecDestinatario       String?
  
  // Dati cedente (fornitore)
  cedenteNome           String
  cedentePartitaIva     String
  cedenteCodiceFiscale  String?
  cedenteRegimeFiscale  String?
  cedenteIndirizzo      String
  cedenteNumeroCivico   String?
  cedenteCap            String
  cedenteComune         String
  cedenteProvincia      String
  cedenteNazione        String?
  cedenteEmail          String?
  cedenteTelefono       String?
  cedenteREAUfficio     String?
  cedenteREANumero      String?
  cedenteREACapitale    String?
  cedenteREASocioUnico  String?
  cedenteREALiquidazione String?
  
  // Dati cessionario (cliente)
  cessionarioNome           String
  cessionarioPartitaIva     String
  cessionarioCodiceFiscale  String?
  cessionarioIndirizzo      String
  cessionarioNumeroCivico   String?
  cessionarioCap            String
  cessionarioComune         String
  cessionarioProvincia      String
  cessionarioNazione        String?
  
  // Totali
  totale                String
  imponibile            String
  imposta               String
  aliquota              String
  esigibilitaIVA        String?
  
  // Pagamento
  modalitaPagamento     String?
  condizioniPagamento   String?
  dettagliPagamento     String?
  dataRiferimentoTerminiPagamento String?
  giorniTerminiPagamento String?
  scadenzaPagamento     String?
  importoPagamento      String?
  
  // Terzo intermediario
  terzoIntermediarioDenominazione String?
  terzoIntermediarioPartitaIva    String?
  terzoIntermediarioCodiceFiscale String?
  
  soggettoEmittente     String?
  
  // Linee fattura (JSON)
  linee                 String
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

enum StatoFattura {
  in_attesa   # In attesa di revisione
  approvato   # Fattura approvata
  rifiutato   # Fattura rifiutata
}
```

### User Model

```prisma
model User {
  id           String   @id @default(uuid())
  username     String   @unique
  passwordHash String
  role         Role
  createdAt    DateTime @default(now())
}

enum Role {
  approvatore
  segretario
  admin
}
```

## Deployment

Il backend include configurazione per servire il frontend buildato dalla cartella `public`:

```typescript
// Serve file statici
app.useStaticAssets(publicPath, { prefix: '/' });

// SPA fallback per routing client-side
app.use((req, res, next) => {
  if (!req.url.startsWith('/auth') && 
      !req.url.startsWith('/users') && 
      !req.url.startsWith('/invoices') &&
      !req.url.includes('.')) {
    res.sendFile(join(publicPath, 'index.html'));
  } else {
    next();
  }
});
```

## Integrazione ARCA

Per l'integrazione con il sistema ARCA, consultare la documentazione dedicata: **[ARCA.md](./../ARCA.md)**

La documentazione ARCA include:
- Dettagli autenticazione JWT
- Endpoint `/invoices/xmlApprove` per caricamento fatture
- Endpoint `/invoices/:codiceUnico` per verifica stato
- Esempi pratici di integrazione in Python, Node.js
- Workflow completo e best practices