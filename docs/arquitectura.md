# Cómo funciona todo esto (explicado para entenderlo)

## El mapa general: 4 piezas

```
  TU MÓVIL / PC                    INTERNET
 ┌─────────────┐
 │  La app     │ ──── pide páginas ────►  VERCEL (el ordenador que ejecuta tu código)
 │  (navegador)│ ◄─── responde HTML ────  · corre el código que está en GitHub
 └─────────────┘                          · también corre el webhook del bot y los crons
        │                                        │
        │  lee/escribe datos                     │  lee/escribe datos (como admin)
        ▼                                        ▼
  SUPABASE (la base de datos + el login)  ◄──────┘
  · guarda movimientos, categorías, fijos…
  · comprueba quién eres (magic link)

  TELEGRAM ── cada mensaje tuyo ──► VERCEL (/api/telegram) ──► SUPABASE
```

- **GitHub** guarda el código (la receta). No ejecuta nada.
- **Vercel** es un ordenador alquilado (gratis) que coge esa receta y la sirve
  en internet. Cada `git push` → Vercel reconstruye y publica solo.
- **Supabase** es la base de datos (los datos viven ahí, no en tu móvil) más el
  sistema de login. Por eso ves lo mismo en el móvil y en el PC.
- **Telegram** solo hace de mensajero: reenvía tus mensajes a Vercel.

## Qué es SQL y por qué lo pegas en Supabase

Una base de datos es como un Excel gigante y estricto:

- Cada **tabla** es una hoja (`movimientos`, `categorias`, `gastos_fijos`).
- Cada **fila** es un dato (un gasto concreto).
- Cada **columna** tiene tipo fijo (`importe_cents` solo acepta enteros).

**SQL es el idioma para hablar con ella.** Lo que pegaste en el SQL Editor
eran órdenes en ese idioma:

- `create table gastos_fijos (...)` → "créame una hoja nueva con estas
  columnas y estas reglas" (p. ej. `check (dia_mes between 1 and 31)`: la
  propia base de datos rechaza un día 45, aunque el código tuviera un bug).
- `alter table movimientos add column gasto_fijo_id ...` → "añade una columna
  a una hoja que ya existe".
- `create policy ... using (auth.uid() = user_id)` → esto es el **RLS**
  (seguridad a nivel de fila): "cada fila tiene dueño, y solo su dueño puede
  verla o tocarla". Es la razón de que tus datos estén a salvo aunque la clave
  pública de la app sea visible.

¿Por qué lo pegas tú a mano? Porque crear/cambiar tablas es una operación de
administrador total, y esa la haces tú logueado en supabase.com. El día a día
(insertar gastos) sí lo hace la app sola.

## Las variables de entorno de Vercel: qué son y por qué existen

Son la **configuración que vive fuera del código**. Dos motivos:

1. **Secretos.** El código está en GitHub; si una contraseña estuviera escrita
   en el código, estaría en GitHub. Las variables viven solo en Vercel (y en tu
   `.env.local`, que git ignora).
2. **Cada entorno, sus valores.** El mismo código corre en tu PC y en
   producción; lo que cambia (claves, URLs) va en variables.

Las 8 del proyecto, agrupadas:

| Variable | Qué es | Por qué existe |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dirección de tu base de datos | La app tiene que saber a qué servidor hablar |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave **pública** de Supabase | Identifica tu proyecto; puede verse (el RLS protege los datos). `NEXT_PUBLIC_` = viaja al navegador |
| `SUPABASE_SECRET_KEY` | Clave **maestra** (se salta el RLS) | La usan el bot y los crons, que corren en servidor sin sesión. Jamás `NEXT_PUBLIC_` |
| `TELEGRAM_BOT_TOKEN` | Contraseña del bot | Permite a nuestro código hablar como @gestor_finanzas_bot |
| `TELEGRAM_CHAT_ID` | Tu número de chat | El portero: mensajes de cualquier otro chat se ignoran |
| `TELEGRAM_WEBHOOK_SECRET` | Contraseña de la puerta /api/telegram | Solo Telegram (que la conoce) puede llamar a esa URL |
| `BOT_USER_ID` | Tu id de usuario en Supabase | El bot escribe con la clave maestra y debe firmar cada dato como tuyo |
| `CRON_SECRET` | Contraseña de /api/cron/* | Solo Vercel Cron (que la manda solo) puede disparar los procesos automáticos |

El patrón que se repite: **toda puerta pública lleva llave**, y cada pieza
tiene la mínima llave que necesita.

## La lógica de cada flujo (uniendo las piezas)

**Registras un gasto en la app:** el navegador (con tu sesión de login) escribe
en Supabase directamente. El RLS comprueba que la fila lleva tu `user_id`.
La UI lo pinta al instante y sincroniza por detrás (optimistic UI).

**Le escribes `12,50 cena` al bot:** Telegram llama a
`vercel.app/api/telegram` con el secreto → ¿es tu chat? → el código parsea el
mensaje, escribe en Supabase con la clave maestra firmando `BOT_USER_ID`, y
responde por Telegram. La app lo verá porque los datos son los mismos.

**Gastos fijos:** cada mañana Vercel Cron llama a `/api/cron/diario` con
`CRON_SECRET` → el código mira qué fijos tocan hoy → inserta los movimientos
(marcados con `gasto_fijo_id` para no duplicar y para separar fijos de
variables en el Panel) → te avisa por Telegram.

**Resumen semanal:** los domingos, mismo mecanismo con `/api/cron/resumen`.

## Por qué "no hay servidor nuestro" y aun así todo funciona

No hay ningún ordenador encendido 24/7 que sea tuyo. Vercel ejecuta tu código
**solo cuando alguien llama** (tú, Telegram o el cron) y lo apaga después: por
eso es gratis. Los datos persisten porque viven en Supabase, no en el código.
