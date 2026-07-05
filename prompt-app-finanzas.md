
# Prompt para Claude Code — App de finanzas personales

> Pégalo entero en Claude Code, dentro de la carpeta de tu proyecto. Está dividido en tres fases: crear el proyecto si no existe, preparar el sistema de diseño (Cult UI) y construir la app. Ve confirmando conmigo al final de cada fase antes de seguir.

---

## Contexto

Voy a construir una **app web de finanzas personales, mobile-first e instalable en el móvil (PWA)**. Stack: **Next.js + Tailwind v4 + shadcn/ui**, con **Cult UI** como sistema de componentes con personalidad y **21st.dev (magic)** para componer UI. Animaciones con `motion` (no `framer-motion`).

**Skills del proyecto** (están en `.claude/skills/`, úsalas sin que te lo recuerde):
- `ui-ux-pro-max` — criterio de UI/UX: jerarquía, espaciado, tipografía, color y coherencia visual.
- `components-build` — spec oficial de Cult UI para crear/refactorizar componentes React (composición, accesibilidad, design tokens, tipos).
- `fixing-motion-performance` — auditor de animaciones; lo invoco yo con `/fixing-motion-performance` cuando quiera revisar performance.

Trabaja por fases y **confirma cada fase antes de avanzar**. Puede que ya tenga varias dependencias instaladas, así que en la Fase 0 prioriza **verificar** antes que instalar.

---

## FASE -1 — Crear el proyecto si no existe

- Si en la raíz **no hay `package.json`**, crea el proyecto primero:
  ```bash
  npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
  ```
  (Next.js con App Router, TypeScript y Tailwind v4. Si la carpeta tiene archivos sueltos tipo `.md` o `.claude/`, no pasa nada: créalo igualmente en la raíz.)
- Si ya hay `package.json`, salta directamente a la Fase 0.

---

## FASE 0 — Preparar el sistema de diseño (Cult UI)

Quiero usar **Cult UI** (https://cult-ui.com · github.com/nolly-studio/cult-ui). Es un **registry de shadcn, no un paquete npm**. Tu tarea es dejarlo listo en cinco pasos. Hazlos en orden y confirma cada uno antes de avanzar.

**1. Verifica el stack**
   - Lee `package.json` y dime: versión de Tailwind, versión de Next.js (o el framework), si hay shadcn (`components.json` en raíz), y si está instalado `motion` o `framer-motion`.
   - Si Tailwind está en v3, propón el upgrade a v4 (no lo corras todavía, solo dímelo y espera mi visto bueno).
   - Si tengo `framer-motion` instalado, márcalo: Cult UI usa `motion`, no `framer-motion`.

**2. Inicializa shadcn si falta**
   - Si no hay `components.json`, corre `npx shadcn@latest init` con defaults razonables para mi stack (paleta neutral, CSS variables, base color neutral).
   - Si ya hay `components.json`, no lo toques.

**3. Instala dependencias faltantes**
   - `motion` (no `framer-motion`). Si tengo `framer-motion`, desinstálalo primero.
   - `clsx` y `tailwind-merge` si no están.

**4. Configura el registry @cult-ui**
   - Edita `components.json` y agrega el bloque:
     ```json
     "registries": {
       "@cult-ui": "https://cult-ui.com/r/{name}.json"
     }
     ```
   - Si `components.json` ya tenía un bloque `registries`, fusiona sin sobrescribir lo existente.

**5. Smoke test**
   - Agrega el `cosmic-button` como primer componente:
     ```bash
     npx shadcn@latest add https://cult-ui.com/r/cosmic-button.json
     ```
   - Confirma que el archivo quedó en `components/ui/` (o donde shadcn lo configuró).
   - Importa el componente en una página de prueba para verificar que compila sin errores.

**Si algún paso falla:**
   - Si el `add` falla con "registry not found", usa la URL directa en lugar de la sintaxis `@cult-ui/`.
   - Si `motion` da error de imports tipo "Cannot find module 'motion/react'", verifica que NO esté instalado `framer-motion` en paralelo.
   - Si Tailwind no aplica clases del componente, confirma que estás en v4 con el plugin `@tailwindcss/postcss` configurado.

**Al final de la Fase 0, dime:** qué quedó instalado, qué archivos cambiaste, y un comando listo para que yo agregue el siguiente componente.

---

## FASE 1 — Construir la app

### Filosofía

- **Registrar es lo que hago 5 veces al día → tiene que ser ultrarrápido** (2-3 toques). Consultar el dashboard es lo que hago 1 vez a la semana → puede tener más detalle.
- Un único punto de entrada para todo movimiento, con selector de tipo: **Ingreso / Gasto / Inversión**. Según el tipo, el movimiento se clasifica y aparece en su sección, sin que yo tenga que ir a sitios distintos.
- Todo se registra con **fecha manual editable** (por defecto hoy), para poder apuntar algo de ayer si se me pasó.
- Debe sentirse como un producto real, no como una hoja de cálculo.

### Funcionalidades núcleo

1. **Registro rápido de movimiento:** importe, tipo (Ingreso/Gasto/Inversión), categoría (desplegable), concepto/sitio (texto libre), fecha (editable, hoy por defecto).
2. **Categorías y presupuestos configurables** por el usuario. Cada categoría de gasto puede tener un presupuesto mensual opcional.
3. **Vistas de Gastos, Ingresos e Inversiones** filtradas automáticamente por tipo.
4. **Sección de inversiones diferenciada:** además del historial de aportaciones (que llega solo desde los movimientos de tipo Inversión), una cartera donde llevo cada posición con lo aportado y el valor actual, y que me calcule ganancia (€) y rentabilidad (%). El valor actual lo actualizo yo a mano de vez en cuando. Al registrar un movimiento de tipo Inversión, aparece un selector opcional de posición: lo **aportado** de cada posición se deriva de sus movimientos vinculados (los movimientos sin posición cuentan en el total invertido pero no en ninguna posición).
5. **Dashboard mensual:**
   - KPIs grandes y legibles: ingresos, gastos, ahorro (ingresos − gastos) e invertido del mes.
   - Gasto por categoría vs presupuesto, con barras de progreso y aviso visual claro al pasarme de un presupuesto.
   - Reparto de gastos (gráfico circular o de barras).
   - Selector de mes para ver meses anteriores.
6. **Vista Tabla (estilo hoja de cálculo):** todos los movimientos de un mes en una **tabla de filas y columnas, como en Excel** (fecha, tipo, categoría, concepto, importe), con fila de totales abajo. Selector de mes. Ordenable por columna. Es la "foto completa" del mes. En móvil debe seguir siendo legible (scroll horizontal si hace falta, con la columna de importe siempre visible).
7. **Exportar / descargar:** bajar los datos de un mes (o de todo) a **Excel (.xlsx) o CSV**, para tener siempre una copia tipo hoja de cálculo fuera de la app. El CSV con separador **`;`** y **BOM UTF-8** (es lo que Excel en español abre bien); el .xlsx con SheetJS o similar.
8. **Persistencia en Supabase** (ver requisitos técnicos): los datos sobreviven entre sesiones y se sincronizan entre móvil y portátil.
9. **Formato es-ES / EUR en toda la app:** importes con `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })` (coma decimal, `1.234,56 €`) y fechas en formato español.

### Pantallas

- **Home / Registro:** botón grande de "+" para añadir movimiento. Debajo, los últimos movimientos en una lista limpia (icono por categoría, importe en color según tipo: verde ingreso, rojo gasto, azul inversión).
- **Dashboard:** KPIs arriba en tarjetas, luego gráficos, luego desglose por categoría con barras de presupuesto.
- **Tabla:** el mes en tabla estilo hoja de cálculo, con fila de totales, selector de mes, ordenable, y botón de exportar a Excel/CSV.
- **Inversiones:** cartera con rentabilidad arriba, historial de aportaciones debajo.
- **Ajustes:** gestionar categorías y presupuestos.

Navegación inferior fija (tab bar), estilo app nativa. Agrupa las secciones con criterio (p. ej. Home, Dashboard, Tabla, Inversiones, y Ajustes desde un icono).

### Dirección visual

- Estética moderna, limpia y con carácter — **nada de plantilla genérica**. Referencia: fintech cuidadas (Revolut / N26 / Fintonic), pero con personalidad propia. Apóyate en Cult UI y en la skill `ui-ux-pro-max`.
- Modo oscuro por defecto, con acentos de color por tipo de movimiento.
- Tipografía clara, jerarquía fuerte (los importes son los protagonistas).
- Animaciones sutiles al añadir un movimiento (feedback satisfactorio), con `motion`.
- Todo tiene que verse impecable a 380px de ancho.

### Modelo de datos

- **Movimiento:** { id, userId, fecha (string `YYYY-MM-DD`, sin hora ni timezone), tipo, **categoriaId**, concepto, **importeCents** (entero, céntimos), posicionId (opcional, solo tipo Inversión) }.
- **Categoría:** { **id**, userId, nombre, tipo (ingreso/gasto/inversión), presupuestoMensualCents (opcional, entero) }.
- **Posición de inversión:** { id, userId, nombre, valorActualCents } → lo aportado se deriva de los movimientos vinculados; ganancia y rentabilidad calculadas.

Reglas del modelo:
- **Los importes se guardan en céntimos como entero** (nunca float: evita errores de coma flotante con dinero). Se formatean a € solo al pintar.
- **Los movimientos referencian la categoría por `categoriaId`**, no por nombre: renombrar una categoría no puede romper el histórico.
- **Todas las tablas llevan `userId` desde el día 1**, aunque de momento el usuario sea solo yo: deja preparado el extra de multi-perfil sin migración.
- Al borrar una categoría con movimientos, ofrece reasignarlos a otra (no borrado en cascada silencioso).

### Requisitos técnicos

- **Next.js + Tailwind v4 + shadcn/ui**, mobile-first y responsive.
- **Cult UI** para los componentes con personalidad; **21st.dev (magic)** para componer UI; skill `ui-ux-pro-max` para el criterio del conjunto y spec `components-build` al crear componentes. Animaciones con `motion`.
- **Gráficos con Recharts** (es lo que usan los charts oficiales de shadcn; no metas otra librería de gráficos).
- **PWA instalable:** que se pueda "Añadir a pantalla de inicio" y abrir a pantalla completa con su icono, como app nativa. Incluye `manifest.json`, iconos y service worker con **Serwist** (`@serwist/next`) — no uses `next-pwa`, está poco mantenido con App Router.
- **Persistencia con Supabase** (Postgres + Auth), para que los datos se sincronicen entre el móvil y el portátil:
  - **Auth con magic link** (email, sin contraseña — el usuario soy solo yo, no necesito registro elaborado).
  - **RLS activado en todas las tablas** con política por `user_id`: mis finanzas no pueden quedar en una tabla legible públicamente.
  - Las credenciales (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) van en `.env.local` (y `.env.local` en `.gitignore`).
  - Dame tú el SQL de creación de tablas y políticas listo para pegar en el SQL Editor de Supabase.
- **Optimistic UI en el registro rápido:** al guardar un movimiento aparece al instante en la lista y se sincroniza con Supabase por detrás (con rollback y aviso si falla). Registrar no puede sentirse lento por estar esperando a la red.
- Estado bien organizado; cálculos (totales, ahorro, rentabilidad, progreso de presupuesto) siempre derivados de los datos, nunca hardcodeados.
- Código limpio y comentado en los puntos clave, para poder ampliarlo yo después.

### Qué evitar

- Que parezca una hoja de cálculo o un formulario aburrido.
- Densidad excesiva en móvil: mejor tarjetas y scroll que tablas apretadas (salvo en la vista Tabla, que sí es tabla a propósito).
- Datos de ejemplo que no se puedan borrar fácil (mete 2-3 de muestra y ya).

### Orden de construcción

Empieza por el **núcleo** y confírmame antes de seguir con los extras:
1. **Setup de Supabase** — este paso lo hacemos juntos: yo creo el proyecto en supabase.com y te pego las keys en `.env.local`; tú me das el SQL de tablas + RLS para el SQL Editor y montas el cliente y el login por magic link. No sigas hasta que el login funcione.
2. Registro de movimiento + persistencia (con optimistic UI).
3. Vistas por tipo (Gastos / Ingresos / Inversiones).
4. Vista Tabla + exportar.
5. Dashboard (KPIs y gráficas las afinamos juntos después).
6. PWA instalable.

### Extras (segunda iteración)

1. Editar y borrar un movimiento ya creado.
2. Filtro/búsqueda de movimientos dentro de la tabla.
3. Multi-usuario o "perfiles", para que cada persona lleve lo suyo dentro de una estructura común (el esquema ya viene preparado con `userId` en todas las tablas, así que esto no requiere migración).
4. **Bot de Telegram como puerta de entrada y gestor:**
   - Registrar movimientos escribiendo `12,50 cena mercadona`; el bot parsea importe/concepto, deduce la categoría y pide confirmación con botones inline si es ambigua.
   - Consultas: "¿cuánto llevo este mes?", "¿cómo va el presupuesto de comida?" — lee de la misma Supabase que la web.
   - Avisos proactivos con Vercel Cron: resumen semanal y alerta al superar el 80% de un presupuesto.
   - Correcciones: "borra el último".
   - Implementación: API route en este mismo proyecto Next.js como webhook de Telegram (requiere deploy en Vercel). Seguridad: secret token en el webhook + allowlist de `chat_id`. Opcional: Claude Haiku para parsear lenguaje natural.
