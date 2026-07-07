# Bot de Telegram — guía de construcción

> Guía para montar el bot mañana. Está pensada para seguirla de arriba abajo.
> Lo que hace **Claude** (el código) y lo que haces **tú** (crear el bot, pegar
> claves) están separados en cada fase.

---

## 1. Qué va a hacer el bot

El bot es una **segunda puerta de entrada** a la misma app: escribe en la misma
base de datos de Supabase que ves en la web. No es una app aparte.

**Registrar (lo principal):**
- Escribes `12,50 cena mercadona` → el bot entiende importe/concepto, deduce la
  categoría y guarda el gasto. Responde: "✅ Gasto 12,50 € · Comida · cena mercadona".
- Si la categoría es ambigua, te la pregunta con **botones** (los botoncitos que
  salen bajo el mensaje en Telegram). Sigue siendo 1 mensaje + 1 toque.
- Por defecto es **gasto**; para otros tipos: `ingreso 1200 nomina` o
  `inversion 200 indexado`.

**Consultar:**
- "¿cuánto llevo este mes?" → resumen de gastos/ingresos/ahorro.
- "¿cómo va comida?" → gastado vs presupuesto de esa categoría.
- "últimos" → los últimos movimientos.

**Corregir:**
- "borra el último" → elimina el movimiento recién creado.

**Avisos automáticos (fase 3, opcional):**
- Resumen semanal los domingos.
- Aviso cuando superes el 80 % de un presupuesto.

---

## 2. Cómo funciona por dentro (para entenderlo)

```
   Tú escribes en Telegram
            │
            ▼
   Servidores de Telegram
            │  (webhook: Telegram llama a una URL nuestra por cada mensaje)
            ▼
   https://gestor-finanzas-azure.vercel.app/api/telegram
            │  (una API route más, dentro del mismo proyecto Next.js)
            ▼
   Parsea el mensaje  →  escribe/lee en Supabase  →  responde a Telegram
```

Claves del diseño:

- **El bot vive dentro de este mismo proyecto** como una ruta de API
  (`app/api/telegram/route.ts`). No hay servidor nuevo que mantener.
- **Necesita la URL pública de Vercel** (ya la tenemos) para que Telegram
  tenga a dónde llamar. Por eso el bot iba después del deploy.
- **Escribe en Supabase con la clave secreta** (`SUPABASE_SECRET_KEY`), que se
  salta el RLS. Como corre en el servidor (no en el navegador), es seguro.
- Como la clave secreta se salta el RLS, el bot **tiene que decir explícitamente
  a qué usuario pertenece cada movimiento** → necesitamos tu `user_id` (paso 3.3).

---

## 3. Lo que tienes que hacer TÚ (≈ 10 min)

### 3.1 Crear el bot con BotFather
1. En Telegram, busca **@BotFather** (el oficial, con el tick azul).
2. Escríbele `/newbot`.
3. Te pide un **nombre** (ej. "Mis Finanzas") y un **usuario** que debe acabar
   en `bot` (ej. `cesar_finanzas_bot`).
4. Al terminar te da un **token** tipo `8123456789:AAH...xyz`. **Guárdalo**, es
   la contraseña del bot.

### 3.2 Conseguir tu chat_id (para que solo tú puedas usarlo)
1. En Telegram busca **@userinfobot** y pulsa Start.
2. Te devuelve tu **Id** (un número tipo `123456789`). **Guárdalo.**
   - Esto sirve para que el bot **solo te responda a ti**: si otra persona lo
     encuentra y le escribe, lo ignora.

### 3.3 Conseguir tu user_id de Supabase (a qué cuenta van los datos)
1. En **supabase.com** → tu proyecto → menú **Authentication** → **Users**.
2. Verás tu usuario (tu email). Copia su **UID** (un uuid largo tipo
   `a1b2c3d4-...`). **Guárdalo.**
   - Es el `user_id` que el bot pondrá en cada movimiento para que aparezca en
     tu app.

### 3.4 Pegarme las tres cosas
Cuando las tengas, pásame:
- **Token del bot** (`8123...:AAH...`)
- **Tu chat_id** (`123456789`)
- **Tu user_id de Supabase** (`a1b2c3d4-...`)

> El token del bot es sensible (quien lo tenga controla el bot). No lo subas a
> git. Irá como variable de entorno en Vercel, igual que las de Supabase.

---

## 4. Lo que haré YO (el código)

### Fase 1 — Registrar gastos (lo mínimo útil)
- `app/api/telegram/route.ts`: el webhook que recibe los mensajes.
- **Seguridad**: comprueba un *secret token* en la cabecera (Telegram lo manda)
  y que el `chat_id` sea el tuyo (allowlist). Cualquier otro mensaje → ignorado.
- **Parser**: de `12,50 cena mercadona` saca importe (céntimos), concepto y
  adivina la categoría por palabras clave. Empezamos con reglas simples; si
  quieres, luego le enchufamos **Claude Haiku** para que entienda lenguaje
  natural de verdad (céntimos de € al mes).
- Inserta en `movimientos` con tu `user_id` y responde confirmando.
- Registro del webhook en Telegram (un comando `curl` que corro yo una vez).

### Fase 2 — Consultas y correcciones
- "cuánto llevo", "cómo va <categoría>", "últimos", "borra el último".
- Botones inline para desambiguar categoría.

### Fase 3 — Avisos automáticos (opcional)
- **Vercel Cron** (gratis): un `app/api/cron/resumen/route.ts` que corre solo
  los domingos y te manda el resumen; y aviso al pasar el 80 % de un presupuesto.

---

## 5. Variables de entorno que se añadirán (en Vercel y en .env.local)

```
TELEGRAM_BOT_TOKEN=8123...        # de BotFather
TELEGRAM_CHAT_ID=123456789        # tu chat (allowlist)
TELEGRAM_WEBHOOK_SECRET=<lo genero yo>   # valida que la llamada viene de Telegram
BOT_USER_ID=a1b2c3d4-...          # tu user_id de Supabase (a qué cuenta escribe)
# SUPABASE_SECRET_KEY ya existe en .env.local; hay que añadirla también en Vercel
```

> Recordatorio: `SUPABASE_SECRET_KEY` (la `sb_secret_...`) todavía **no está en
> Vercel**, solo en tu `.env.local`. Habrá que añadirla en Vercel para que el bot
> funcione en producción. Nunca lleva el prefijo `NEXT_PUBLIC_`.

---

## 6. Seguridad del bot (resumen)

- Solo responde a **tu chat_id** → nadie más puede meterte datos.
- El webhook valida un **secret token** → nadie puede llamar a nuestra URL
  haciéndose pasar por Telegram.
- La clave secreta de Supabase vive **solo en el servidor** (variable de entorno
  en Vercel), nunca viaja al navegador ni a git.

---

## 7. Ejemplos de uso (cómo se sentirá)

```
Tú:  12,50 cena mercadona
Bot: ✅ Gasto  12,50 €  ·  Comida  ·  cena mercadona

Tú:  ingreso 1200 nomina
Bot: ✅ Ingreso  1.200,00 €  ·  Nómina

Tú:  45 gasolina
Bot: ¿Qué categoría?  [Transporte] [Coche] [Otros]
Tú:  (pulsas Transporte)
Bot: ✅ Gasto  45,00 €  ·  Transporte  ·  gasolina

Tú:  cuánto llevo este mes
Bot: 📊 Julio → Ingresos 1.200 €  ·  Gastos 340,50 €  ·  Ahorro 859,50 €

Tú:  borra el último
Bot: 🗑️ Borrado: Gasto 45,00 € · Transporte
```

---

## 8. Orden de mañana (checklist)

- [ ] 3.1 Crear bot con BotFather → token
- [ ] 3.2 chat_id con @userinfobot
- [ ] 3.3 user_id en Supabase → Authentication → Users
- [ ] 3.4 Pegarme las tres cosas
- [ ] (Claude) Añadir `SUPABASE_SECRET_KEY` + las nuevas vars en Vercel
- [ ] (Claude) Escribir el webhook y registrarlo en Telegram
- [ ] Probar: escribir `1 prueba` en el bot y ver que aparece en la app
- [ ] Fase 2 y 3 cuando la 1 funcione
