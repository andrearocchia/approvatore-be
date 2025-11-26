# Approvatore Backend — Documentazione Tecnica Completa

## Panoramica
Backend costruito con NestJS, Prisma e PostgreSQL, con autenticazione JWT e gestione ruoli.

## Architettura
- NestJS modulare
- Moduli: Auth, Users, Prisma
- Layer: Controller, Service, Guard, Strategy

## Struttura
src/
  auth/
  users/
  prisma/

## Database
Modello User, enum Role. Connessione via .env e Prisma.

## Autenticazione JWT
Login -> token, rotte protette da JwtAuthGuard + RolesGuard.

## API
POST /auth/login
GET /users (protetto)
GET /users/:id

## Comandi utili
npm run start:dev
npx prisma migrate dev
docker compose up -d

## Sicurezza
Hash password, JWT secret, ruoli.

## Roadmap Backend
- Integrazione fatture ARCA
- Servizio history
- Workflow approvazione