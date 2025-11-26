# Approvatore Backend

Backend per la gestione del sistema di approvazione documentale, costruito con **NestJS**, **Prisma** e **PostgreSQL**.

## Tecnologie Principali

- **NestJS** - Framework Node.js modulare e scalabile
- **Prisma** - ORM per la gestione del database
- **PostgreSQL** - Database relazionale
- **JWT** - Autenticazione token-based
- **Passport.js** - Strategia di autenticazione
- **bcryptjs** - Hash sicuro delle password
- **Docker** - Containerizzazione dell'ambiente

## Prerequisiti

- Node.js >= 16
- npm o yarn
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
├── auth/                 # Modulo autenticazione
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   ├── jwt.strategy.ts
│   ├── jwt-auth.guard.ts
│   ├── roles.guard.ts
│   └── roles.decorator.ts
├── users/                # Modulo gestione utenti
│   ├── users.service.ts
│   ├── users.controller.ts
│   └── users.module.ts
├── prisma/               # Configurazione database
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

### Decorator Ruoli
```typescript
@Roles('admin', 'approver')
@Get('/protected')
protectedRoute() { ... }
```

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
    "role": "approver"
  }
}
```

**POST** `/auth/register`
```json
{
  "username": "newuser@example.com",
  "password": "password123",
  "role": "viewer"
}
```

### Utenti

**GET** `/users` (Protetto)
Restituisce la lista di tutti gli utenti

**GET** `/users/:id` (Protetto)
Restituisce i dati di uno specifico utente

## Database Schema

### User Model
```prisma
model User {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  role         Role
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

enum Role {
  admin
  approver
  viewer
}
```

## Sicurezza

- **Password Hashing** - bcryptjs con salt rounds = 10
- **JWT Secret** - Configurabile via variabili di ambiente
- **CORS** - Abilitato solo per `localhost:5173` in sviluppo
- **Role-Based Access Control** - Accesso differenziato per ruoli
- **Password Non Exposted** - Le password non vengono mai restituite nelle API

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

## Roadmap

- [ ] Integrazione fatture ARCA
- [ ] Servizio history log
- [ ] Workflow approvazione multi-livello
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

**Token scaduto**
Eseguire un nuovo login per ottenere un nuovo token