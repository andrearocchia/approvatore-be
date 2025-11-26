# Documentazione Tecnica - Approvatore Backend

## Indice
1. [Architettura](#architettura)
2. [Moduli](#moduli)
3. [Autenticazione JWT](#autenticazione-jwt)
4. [Sistema di Autorizzazione](#sistema-di-autorizzazione)
5. [Servizi](#servizi)
6. [Database](#database)
7. [Flussi di Dati](#flussi-di-dati)
8. [Configurazione](#configurazione)
9. [Best Practices](#best-practices)

---

## Architettura

L'applicazione segue l'architettura modulare di NestJS con il pattern dependency injection.

```
┌─────────────────────────────────────────────────────────┐
│                    NestJS Application                   │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┬──────────────────┬──────────────┐  │
│  │   Auth Module   │  Users Module    │ Prisma Module│  │
│  │                 │                  │              │  │
│  │ - AuthService   │ - UsersService   │- PrismaService
│  │ - JwtStrategy   │ - UsersController│              │  │
│  │ - Guards        │                  │              │  │
│  │ - Decorators    │                  │              │  │
│  └─────────────────┴──────────────────┴──────────────┘  │
├─────────────────────────────────────────────────────────┤
│           Layer: Controllers → Services → DB             │
├─────────────────────────────────────────────────────────┤
│                PostgreSQL Database                       │
└─────────────────────────────────────────────────────────┘
```

---

## Moduli

### 1. Auth Module (`src/auth/`)

Gestisce l'autenticazione e l'autorizzazione dell'applicazione.

**Componenti:**

#### AuthService
```typescript
// Valida credenziali utente
validateUser(username: string, password: string)
// Genera JWT dopo login
login(user: { id, username, role })
// Registra nuovo utente
register(username, password, role)
```

**Flusso:**
1. Username e password ricevuti dal client
2. `validateUser()` controlla se l'utente esiste
3. `bcrypt.compare()` valida la password
4. Se valida, `login()` genera il token JWT
5. Token restituito al client

#### JwtStrategy
```typescript
// Estrae il token dal header Authorization
jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
// Valida la firma del token
secretOrKey: config.get<string>('JWT_SECRET')
// Trasforma il payload nel user object
validate(payload: any) => user
```

**Payload del Token:**
```json
{
  "sub": "user-uuid",           // Subject (user id)
  "username": "user@example",
  "role": "approver",
  "iat": 1234567890,            // Issued at
  "exp": 1234571490             // Expiration
}
```

#### JwtAuthGuard
Protegge le rotte richiedendo un JWT valido.

```typescript
@UseGuards(JwtAuthGuard)
@Get('/protected')
protectedRoute(@Request() req) {
  // req.user contiene il payload decodificato
}
```

#### RolesGuard
Controlla che l'utente abbia il ruolo richiesto.

```typescript
canActivate(context: ExecutionContext): boolean {
  // 1. Legge i ruoli richiesti dal decoratore @Roles()
  const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [...])
  // 2. Se non sono specificati, permette l'accesso
  if (!required || required.length === 0) return true
  // 3. Confronta il ruolo dell'utente con quelli richiesti
  return user && required.includes(user.role)
}
```

#### Roles Decorator
Metadata decorator per specificare i ruoli autorizzati su una rotta.

```typescript
@Roles('admin', 'approver')
@Get('/sensitive-data')
sensitiveRoute() { ... }
```

---

### 2. Users Module (`src/users/`)

Gestisce le operazioni sugli utenti.

#### UsersService
```typescript
// Crea un nuovo utente
createUser(username, password, role)

// Trova utente per username
findByUsername(username)

// Valida credenziali
validateUser(username, password)

// Restituisce tutti gli utenti
getAllUsers()
```

**Operazioni di Hashing:**
- Al momento della creazione, la password viene hashata con bcryptjs (10 salt rounds)
- La `passwordHash` non viene mai esposta nelle risposte API
- Al momento della validazione, la password inserita viene confrontata con l'hash salvato

#### UsersController
Espone gli endpoint per la gestione degli utenti.

```typescript
GET  /users          → getAllUsers()
GET  /users/:id      → getUser(id)
POST /users          → createUser()
```

---

### 3. Prisma Module (`src/prisma/`)

Fornisce l'accesso al database in tutta l'applicazione.

#### PrismaService
```typescript
// Estende PrismaClient
class PrismaService extends PrismaClient {
  // Si connette al DB quando il modulo viene inizializzato
  async onModuleInit() {
    await this.$connect()
  }
}
```

#### PrismaModule
Modulo globale che rende `PrismaService` disponibile a tutti gli altri moduli senza doverlo importare esplicitamente.

```typescript
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
```

---

## Autenticazione JWT

### Flusso di Login Completo

```
CLIENT                          SERVER
  │                               │
  ├─── POST /auth/login ────────→ │
  │    { username, password }     │
  │                            validateUser()
  │                            ├─ findUnique in DB
  │                            ├─ bcrypt.compare()
  │                            └─ return user or null
  │                               │
  │                            login()
  │                            ├─ Create JWT payload
  │                            ├─ jwtService.sign()
  │                            └─ return token
  │                               │
  │ ←──────── 200 OK ────────────┤
  │  { access_token, user }      │
  │                               │
  │ [Salva token in localStorage] │
  │                               │
  ├─ GET /users ─────────────────→ │
  │  Authorization: Bearer <token>│
  │                            JwtStrategy
  │                            ├─ Extract token
  │                            ├─ Verify signature
  │                            ├─ Decode payload
  │                            └─ return user obj
  │                               │
  │                            RolesGuard
  │                            ├─ Check required roles
  │                            ├─ Compare user.role
  │                            └─ allow or reject
  │                               │
  │ ←────── 200 Users Array ─────┤
  │                               │
```

### Token Scadenza

- Default: 3600 secondi (1 ora)
- Configurabile via `JWT_EXPIRES_IN` in .env
- Token scaduto: ritorna errore 401 Unauthorized
- Client deve eseguire un nuovo login

---

## Sistema di Autorizzazione

### Ruoli Disponibili

```prisma
enum Role {
  admin      // Accesso totale
  approver   // Può approvare documenti
  viewer     // Solo lettura
}
```

### Controllo dei Ruoli

**Implementazione del RolesGuard:**

1. Il decoratore `@Roles()` salva i ruoli richiesti come metadata
2. Al momento della richiesta, `RolesGuard` estrae questo metadata
3. Confronta il ruolo dell'utente del JWT con quelli autorizzati
4. Permette l'accesso solo se corrisponde

**Esempio di Protezione per Ruolo:**

```typescript
@Roles('admin')
@Delete('/users/:id')
deleteUser(@Param('id') id: string) { ... }

@Roles('admin', 'approver')
@Post('/approvals')
approveDocument(@Body() data: ApprovalDto) { ... }

@Get('/dashboard')  // Nessun ruolo specificato → accessibile a tutti
getDashboard() { ... }
```

---

## Servizi

### AuthService

**Responsabilità:**
- Validazione credenziali
- Generazione token JWT
- Registrazione nuovi utenti

**Dipendenze:**
- `PrismaService` - Per accedere al database
- `JwtService` - Per firmare i token

**Metodi Chiave:**

```typescript
async validateUser(username, password) {
  // 1. Cerca l'utente nel database
  // 2. Verifica che esista
  // 3. Confronta password con hash
  // 4. Ritorna l'utente senza password
}

async login(user) {
  // 1. Crea il payload con id, username, role
  // 2. Firma il token con il JWT_SECRET
  // 3. Ritorna token e dati utente
}

async register(username, password, role) {
  // 1. Crea hash della password
  // 2. Salva utente nel DB
  // 3. Ritorna utente senza hash
}
```

### UsersService

**Responsabilità:**
- CRUD utenti
- Validazione credenziali
- Recupero dati utenti

**Dipendenze:**
- `PrismaService` - Per accedere al database

---

## Database

### Schema Prisma

```prisma
model User {
  id           String   @id @default(cuid())      // ID univoco
  username     String   @unique                   // Username unico
  passwordHash String                             // Hash BCrypt
  role         Role                               // admin, approver, viewer
  createdAt    DateTime @default(now())          // Data creazione
  updatedAt    DateTime @updatedAt               // Data ultimo aggiornamento
}

enum Role {
  admin
  approver
  viewer
}
```

### Operazioni Comuni

**Creare un utente:**
```typescript
await prisma.user.create({
  data: {
    username: "user@example.com",
    passwordHash: "hashed_password",
    role: "approver"
  }
});
```

**Trovare utente per username:**
```typescript
await prisma.user.findUnique({
  where: { username: "user@example.com" }
});
```

**Aggiornare utente:**
```typescript
await prisma.user.update({
  where: { id: "uuid" },
  data: { role: "admin" }
});
```

**Eliminare utente:**
```typescript
await prisma.user.delete({
  where: { id: "uuid" }
});
```

---

## Flussi di Dati

### Flusso di Registrazione

```typescript
// Client
POST /auth/register
{
  "username": "newuser@example.com",
  "password": "password123",
  "role": "viewer"
}

// Backend
AuthService.register()
├─ bcrypt.hash(password, 10)
├─ prisma.user.create()
└─ return user (senza passwordHash)

// Response
{
  "id": "uuid",
  "username": "newuser@example.com",
  "role": "viewer",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Flusso di Accesso Risorsa Protetta

```
1. Client invia: GET /users
   Header: Authorization: Bearer eyJhbGciOi...

2. NestJS intercetta la richiesta
   ├─ JwtAuthGuard attivo
   ├─ JwtStrategy estrae token
   ├─ Verifica firma
   └─ Popola req.user

3. RolesGuard controlla
   ├─ Legge @Roles() dal controller
   ├─ Se nessun ruolo specifico → accesso permesso
   └─ Se ruoli specifici → confronta con user.role

4. Se tutto OK → Controller handler eseguito

5. Response: Lista utenti
```

---

## Configurazione

### File .env

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/approvatore

# JWT
JWT_SECRET=your_secure_random_secret_key_here_min_32_chars
JWT_EXPIRES_IN=3600

# Server
NODE_ENV=development
PORT=3000
```

### main.ts - Bootstrap

```typescript
// Abilita CORS solo per il frontend locale
app.enableCors({
  origin: "http://localhost:5173",
  credentials: true,
});

// Registra globalmente il RolesGuard
const rolesGuard = app.get(RolesGuard);
app.useGlobalGuards(rolesGuard);

// Avvia il server sulla porta 3000
await app.listen(3000);
```

### app.module.ts - Root Module

Importa i moduli principali:
- `AuthModule`
- `UsersModule`
- `PrismaModule`

---

## Best Practices

### 1. Sicurezza

✅ **Hash Password con bcryptjs**
- Salt rounds: 10 (default nel progetto)
- Mai salvare password in chiaro
- Mai ritornare passwordHash nelle API

✅ **JWT Secret**
- Generare un secret casuale di almeno 32 caratteri
- Salvare solo in variabili di ambiente
- Ruotare periodicamente

✅ **CORS**
- Specificare domini espliciti, non usare "*"
- In produzione, usare dominio ufficiale

### 2. Autenticazione

✅ **Gestire Token Scadenza**
```typescript
// Il client deve gestire 401 responses
if (response.status === 401) {
  // Reindirizzare a login
  // Cancellare token da localStorage
}
```

✅ **Validare Sempre**
- Usare `JwtAuthGuard` su rotte sensibili
- Controllare ruoli con `@Roles()` decorator
- Non fidare dei dati del client

### 3. Gestione Errori

❌ **Non fare:**
```typescript
// Espone la struttura del database
throw new Error(`User ${username} not found`);
```

✅ **Fare:**
```typescript
throw new UnauthorizedException('Invalid credentials');
```

### 4. Logging

Per la produzione, aggiungere logging strutturato:
```typescript
this.logger.log('User login successful', { username });
this.logger.warn('Failed login attempt', { username, reason });
this.logger.error('Database error', { error: e.message });
```

### 5. Testing

```typescript
// Unit test example
describe('AuthService', () => {
  it('should return user without passwordHash', async () => {
    const result = await service.validateUser('user', 'pass');
    expect(result).not.toHaveProperty('passwordHash');
  });
});
```

---

## Estensioni Future

### Integrazione Fatture ARCA
- Nuova entità `Invoice` in Prisma
- Service per gestire fatture
- Workflow di approvazione multi-livello

### Audit Log
- Tracciare tutte le azioni utente
- Timestamp e ruolo dell'executor
- Query filtrabili per data, utente, azione

### Notifiche
- Email quando un documento è in attesa di approvazione
- Webhook per integrazioni esterne

### Rate Limiting
- Proteggere i login da brute force
- Limitare rate di API per utente

---

## Troubleshooting

| Problema | Causa | Soluzione |
|----------|-------|----------|
| `Cannot find module @prisma/client` | Prisma non generato | `npx prisma generate` |
| Token non valido | Secret non configurato | Verificare `JWT_SECRET` in .env |
| Login fallito | Password errata o utente non esiste | Controllare credenziali nel DB |
| CORS error | Dominio non autorizzato | Aggiungere dominio in `main.ts` |
| DB connection error | PostgreSQL non raggiungibile | `docker compose up -d` |

---

**Documento aggiornato:** Gennaio 2024