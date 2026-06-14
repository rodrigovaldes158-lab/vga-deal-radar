# CLAUDE.md — VGA Deal Radar (app móvil)

Guía para Claude Code al trabajar en esta app. Léela antes de hacer cambios.

## Qué es

App móvil **PWA** de **Valdés Group Advisory (VGA)** que detecta oportunidades de venta
de proyectos de la consultora a partir de **fusiones y adquisiciones (M&A)** publicadas en
fuentes públicas. Mismo nombre y logo que el sitio web de VGA.

- Stack: **HTML + CSS + JavaScript puro. Sin framework. Sin build.** (igual que el sitio web).
- Es instalable en el teléfono y abre offline (service worker).

## Estado actual (2026-06-14)

- **Etapa 1 (MVP): COMPLETA y con diseño aprobado por el usuario.**
  Flujo: pantalla de servicios → **PPA** → lista de M&A con filtros de **período**
  (1/3/7 meses) y **región** (single-select). Detalle por operación con enlace a la fuente.
  `deals.json` sembrado a mano con ~16 operaciones reales (de noticias/filings).
- **Etapa 2a (datos automáticos): IMPLEMENTADA (sin probar en la nube todavía).**
  `tools/fetch-deals.mjs` reescrito: consulta GDELT por región, **extrae**
  adquirente/objetivo/monto/sector del titular, y **fusiona** conservando las curadas
  (las que no tienen `auto:true`). Workflow `.github/workflows/update-deals.yml` lo corre
  a diario. La app muestra "actualizado <fecha>" y escapa el texto externo (anti-XSS).
  **Falta que el usuario lo active en GitHub** (ver README → "Cómo activarlo").
- **Etapa 2b (notificaciones push): PRÓXIMA TAREA.** Ver "Etapa 2b" abajo.

## Decisiones cerradas (no cambiar sin pedir al usuario)

- Plataforma = **PWA** (no app nativa por ahora).
- Un solo servicio: **Purchased Price Allocation (PPA)**. Validar antes de agregar más.
- Filtro período: **1 / 3 / 7 meses**.
- Filtro región: **single-select** con opción "Todas" → Chile / Latinoamérica / EE.UU. / Global.
- Datos = **fuentes públicas gratuitas** (en Etapa 1 se sembraron a mano; Etapa 2 automatiza).

## Cómo correr / previsualizar

Entorno: Windows, **sin Node ni Python** (solo Git). Para probar localmente:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1   # http://localhost:8000
```

Abrir `index.html` con doble clic NO sirve (el navegador bloquea `fetch('deals.json')`
vía `file://`). Hay que servirlo por HTTP.

Deep-links útiles: `#ppa`, `#ppa-3`, `#ppa-7` (abren PPA con ese período).

## Estructura

```
index.html              Pantallas (servicios, lista, detalle como bottom-sheet)
styles.css              Estilos. Tokens de marca VGA al inicio (:root)
app.js                  Lógica (IIFE vanilla): carga deals.json, filtros, detalle, SW
deals.json              Datos M&A (ver esquema abajo)
manifest.webmanifest    PWA: nombre "VGA — Valdés Group Advisory", tema navy, íconos
sw.js                   Service worker: shell cache-first, deals.json network-first
serve.ps1               Servidor local de pruebas (HttpListener, :8000)
icons/                  icon.svg (fuente) + icon-180/192/512.png
assets/                 vga_mark.svg (navy+teal) y vga_mark_reverse.svg (blanco+teal)
tools/fetch-deals.mjs   Robot de actualización (Etapa 2, requiere Node 18+)
```

### Esquema de `deals.json`

```
{ service, generatedAt, note, deals: [ {
    id, date (ISO "YYYY-MM-DD"), approxDate (bool → muestra "≈"),
    target, acquirer, country, region ("CL"|"LATAM"|"US"|"GLOBAL"),
    sector, value (string | null), summary, source, url
} ] }
```

El filtro de período compara `date` contra `new Date()` (fecha real del dispositivo).
El de región hace match exacto con `region` ("ALL" = todas).

## Etapa 2a — Detección automática (HECHO, falta activar en GitHub)

Implementado en `tools/fetch-deals.mjs` + `.github/workflows/update-deals.yml`.

**Fuentes** (a pedido del usuario, foco Chile):
- **Diario Financiero** vía **Google News RSS** (`site:df.cl` + keywords M&A) — fuente
  principal. Estructurado, enlaza a DF. Cubre lo mismo que el Investment Banking Report.
- **GDELT** para US / LATAM / GLOBAL (complemento). Se quitó la query CL de GDELT (la cubre DF).
- **Investment Banking Report (Landmark + DF)**: la app enlaza al reporte mensual (PDF) con
  un banner `.source-banner` en la pantalla PPA (https://landmark-cap.com/en/ibr-df).
  PENDIENTE: extraer las operaciones individuales de los PDFs del IBR (más trabajo; los PDFs
  no tienen endpoint estructurado — requeriría descargar+parsear PDF). Por ahora = link.

Merge rule: deals sin `auto:true` = curados, siempre se conservan; los `auto:true` se
refrescan cada corrida. Extracción por regex sobre el titular (ES/EN) + monto + sector por
keywords; si no hay adquirente→objetivo se usa `headline` (titular completo) y la app lo
muestra como título. Texto externo escapado en `app.js` (anti-XSS).

Como no hay Node local, **no se probó la ejecución real**: validar el RSS de DF dio 50 ítems
reales (vía WebFetch), pero el parser corre de verdad recién en GitHub Actions. Mejora futura:
refinar extracción con la Claude API, filtrar relevancia PPA, y parsear los PDFs del IBR.

## Etapa 2b — Notificaciones push (PRÓXIMA TAREA)

Agregar **Web Push**: en `app.js` pedir permiso y suscribir con **clave VAPID pública**;
guardar la suscripción; y un disparador que envíe el aviso cuando el robot detecta una
operación nueva. Camino de menor infraestructura para un solo usuario: generar claves VAPID
una vez, que la app muestre/“copie” la suscripción para pegarla como **secret** del repo,
y que el workflow (con `web-push`) notifique al detectar ids nuevos. Para multi-usuario
("y otras personas") haría falta un backend/almacén de suscripciones (Etapa 3).
Recordar añadir el handler `push`/`notificationclick` en `sw.js`.

## Despliegue al teléfono (usuario usa **Android**)

PWA necesita **https**. Camino más simple: **Netlify Drop** (https://app.netlify.com/drop)
→ arrastrar la carpeta → URL https → abrir en Chrome Android → menú ⋮ → "Instalar aplicación".
Con cuenta gratis de Netlify se conserva una URL fija para ir actualizando.

## Marca

Reusar la identidad VGA: navy `#0B1F3A`, teal `#14B8A6`, paper `#FBFBF8`, fog `#F4F6F9`.
Tipografías: Inter Tight (texto) + JetBrains Mono (datos). El logo son **dos puntos**
(sin marco ni fondo); versión reverse (punto inferior blanco) para fondos oscuros.

## Reglas

1. No introducir build step ni framework.
2. No agregar más servicios además de PPA hasta que el usuario lo pida.
3. No romper la responsividad (probado a 390px).
4. La fuente de datos debe ser pública/gratuita salvo que el usuario decida lo contrario.

## Notas de desarrollo (gotchas ya resueltos)

- **Verificar responsividad**: las capturas directas de Edge headless con `--window-size`
  pueden verse cortadas horizontalmente aunque NO haya overflow real. Para medir de verdad,
  cargar la app dentro de un `<iframe>` de 390px y revisar `documentElement.scrollWidth`
  (debe ser 390) — así se confirmó que el layout es correcto.
- **Generar íconos**: renderizar `icons/icon.svg` a PNG 512 con Edge headless y luego
  **reescalar** a 192/180 con `System.Drawing` (los renders directos a 180/192 fallaban por
  timing de carga del SVG).
- **Edge headless** no escribe screenshots a rutas con espacios (la carpeta es "VGA App"):
  renderizar a `%TEMP%` y luego copiar.
- **Detener `serve.ps1`**: el puerto 8000 aparece como dueño "System/PID 4" (http.sys);
  hay que matar el proceso `powershell.exe` cuya CommandLine contiene `serve.ps1`.
