# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

Responder siempre en español salvo indicación contraria.

## Comandos

```bash
npm run dev          # Dev server con Turbopack
npm run build        # Build de producción
npm run lint         # ESLint
npm run db:generate  # Generar migraciones Drizzle desde cambios en schema
npm run db:migrate   # Aplicar migraciones a Neon DB
npm run db:studio    # Drizzle Studio (browser de BD)
npm run db:seed      # Crear usuario admin inicial en la BD
```

## Arquitectura

**Acua** — Next.js 15 App Router para tracking interno de pedidos de computadoras/notebooks. Reemplaza un Google Sheet manual.

### Flujo de datos
- **Webhook Qloud** → `POST /api/webhook/qloud` → llama API Qloud → upsert en BD
- **Pedidos manuales** → formulario `/orders/new` → server action `crearPedidoManual` → insert en BD
- **Cambios de estado** → botones en card/detalle → server actions `avanzarEstado`/`retrocederEstado` → DB update + `revalidatePath`

### Archivos clave
- `lib/db/schema.ts` — Schema Drizzle. Dos tipos de producto: `notebook` | `computadora`. Estado: `pendiente → preparacion → listo → despachado`
- `lib/qloud.ts` — `fetchQloudOrder(id)`, `clasificarProducto(nombre)` (por keywords: "notebook"/"laptop" → notebook; "all in one"/"mini pc"/"pc gamer"/etc → computadora; accesorios retornan null)
- `lib/actions.ts` — Todos los server actions (requieren sesión de auth)
- `lib/auth.ts` — NextAuth v5 con credentials provider, estrategia JWT
- `middleware.ts` — Protege todas las rutas excepto `/login` y `/api/*`

### Clasificación de productos
La API de Qloud no devuelve categorías. Se clasifican por keyword matching en el nombre. Accesorios ("funda", "base cooler") retornan `null` y se ignoran. Un pedido solo aparece en Acua si tiene al menos un producto clasificado.

### Tipos de pedido
- `web` — desde webhook Qloud (tiene `qloudId`)
- `factura_a`, `factura_b`, `cotizacion`, `orden_venta` — carga manual (sin `qloudId`)

### Auth
App de un solo rol (todo usuario es staff). Credenciales en tabla `users` con bcrypt. Primer usuario creado con `npm run db:seed`.

### Variables de entorno
Requeridas en `.env.local`:
- `DATABASE_URL` — Connection string de Neon PostgreSQL
- `AUTH_SECRET` — String random 32+ chars para NextAuth
- `QLOUD_USER=94`, `QLOUD_PASS=...`, `QLOUD_API_URL=https://rest.qloud.ar`
- `RESEND_API_KEY`, `RESEND_FROM` — Email via Resend (actualmente `onboarding@resend.dev`)
- `CONTABILIUM_CLIENT_ID`, `CONTABILIUM_CLIENT_SECRET` — API Contabilium (grant_type=client_credentials, base URL: `https://rest.contabilium.com`)

### Integración Contabilium
- `lib/contabilium.ts` — cliente con cache de token (86400s). Endpoints: `GET /api/comprobantes/search`, `GET /api/comprobantes/?id=`, `GET /api/ordenesVenta/search`, `GET /api/ordenesVenta/?id=`
- `app/contabilium/` — UI para buscar por rango de fechas y tipos (FCA/FCB/COT/OV) e importar como pedidos
- Solo accesible para rol `admin`
- TipoFc en la API: "FCA" = Factura A, "FCB" = Factura B, "COT" = Cotización, OV se busca por endpoint separado
