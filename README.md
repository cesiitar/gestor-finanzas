# Gestor de finanzas

App de finanzas personales que uso a diario: una PWA instalada en el móvil y un bot de Telegram que hace de puerta de entrada rápida. La hice porque las apps que probé me pedían demasiados pasos para apuntar un café, y al final dejaba de usarlas. La regla que gobierna todo el diseño es una: **registrar un movimiento tiene que costar menos de cinco segundos** — y si no quiero ni abrir la app, se lo escribo al bot como le escribiría a un amigo.

En producción corre en **Vercel** con **Supabase** de backend. Es un proyecto personal: la instancia desplegada es para mi uso, el registro está cerrado y no está pensado como producto abierto al público. Publico el código para que se pueda leer cómo está montado y por qué.

## Funcionalidades

### App (PWA mobile-first, modo oscuro)

- **Registro rápido** de gastos, ingresos e inversiones en tres toques, con UI optimista: el movimiento aparece al instante y, si el servidor falla, se revierte con aviso.
- **Panel con KPIs de verdad**: tasa de ahorro con objetivo, ritmo de gasto proyectado a fin de mes, ahorro por mes (media y acumulado), gasto fijo vs variable, top de gastos y estado de presupuestos. Las comparativas son honestas — el mes en curso se mide contra el mismo tramo de días del mes anterior, no contra el mes completo.
- **Presupuestos** mensuales por categoría, con alertas al acercarse al límite.
- **Gastos fijos** (alquiler, suscripciones…) que se registran solos el día que tocan.
- **Inversiones**: cartera de fondos con coste, valor actual y rentabilidad. Se siembra cada fondo con el valor y la ganancia que da el bróker, y a partir de ahí se guarda un **histórico de valoraciones** que se dibuja como gráfica de evolución por fondo. Las aportaciones cuentan como salida de dinero líquido.
- **Pendientes**: deudas (lo que te deben y lo que debes, con totales) y recordatorios con fecha y **avisos configurables por Telegram** (el día, la víspera, una semana antes…).
- **Tabla** completa con búsqueda, orden y exportación a CSV/XLSX en formato español (separador `;`, coma decimal, BOM para Excel).
- **Instalable** como app en Android/iOS, con service worker y acceso directo que abre el registro al momento.

### Bot de Telegram

- **Registro en lenguaje natural**: `12,50 cena mercadona`, `11 peluquero ayer`, `nómina 1200 el día 1`, `invertí 200 en indexado`. Entiende fechas relativas (ayer, mañana, "el jueves pasado", "hace 3 días"), deduce el tipo de movimiento y asigna categoría por palabras clave.
- **Dos capas, reglas primero**: un parser de reglas resuelve la mayoría de mensajes al instante y gratis; solo lo genuinamente ambiguo se delega a un **LLM** (Claude Haiku, con salida estructurada). La inmensa mayoría de mensajes no llega a gastar un token.
- **Consultas y correcciones**: `resumen`, `últimos`, `cómo va comida`, `borra el último`, más botones inline para recategorizar o borrar.
- **Inversiones**: `fondos` (estado de la cartera), `actualizar` (devuelve la lista pre-rellenada para cambiar solo los números), `nuevo fondo`.
- **Deudas y notas**: `me debe Juan 20 la cena`, `debo María 50`, `deudas`, `cobrado Juan`.
- **Proactivo (Vercel Cron)**: avisa al cruzar el 80 %/100 % de un presupuesto, recuerda actualizar los fondos los viernes, manda un resumen los domingos, dispara los recordatorios de pendientes y el día 1 envía el CSV del mes anterior como copia de seguridad.

## Arquitectura

```
móvil (PWA) ──┐
              ├── Next.js (App Router, en Vercel) ── Supabase (Postgres + RLS + Auth)
Telegram ─────┘         │
                        ├── /api/telegram    webhook del bot (secret token + allowlist)
                        ├── /api/cron/*       gastos fijos, recordatorios, resúmenes, backup
                        └── Claude Haiku      fallback de lenguaje natural del bot
```

- **Next.js 16** (App Router, Turbopack) con **React 19**, **Tailwind v4** y componentes sobre shadcn/ui. Gráficos con Recharts.
- **Supabase**: Postgres con **Row Level Security** en todas las tablas (cada fila lleva `user_id` y las políticas solo dejan ver y tocar lo propio) y autenticación por **magic link**, sin contraseñas. El bot y los crons corren en el servidor con el cliente admin, filtrando siempre por el usuario dueño.
- **PWA con Serwist**. Como el plugin clásico no soporta Turbopack, el service worker se genera en un paso propio del build, con una regla NetworkOnly para Supabase: los datos nunca se sirven de caché.
- **Vercel Cron** para los trabajos programados, autenticados con un secreto Bearer.
- **Telegram Bot API** directa (sin librerías): webhook validado por secret token de cabecera más allowlist de chat.

## Notas de ingeniería

- **Dinero en céntimos enteros** de punta a punta. Nada de floats para importes; solo se convierte a euros al pintar, con un parser de entrada tolerante al formato español (coma decimal, punto de miles).
- **La fecha "hoy" se calcula siempre en `Europe/Madrid`.** Vercel corre en UTC, y sin esto un gasto de medianoche caía en el día anterior. Una sola función centraliza el cálculo y todo el servidor pasa por ella.
- **Reglas antes que IA.** El parser resuelve fechas con aritmética de calendario ("el día 25" cuando estás a 10 es el 25 del mes pasado); la IA solo entra en lo ambiguo, y si falla, el bot pide reformular. Nunca rompe el flujo.
- **Seguridad desde el principio**: RLS en todas las tablas, registro de usuarios cerrado, webhook con doble verificación, protección anti open-redirect en el callback de auth, cabeceras de seguridad y ningún secreto en el repositorio ni en el bundle del cliente.

## Ejecutarlo en local

Necesitas un proyecto de Supabase (gratis) y, para el bot, uno de Telegram creado con @BotFather.

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Crea el esquema en Supabase (SQL Editor) ejecutando, en orden:
   [`schema.sql`](supabase/schema.sql), [`migracion-gastos-fijos.sql`](supabase/migracion-gastos-fijos.sql), [`migracion-inversiones.sql`](supabase/migracion-inversiones.sql) y [`migracion-pendientes.sql`](supabase/migracion-pendientes.sql).

3. Copia estas variables a un `.env.local`:

   | Variable | Qué es |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave publicable (`sb_publishable_…`) |
   | `SUPABASE_SECRET_KEY` | Clave secreta (`sb_secret_…`), solo servidor |
   | `TELEGRAM_BOT_TOKEN` | Token de @BotFather |
   | `TELEGRAM_CHAT_ID` | Tu chat id (allowlist: el bot solo te responde a ti) |
   | `TELEGRAM_WEBHOOK_SECRET` | Cadena aleatoria para validar el webhook |
   | `BOT_USER_ID` | UUID de tu usuario en Supabase (los registros del bot van a tu cuenta) |
   | `CRON_SECRET` | Cadena aleatoria que autentica los crons |
   | `ANTHROPIC_API_KEY` | Opcional: activa la capa de lenguaje natural del bot |

4. Arranca en desarrollo:

   ```bash
   npm run dev
   ```

El build de producción es `npm run build` (compila Next y genera el service worker). Los crons se definen en [`vercel.json`](vercel.json); en local se prueban llamando a los endpoints con el Bearer.

## Estructura

```
app/               Rutas (App Router): pantallas de la app, /api/telegram y /api/cron/*
components/finanzas/  Vistas y componentes de la UI
hooks/             Estado central de finanzas (cliente)
lib/finanzas/      Formato de dinero, fechas, semanas, CSV, tipos
lib/telegram/      Bot: parser de reglas, capa de IA, inversiones y pendientes
lib/supabase/      Clientes de Supabase (navegador, servidor y admin)
supabase/          Esquema y migraciones SQL
```

## Sobre este repo

Es un proyecto personal y de momento va a seguir siéndolo: no es un producto, no hay registro abierto y no busco contribuciones. Está publicado como parte de mi portfolio, para que se pueda leer el código y las decisiones que hay detrás. No tiene licencia de uso: todos los derechos reservados. Si tienes alguna pregunta sobre cómo está hecho, encantado de responderla.
