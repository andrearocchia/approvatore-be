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
   git clone [https://github.com/andrearocchia/approvatore-be](https://github.com/andrearocchia/approvatore-be)
   cd approvatore-backend
    ````

2.  **Installare le dipendenze**

    ```bash
    npm install
    ```

3.  **Configurare le variabili di ambiente**
    Creare un file `.env` nella radice del progetto:

    ```
    DATABASE_URL=postgresql://user:password@localhost:5432/invoicesdb?schema=public

    JWT_SECRET=LaTuaChiaveSegretaPerIJWT
    JWT_EXPIRES_IN=3600

    CORS_URL=http://localhost:5173

    # Directory di input dove il sistema cerca i file XML quando triggerato manualmente
    XML_INPUT_DIR=/path/to/xml/invoices

    # Directory di output per i PDF generati
    PDF_OUTPUT_DIR=/path/to/pdf/output
    ```

4.  **Avviare il container PostgreSQL** (se si usa Docker)

    ```bash
    docker-compose up -d
    ```

5.  **Eseguire le migrazioni del database**

    ```bash
    npx prisma migrate dev --name init
    ```

6.  **Avviare l'applicazione in modalità sviluppo**

    ```bash
    npm run start:dev
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
│   └── pdf-generator.service.ts     # Generazione PDF
├── prisma/                    # Configurazione database
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── app.module.ts
└── main.ts
```

## Autenticazione e Autorizzazione

### JWT Strategy
L'autenticazione avviene tramite JWT (JSON Web Tokens) estratti dall'header `Authorization: Bearer <token>`.
### Funzionalità Principali

**Flusso di login:**
1. Client invia credenziali (username, password)
2. Backend valida le credenziali con bcrypt
3. Se valide, genera un JWT con payload: `{ sub, username, role }`
4. Token inviato al client con scadenza configurabile (default: 3600s)
Il sistema elabora automaticamente le fatture elettroniche in formato XML (FatturaPA) seguendo questo workflow:

### Guards
- **JwtAuthGuard** - Protegge le rotte richiedendo un token valido
- **RolesGuard** - Controlla che il ruolo dell'utente sia autorizzato per la risorsa
1. **Monitoring automatico** - Il servizio `InvoiceWatcherService` monitora la directory configurata (`XML_OUTPUT_DIR`)
2. **Parsing XML** - Estrazione dati dalla fattura elettronica secondo lo standard FatturaPA
3. **Salvataggio Database** - Memorizzazione strutturata dei dati fattura con codice univoco progressivo
4. **Generazione PDF** - Creazione automatica di un PDF formattato per visualizzazione
5. **Cleanup** - Rimozione automatica del file XML dopo elaborazione

### Decorator Ruoli
```typescript
@Roles('admin', 'approver')
@Get('/protected')
protectedRoute() { ... }
```

## Sistema di Gestione Fatture Elettroniche

### Funzionalità Principali

Il sistema gestisce l'elaborazione delle fatture elettroniche in formato XML (FatturaPA) tramite chiamate API dedicate o trigger manuali per file presenti su disco, seguendo questo workflow:

1.  **Inizializzazione Elaborazione** - L'elaborazione dei file XML viene avviata tramite l'endpoint a cui possibile inviare direttamente il contenuto XML tramite **`POST /invoices/xml-to-pdf`**.
2.  **Parsing XML** - Estrazione dei dati strutturati dalla fattura elettronica secondo lo standard FatturaPA.
3.  **Salvataggio Database** - Memorizzazione strutturata dei dati fattura con codice univoco progressivo (stato iniziale: **in\_attesa**).
4.  **Generazione PDF** - Creazione automatica di un PDF formattato per visualizzazione.
5.  **Cleanup** - Rimozione del file XML sorgente dopo l'avvenuta elaborazione (integrata nella logica di parsing batch).

### Architettura dei Servizi (Modulo `invoices/`)

| Servizio | Responsabilità Principale | Tecnologie Chiave |
| :--- | :--- | :--- |
| **InvoicePdfService** | Parsing dei file XML (FatturaPA), estrazione dei dati strutturati, conversione XML-to-PDF e logica di processing batch. | `xml2js`, `fs` |
| **InvoiceDbService** | Gestione completa della persistenza nel database (CRUD, aggiornamento stato, recupero filtri). | `Prisma` |
| **PdfGeneratorService** | Logica di formattazione e composizione del layout PDF professionale. | `PDFKit` |

### API Endpoints: Fatture

Tutti gli endpoint per la gestione delle fatture sono protetti da **JWT Strategy** e **RolesGuard** e richiedono un token valido.

| Metodo | Endpoint | Descrizione | Dettagli |
| :--- | :--- | :--- | :--- |
| **POST** | `/invoices/xml-to-pdf` | Converte un file XML (inviare come form-data) in un PDF in formato base64, salva la fattura nel DB e restituisce il codice univoco. | Upload/Processo immediato. |
| **POST** | `/invoices/parse-xml-files` | **Trigger manuale:** Avvia il parsing e salvataggio di tutti i file XML presenti in `XML_INPUT_DIR`. | Usato per elaborazioni batch. |
| **GET** | `/invoices/all` | Recupera l'elenco completo di tutte le fatture nel DB. | |
| **GET** | `/invoices/standby` | Recupera solo le fatture con stato **`in_attesa`** di approvazione. | |
| **GET** | `/invoices/:codiceUnico` | Ritorna lo 'stato' e le 'note' una singola fattura tramite il suo codice univoco. | |
| **GET** | `/invoices/:codiceUnico/pdf`| Recupera il PDF generato della fattura in formato base64. | |
| **PATCH**| `/invoices/:codiceUnico/status`| **Aggiorna lo stato di approvazione** della fattura. | Stati validi: `approvato`, `rifiutato`, `in_attesa`. |

## Database Schema

### Invoice Model (Sintesi)

Il modello `Invoice` memorizza tutti i dati estratti dalla Fattura Elettronica.

```prisma
model Invoice {
  id                    Int          @id @default(autoincrement())
  codiceUnico           Int          @unique @default(autoincrement()) // Codice univoco progressivo
  stato                 StatoFattura @default(in_attesa)              // Stato del workflow
  note                  String       @default("")                      // Note di approvazione/rifiuto
  
  // ... (Dati anagrafici, totali, etc.)
  
  linee                 String  // Array JSON stringificato dei dettagli linee
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

enum StatoFattura {
  in_attesa // In attesa di revisione da parte dell'approvatore
  approvato // Fattura verificata e accettata
  rifiutato // Fattura scartata
}
```

## Workflow Elaborazione Fatture

```
1. Chiamata API POST /invoices/parse-xml-files (Trigger Manuale)
  
2. Parsing XML → Estrazione dati strutturati
  
3. Salvataggio in database (stato: in_attesa)
  
4. Generazione PDF automatica
  
5. Rimozione file XML originale (integrata nel service di parsing)
  
6. Approvatore visualizza e valuta
  
7. Aggiornamento stato (approvato/rifiutato)
```