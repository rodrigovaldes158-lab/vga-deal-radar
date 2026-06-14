# VGA — Deal Radar

App móvil (PWA) de **Valdés Group Advisory** para detectar oportunidades de venta de
proyectos a partir de fusiones y adquisiciones (M&A) publicadas en fuentes públicas.

Mismo nombre y logo que el sitio web de VGA. Sin framework, sin paso de build:
HTML + CSS + JavaScript puro.

---

## Qué hace hoy (Etapa 1 — MVP)

1. Pantalla de **servicios** → por ahora solo **Purchased Price Allocation (PPA)**.
2. Al elegir PPA, muestra una **lista de fusiones y adquisiciones** con dos filtros:
   - **Período:** último mes / últimos 3 meses / últimos 7 meses.
   - **Región:** Todas / Chile / Latinoamérica / EE.UU. / Global (una a la vez).
3. Cada operación abre un **detalle** con adquirente, objetivo, país, sector, monto,
   fuente y un enlace a la noticia.
4. Es **instalable** en el teléfono (se agrega a la pantalla de inicio con el logo VGA)
   y abre **offline** (cachea la app; los datos se refrescan cuando hay conexión).

> Los datos iniciales en `deals.json` se recopilaron manualmente desde fuentes públicas
> (noticias y filings), con enlace a la fuente. Son operaciones reales pero la cobertura
> es parcial: es el punto de partida para validar la experiencia.

---

## Probarla en el computador

No hay Node ni Python instalados, así que se incluye un servidor local en PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Luego abre **http://localhost:8000** en el navegador.
(Abrir `index.html` directo con doble clic **no** funciona: el navegador bloquea la
carga de `deals.json` vía `file://`. Hay que servirlo por HTTP.)

Atajos de enlace directo: `#ppa`, `#ppa-3`, `#ppa-7` abren PPA con ese período.

---

## Instalarla en el teléfono

Para que el teléfono la abra (y para que las notificaciones funcionen en la Etapa 2),
la app debe estar en una URL **https**. La forma gratuita más simple:

1. Subir esta carpeta a un hosting estático gratuito (**GitHub Pages**, **Netlify** o
   **Cloudflare Pages**).
2. Abrir la URL en el teléfono:
   - **iPhone (Safari):** Compartir → "Agregar a pantalla de inicio".
   - **Android (Chrome):** menú ⋮ → "Instalar app" / "Agregar a pantalla de inicio".

---

## Etapa 2a — Datos que se actualizan solos ✅ (implementada)

El robot `tools/fetch-deals.mjs` reúne operaciones de:

1. **Diario Financiero (M&A)** — fuente principal para Chile, vía **Google News RSS**
   (`site:df.cl`). Trae las operaciones anunciadas y confirmadas que publica el DF en su
   versión gratis, enlazando de vuelta al artículo. Es la misma cobertura que alimenta el
   **Investment Banking Report (Landmark + DF)**.
2. **GDELT** — complemento para EE.UU. / Latinoamérica / Global.

De cada titular **extrae** adquirente / objetivo / monto / sector; si no logra separar
"adquirente → objetivo", igual conserva la noticia mostrando el titular completo. Luego
**fusiona** con `deals.json`: tus operaciones **curadas** (sin `auto:true`) se conservan
siempre; solo se refrescan las detectadas automáticamente.

Además, la app enlaza directamente al **Investment Banking Report** de Landmark + DF
(banner en la pantalla de PPA → https://landmark-cap.com/en/ibr-df).

El workflow `.github/workflows/update-deals.yml` lo corre en **GitHub Actions** una vez al
día y publica el `deals.json` actualizado. En la app aparece "actualizado <fecha>".

### Cómo activarlo (una sola vez)

1. Crea una cuenta gratis en **github.com** y un **repositorio nuevo** (privado o público).
2. Sube esta carpeta al repo. Sin instalar Git: en el repo nuevo → "uploading an existing
   file" → arrastra todos los archivos (incluida la carpeta `.github`). Con Git instalado:
   `git init && git add . && git commit -m "VGA Deal Radar" && git push`.
3. En el repo → **Settings → Actions → General → Workflow permissions** → marca
   **"Read and write permissions"** (para que el robot pueda guardar el `deals.json`).
4. Ve a la pestaña **Actions** → "Actualizar deals.json" → **Run workflow** para probarlo
   ahora (sin esperar al cron). Debería commitear un `deals.json` actualizado.
5. (Hosting) En **Settings → Pages** elige la rama `main` → carpeta raíz. Eso te da una URL
   `https://usuario.github.io/repo/` para instalar la app en el teléfono (reemplaza a
   Netlify; al actualizar el `deals.json`, la app se actualiza sola).

> El parser de titulares es de "primera pasada": las operaciones automáticas pueden venir
> con algún dato incompleto. Las curadas mantienen la calidad. Refinar la extracción
> (p. ej. con la Claude API) es una mejora futura.

## Etapa 2b — Notificaciones push (pendiente)

Avisar al teléfono cuando aparece una operación nueva relevante para PPA. Requiere:
**Web Push** en la app (pedir permiso + suscripción con claves VAPID) y un disparador que
envíe el aviso cuando el robot detecta algo nuevo. Es la próxima tarea.

---

## Estructura

```
index.html              Pantallas de la app
styles.css              Estilos (tokens de marca VGA)
app.js                  Lógica: carga de datos, filtros, detalle
deals.json              Operaciones M&A (datos de la Etapa 1)
manifest.webmanifest    Metadatos PWA (nombre, íconos, color)
sw.js                   Service worker (offline + datos network-first)
serve.ps1               Servidor local para pruebas
icons/                  Íconos de la app (icon.svg es la fuente)
assets/                 Logo de dos puntos (claro y reverse)
tools/fetch-deals.mjs   Robot de detección M&A (GDELT) — Etapa 2a
.github/workflows/      update-deals.yml: corre el robot a diario (GitHub Actions)
```

---

## Próximos servicios

PPA es el primero a propósito, para validar el flujo. Una vez probado, se agregan más
servicios en la pantalla de inicio (cada uno con sus propias fuentes y filtros).
