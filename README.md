# Gestor de finanzas

App de finanzas personales que uso a diario: una PWA instalada en el móvil y un bot de Telegram que hace de puerta de entrada rápida. La hice porque las apps de finanzas que probé me pedían demasiados pasos para apuntar un café, y al final dejaba de usarlas. Aquí la regla es una: registrar un gasto tiene que costar menos de cinco segundos, y si no quiero abrir la app, se lo escribo al bot como le escribiría a un amigo.

En producción corre en Vercel con Supabase de backend. Es un proyecto personal: la instancia desplegada es para mi uso, el registro está cerrado y de momento no está pensado como producto abierto al público. Publico el código para que se pueda leer cómo está montado y por qué.

## Qué hace

**La app (PWA, mobile-first, modo oscuro):**

- Registro rápido de gastos, ingresos e inversiones en tres toques, con UI optimista: el movimiento aparece al instante y si el servidor falla, se revierte con aviso.
- Panel con KPIs de verdad: tasa de ahorro con objetivo, ritmo de gasto proyectado a fin de mes, evolución de 6 meses, desglose fijo vs variable, top de gastos y estado de presupuestos.
- Presupuestos mensuales por categoría, con la cabecera de inicio diciéndote lo que llevas gastado y lo que te queda.
- Gastos fijos (alquiler, suscripciones...) que se registran solos el día que tocan.
- Tabla completa con búsqueda, orden y exportación a CSV/XLSX (formato español: separador `;`, coma decimal, BOM para Excel).
- Instalable como app en Android/iOS, con service worker y acceso directo que abre el registro directamente.

**El bot de Telegram (mi favorito):**

- Registra en lenguaje natural: `12,50 cena mercadona`, `11 peluquero ayer`, `nomina 1200 el día 1`. Entiende fechas, deduce que una nómina es un ingreso y asigna categoría por palabras clave.
- Funciona en dos capas: primero un parser de reglas (instantáneo y gratis) y, solo si este no entiende el mensaje, se lo pasa a un LLM (Claude Haiku) con salida estructurada. La inmensa mayoría de mensajes no llegan a gastar ni un token.
- Consultas y correcciones: `resumen`, `últimos`, `cómo va comida`, `borra el último`, más botones inline para recategorizar o borrar cualquier registro.
- Proactivo: te avisa cuando un gasto cruza el 80% o el 100% de un presupuesto, manda un resumen cada domingo y el día 1 de cada mes te envía el CSV del mes anterior como copia de seguridad. Guardas el chat y tienes backup de por vida.

## Cómo está montado

```
móvil (PWA) ──┐
              ├── Next.js (App Router, en Vercel) ── Supabase (Postgres + RLS + Auth)
Telegram ─────┘         │
                        ├── /api/telegram   webhook del bot (secret token + allowlist)
                        ├── /api/cron/*     gastos fijos, resumen semanal, backup mensual
                        └── Claude Haiku    solo como fallback de lenguaje natural
```

- **Next.js 16** (App Router, Turbopack) con **React 19**, **Tailwind v4** y componentes sobre shadcn/ui. Gráficos con Recharts.
- **Supabase**: Postgres con Row Level Security en todas las tablas (cada fila lleva `user_id` y las políticas solo dejan ver/tocar lo tuyo) y autenticación por magic link, sin contraseñas. El bot usa el cliente admin en el servidor, siempre filtrando por el usuario dueño.
- **PWA con Serwist**. Como el plugin clásico de Next no soporta Turbopack, el service worker se genera en un paso propio de build (`serwist build`) con una regla explícita de NetworkOnly para Supabase: los datos nunca se sirven de caché.
- **Vercel Cron** para los trabajos programados, autenticados con un secreto Bearer.
- **Telegram Bot API** a pelo (sin librerías): webhook validado por secret token de cabecera más allowlist de chat.

## Decisiones que tomé por el camino

- **Los importes son enteros en céntimos** de punta a punta. Nada de floats para dinero; solo se convierte a euros al pintar (`Intl.NumberFormat` es-ES).
- **La fecha "hoy" se calcula siempre en Europe/Madrid.** Vercel corre en UTC y lo aprendí a las malas: un gasto registrado a las 00:30 caía en el día anterior. Ahora hay una sola función `hoyISO()` que usa `Intl.DateTimeFormat` con timezone y todo el servidor pasa por ella.
- **Reglas primero, IA después.** El parser del bot resuelve el 90% de los mensajes con regex y aritmética de calendario ("el día 25" cuando estás a 10 es el 25 del mes pasado). Solo cede al LLM lo que de verdad es ambiguo ("el sábado pasado"), y si la IA falla, el bot pide reformular: la IA solo puede sumar, nunca romper el flujo.
- **Seguridad pensada desde el principio**: RLS en todo, registro de usuarios cerrado, webhook con doble verificación, protección anti open-redirect en el callback de auth, cabeceras de seguridad y ningún secreto en el repo ni en el bundle del cliente.

Hay más detalle en [docs/arquitectura.md](docs/arquitectura.md) y [docs/bot-telegram.md](docs/bot-telegram.md).

## Ejecutarlo en local

Hace falta un proyecto de Supabase (gratis) y, si quieres el bot, un bot de Telegram creado con @BotFather.

1. Clona e instala:

   ```bash
   npm install
   ```

2. Crea el esquema en Supabase ejecutando [supabase/schema.sql](supabase/schema.sql) (y [supabase/migracion-gastos-fijos.sql](supabase/migracion-gastos-fijos.sql)) en el SQL Editor.

3. Copia estas variables a un `.env.local`:

   | Variable | Qué es |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave publicable (`sb_publishable_...`) |
   | `SUPABASE_SECRET_KEY` | Clave secreta (`sb_secret_...`), solo servidor |
   | `TELEGRAM_BOT_TOKEN` | Token de @BotFather |
   | `TELEGRAM_CHAT_ID` | Tu chat id (allowlist: el bot solo te responde a ti) |
   | `TELEGRAM_WEBHOOK_SECRET` | Cadena aleatoria para validar el webhook |
   | `BOT_USER_ID` | UUID de tu usuario en Supabase (los registros del bot van a tu cuenta) |
   | `CRON_SECRET` | Cadena aleatoria que autentica los crons |
   | `ANTHROPIC_API_KEY` | Opcional: activa la capa de lenguaje natural del bot |

4. Arranca:

   ```bash
   npm run dev
   ```

El build de producción es `npm run build` (compila Next y genera el service worker). Los crons están definidos en [vercel.json](vercel.json); en local se pueden probar llamando a los endpoints con el Bearer.

## Pendiente

- Rediseñar la parte de inversiones (valoración de posiciones, aportaciones vs revalorización). Es la pieza más cambiante y quiero pensarla bien antes de complicarla.
- Lista de movimientos agrupada por día con totales diarios.
- Selector de icono para categorías personalizadas.

## Sobre este repo

Es un proyecto personal y de momento va a seguir siéndolo: no es un producto, no hay registro abierto y no busco contribuciones por ahora. Está publicado como parte de mi portfolio, para que se pueda leer el código y las decisiones que hay detrás. No tiene licencia de uso: todos los derechos reservados. Si tienes alguna pregunta sobre cómo está hecho, encantado de responderla.
