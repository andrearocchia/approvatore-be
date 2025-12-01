# Approvatore Backend

Backend per la gestione del sistema di approvazione documentale con elaborazione automatica di fatture elettroniche XML, costruito con **NestJS**, **Prisma** e **PostgreSQL**.

## Tecnologie Principali

- **NestJS** - Framework Node.js modulare e scalabile
- **Prisma** - ORM per la gestione del database
- **PostgreSQL** - Database relazionale
- **JWT** - Autenticazione token-based
- **Passport.js** - Strategia di autenticazione
- **bcryptjs** - Hash sicuro delle password
- **PDFKit** - Generazione PDF
- **xml2js** - Parsing fatture elettroniche XML
- **Chokidar** - File system watcher per elaborazione automatica
- **Docker** - Containerizzazione dell'ambiente

## Prerequisiti

- Node.js >= 16
- npm
- PostgreSQL 12+
- Docker (opzionale)

## Installazione

1. **Clonare il repository**
   ```bash
   git clone <https://github.com/andrearocchia/approvatore-be>
   cd approvatore-backend
   ```

2. **Installare le dipendenze**
   ```bash
   npm install
   ```

3. **Configurare le variabili di ambiente**
   Creare un file `.env` nella radice del progetto:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/approvatore
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRES_IN=3600
   XML_OUTPUT_DIR=C:/path/to/xml/input
   PDF_OUTPUT_DIR=C:/path/to/pdf/output
   ```

4. **Eseguire le migrazioni del database**
   ```bash
   npx prisma migrate dev
   ```

5. **Avviare il server**
   ```bash
   npm run start:dev
   ```

Il server sarà disponibile su `http://localhost:3000`

## Avviamento con Docker

```bash
docker compose up -d
```

## Struttura del Progetto

```
src/
├── auth/                      # Modulo autenticazione
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── auth.module.ts
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
│   ├── invoice-pdf.service.ts       # Parsing XML e conversione
│   ├── invoice-db.service.ts        # Persistenza database
│   ├── invoice-watcher.service.ts   # Monitoring directory XML
│   └── pdf-generator.service.ts     # Generazione PDF
├── prisma/                    # Configurazione database
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── app.module.ts
└── main.ts
```

## Sistema di Gestione Fatture Elettroniche

### Funzionalità Principali

Il sistema elabora automaticamente le fatture elettroniche in formato XML (FatturaPA) seguendo questo workflow:

1. **Monitoring automatico** - Il servizio `InvoiceWatcherService` monitora la directory configurata (`XML_OUTPUT_DIR`)
2. **Parsing XML** - Estrazione dati dalla fattura elettronica secondo lo standard FatturaPA
3. **Salvataggio Database** - Memorizzazione strutturata dei dati fattura con codice univoco progressivo
4. **Generazione PDF** - Creazione automatica di un PDF formattato per visualizzazione
5. **Cleanup** - Rimozione automatica del file XML dopo elaborazione

### Architettura dei Servizi

#### InvoiceWatcherService
Servizio di background che monitora la directory XML per nuovi file:
- Utilizza **Chokidar** per rilevare nuovi file in real-time
- Attende la stabilizzazione del file prima di elaborarlo (2 secondi)
- Avvia automaticamente il workflow di elaborazione

#### InvoicePdfService
Servizio principale per la gestione delle fatture:
- `extractInvoiceData(parsedXML)` - Estrae i dati strutturati dal XML parsato
- `convertXMLToPDF(xmlContent)` - Converte direttamente XML in PDF
- `parseAndSaveXmlFiles()` - Elabora batch di file XML da directory
- `generatePdf(invoiceData, codiceUnico)` - Genera PDF da dati strutturati

#### InvoiceDbService
Gestione della persistenza:
- `saveInvoice(invoiceData)` - Salva fattura e restituisce codice univoco
- `updateInvoiceStatus(codiceUnico, stato, note)` - Aggiorna stato approvazione
- `getInvoiceById(codiceUnico)` - Recupera singola fattura
- `getAllInvoices()` - Recupera tutte le fatture
- `getStandByInvoices()` - Recupera fatture in attesa di approvazione

#### PdfGeneratorService
Generazione professionale di PDF:
- Layout strutturato con intestazione, parti (cedente/cessionario), tabella articoli
- Formattazione automatica di numeri, valute e totali
- Supporto informazioni fiscali complete (IVA, REA, regime fiscale)

## API Endpoints

### Autenticazione

**POST** `/auth/login`
```json
{
  "username": "approvatore1",
  "password": "test123"
}
```
Risposta:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "sub": "uuid",
    "username": "approvatore1",
    "role": "approvatore"
  }
}
```

**POST** `/auth/register`
```json
{
  "username": "newuser@example.com",
  "password": "password123",
  "role": "segretario"
}
```

### Utenti

**GET** `/users` (Protetto)
Restituisce la lista di tutti gli utenti

**GET** `/users/:id` (Protetto)
Restituisce i dati di uno specifico utente

### Fatture

**POST** `/invoices/xml-to-pdf`
Converte XML fattura in PDF
```json
{
  "xmlContent": "<p:FatturaElettronica>...</p:FatturaElettronica>"
}
```
Risposta:
```json
{
  "success": true,
  "pdf": "base64_encoded_pdf_content"
}
```

**POST** `/invoices/parse-xml-files`
Elabora tutti i file XML nella directory configurata
```json
{
  "success": true,
  "message": "File XML parsati e salvati in DB"
}
```

**GET** `/invoices/all`
Recupera tutte le fatture
```json
{
  "success": true,
  "invoices": [...]
}
```

**GET** `/invoices/standby`
Recupera fatture in attesa di approvazione
```json
{
  "success": true,
  "invoices": [...]
}
```

**GET** `/invoices/:codiceUnico`
Recupera i dettagli di una fattura specifica
```json
{
  "success": true,
  "invoice": {
    "id": "1",
    "numero": "001",
    "data": "2024-01-15",
    "cedente": {...},
    "cessionario": {...},
    "linee": [...],
    "totale": "1220.00"
  }
}
```

**GET** `/invoices/:codiceUnico/pdf`
Recupera il PDF di una fattura
```json
{
  "success": true,
  "pdf": "base64_encoded_pdf",
  "filename": "fattura-1-1234567890.pdf"
}
```

**PATCH** `/invoices/:codiceUnico/status`
Aggiorna lo stato di approvazione
```json
{
  "stato": "approvato",
  "note": "Fattura verificata e approvata"
}
```
Stati validi: `in_attesa`, `approvato`, `rifiutato`

**POST** `/invoices/generate-pdf`
Genera PDF da dati strutturati
```json
{
  "invoiceData": {...},
  "codiceUnico": 123
}
```

## Database Schema

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

### Invoice Model
```prisma
model Invoice {
  id                    Int          @id @default(autoincrement())
  codiceUnico           Int          @unique @default(autoincrement())
  stato                 StatoFattura @default(in_attesa)
  note                  String       @default("")
  
  // Dati generali
  numero                String
  data                  String
  tipoDocumento         String
  divisa                String?
  art73                 String
  causale               String?
  codiceDestinatario    String
  pecDestinatario       String?
  
  // Cedente/Prestatore (completo)
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
  
  // Cessionario/Committente (completo)
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
  
  // Linee (JSON)
  linee                 String  // Array JSON stringificato
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

enum StatoFattura {
  in_attesa
  approvato
  rifiutato
}
```

## Formato Fattura Elettronica

Il sistema supporta il formato **FatturaPA** (FatturaElettronica) con i seguenti elementi:

### Struttura XML Supportata
- `FatturaElettronicaHeader` - Dati trasmissione, cedente, cessionario
- `FatturaElettronicaBody` - Dati generali, linee dettaglio, totali, pagamento

### Dati Estratti
- Informazioni anagrafiche complete (cedente/cessionario)
- Dettagli fiscali (P.IVA, Codice Fiscale, Regime Fiscale, REA)
- Linee di dettaglio con codici articolo, quantità, prezzi, sconti, IVA
- Totali (imponibile, imposta, totale documento)
- Condizioni di pagamento

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

### Decorator Ruoli
```typescript
@Roles('admin', 'approvatore')
@Get('/protected')
protectedRoute() { ... }
```

## Sicurezza

- **Password Hashing** - bcryptjs con salt rounds = 10
- **JWT Secret** - Configurabile via variabili di ambiente
- **CORS** - Abilitato solo per `localhost:5173` in sviluppo
- **Role-Based Access Control** - Accesso differenziato per ruoli
- **Password Non Exposed** - Le password non vengono mai restituite nelle API
- **XML Sanitization** - Pulizia automatica caratteri non validi e escape entities

## Test

```bash
# Eseguire i test
npm run test

# Test in watch mode
npm run test:watch

# Coverage
npm run test:cov
```

## Comandi Utili

| Comando | Descrizione |
|---------|-------------|
| `npm run start:dev` | Avvia il server in modalità sviluppo |
| `npm run build` | Compila il progetto TypeScript |
| `npm run start:prod` | Avvia il server in produzione |
| `npx prisma studio` | Interfaccia web per gestire il database |
| `npx prisma migrate dev` | Esegui migrazioni in sviluppo |
| `npx prisma migrate deploy` | Applica migrazioni in produzione |
| `docker compose up -d` | Avvia i container Docker |
| `docker compose down` | Ferma i container Docker |

## Migrazioni Database

Le migrazioni sono gestite automaticamente da Prisma.

Creare una nuova migrazione:
```bash
npx prisma migrate dev --name nome_migrazione
```

Visualizzare lo schema:
```bash
npx prisma studio
```

## CORS Configuration

Attualmente configurato per permettere richieste da:
- `http://localhost:5173` (frontend locale)

Modificare in `main.ts` per aggiungere altri domini.

## Variabili di Ambiente

| Variabile | Descrizione | Default |
|-----------|-------------|---------|
| `DATABASE_URL` | Stringa di connessione PostgreSQL | - |
| `JWT_SECRET` | Secret key per firmare i token | `default_jwt_secret` |
| `JWT_EXPIRES_IN` | Scadenza token in secondi | 3600 |
| `XML_OUTPUT_DIR` | Directory di input per file XML | - |
| `PDF_OUTPUT_DIR` | Directory di output per PDF generati | - |

## Workflow Elaborazione Fatture

```
1. File XML depositato in XML_OUTPUT_DIR
   ↓
2. InvoiceWatcherService rileva nuovo file
   ↓
3. Parsing XML → Estrazione dati strutturati
   ↓
4. Salvataggio in database (stato: in_attesa)
   ↓
5. Generazione PDF automatica
   ↓
6. Rimozione file XML originale
   ↓
7. Approvatore visualizza e valuta
   ↓
8. Aggiornamento stato (approvato/rifiutato)
```

## Roadmap

- [x] Parsing fatture elettroniche XML
- [x] Generazione PDF automatica
- [x] File system watcher per elaborazione automatica
- [x] Workflow approvazione base
- [ ] Notifiche email per nuove fatture
- [ ] Export fatture in formato CSV/Excel
- [ ] Dashboard analytics e reportistica
- [ ] Integrazione firma digitale
- [ ] Rate limiting
- [ ] Logging avanzato
- [ ] API documentazione (Swagger/OpenAPI)

## Troubleshooting

**Errore: "Cannot find module '@prisma/client'"**
```bash
npm install
npx prisma generate
```

**Errore: "Connection refused" su database**
Verificare che PostgreSQL sia in esecuzione e che `DATABASE_URL` sia corretto

**Errore: "XML_OUTPUT_DIR non definita"**
Configurare la variabile di ambiente nel file `.env`

**Errore: "PDF non generato"**
Verificare i permessi di scrittura sulla directory `PDF_OUTPUT_DIR`

**Token scaduto**
Eseguire un nuovo login per ottenere un nuovo token

**File XML non elaborato**
Verificare che il file sia valido e che la directory sia monitorata correttamente