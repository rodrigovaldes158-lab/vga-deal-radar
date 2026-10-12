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
  Flujo original: pantalla de servicios → **PPA** → lista de M&A con filtros de **período**
  (1/3/7 meses) y **región** (single-select). Detalle por operación con enlace a la fuente.
  `deals.json` sembrado a mano con ~16 operaciones reales (de noticias/filings).
- **Etapa 2a (datos automáticos): COMPLETA Y EN PRODUCCIÓN (2026-06-14).**
  Repo `github.com/rodrigovaldes158-lab/vga-deal-radar`; workflow corre verde a diario y publica
  `deals.json` con las M&A del DF. **GitHub Pages activo** (deploy from branch main /root) y la
  app **instalada en el Android del usuario**. URL live:
  `https://rodrigovaldes158-lab.github.io/vga-deal-radar/`
- **Sección "Informe IB" — Fase 1 DESPLEGADA (2026-10-12):** pantalla `#screen-ibr`
  con las transacciones M&A del Investment Banking Report (Landmark + DF). `ibr.json` sembrado
  con 19 transacciones reales de Abril 2026 (extraídas del PDF del Escritorio). El banner de la
  pantalla PPA ahora dice "Informe IB" y abre la sección (deep-link `#ibr`).
  **Datos actualizados a Agosto 2026 (2026-10-12):** `ibr.json` consolida los informes de
  Abril a Agosto 2026 = **56 operaciones** (38 completadas + 18 anunciadas). Las que aparecen en
  varios informes se unificaron; las anunciadas que después cerraron quedaron como completadas
  (ej. GSI Capital / Rentas y Desarrollo Baker: anunciada en abril por US$290M, cerrada el
  10-06-26 por US$168M). `month` pasó a ser un rango ("Abril – Agosto 2026").
- **Fase 2 IBR (a decidir):** automatizar descarga+lectura del PDF mensual (frágil, requiere
  librería PDF en Actions, no testeable local) vs. actualización mensual asistida (leer el PDF
  nuevo y actualizar `ibr.json` a mano). Después sigue la **Etapa 2b (notificaciones push)**.
- Leer PDF sin poppler/Node/Python: **Word COM** + registro `DisableConvertPdfWarning=1`
  (ver memoria `vga-deal-radar-app` para el detalle). El reporte del IBR trae tabla
  Fecha/Activo/Vendedor/Comprador/Monto/Comentarios en secciones Completadas y Anunciadas.
  Listado Landmark: `landmark-cap.com/diario-financiero`; último mes = `articulo-NNNN` (nº más alto).
  `tools/fetch-deals.mjs` reescrito: consulta GDELT por región, **extrae**
  adquirente/objetivo/monto/sector del titular, y **fusiona** conservando las curadas
  (las que no tienen `auto:true`). Workflow `.github/workflows/update-deals.yml` lo corre
  a diario. La app muestra "actualizado <fecha>" y escapa el texto externo (anti-XSS).
  **Falta que el usuario lo active en GitHub** (ver README → "Cómo activarlo").
- **Portada `#screen-home` — NUEVA (2026-10-12).** Se eliminó la pantalla de selección de
  servicios; la app abre en una portada con jerarquía visual: hero (eyebrow mono + título 31px +
  bajada), franja de 3 estadísticas, **operación destacada** (la de mayor monto, con portada
  gráfica), **principales transacciones** (las 5 siguientes por monto, con miniatura) y dos
  tarjetas de navegación al detalle (Informe IB y Radar de noticias). Los listados de detalle
  quedaron exactamente como estaban.
  **Las "imágenes" son SVG generados en `app.js`** (`coverSvg`/`glyph`/`THEMES`): un degradado
  por familia de sector + una figura abstracta. Se hizo así a propósito — nada externo, así la
  PWA sigue funcionando offline y el service worker no tiene que cachear binarios nuevos.
  Para agregar un sector nuevo basta tocar `themeFor()`.
- **Etapa 2b (notificaciones push): PRÓXIMA TAREA.** Ver "Etapa 2b" abajo.

## Decisiones cerradas (no cambiar sin pedir al usuario)

- Plataforma = **PWA** (no app nativa por ahora).
- **No hay selector de servicios** (se quitó el 2026-10-12 a pedido del usuario). La app abre
  directamente en la **portada** (`#screen-home`). El PPA sigue siendo el servicio de fondo,
  pero ya no se elige en pantalla: se menciona en el subtítulo de la portada.
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

Deep-links útiles: `#ibr` (Informe IB) y `#ppa`, `#ppa-3`, `#ppa-7` (radar de noticias con
ese período). Sin hash, la app abre en la portada.

## Estructura

```
index.html              Pantallas (portada, radar, informe IB, detalle como bottom-sheet)
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
2. No reintroducir la pantalla de selección de servicios sin pedírselo al usuario.
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
- **Workflow self-commit (non-fast-forward)**: si la corrida manual y la del cron se cruzan,
  el `git push` se rechaza ("fetch first"). Solución ya aplicada en `update-deals.yml`:
  `concurrency: { group, cancel-in-progress: true }` + `git pull --rebase --autostash origin main`
  antes del push + `fetch-depth: 0` en checkout.
- **GitHub web**: arrastrar carpetas que empiezan con `.` (ej. `.github`) suele NO subirlas;
  crear/actualizar esos archivos con "Create new file" o "Upload files" DENTRO de la carpeta.
  El botón "Run workflow" solo aparece al seleccionar el workflow en la barra lateral izquierda.
- **La carpeta local YA ES el repo git (2026-10-12).** Se dejó de subir archivos a mano por la web
  de GitHub: `C:\Users\rodri\OneDrive\Escritorio\VGA App` es un clon de
  `github.com/rodrigovaldes158-lab/vga-deal-radar`. Ahora los cambios se publican con
  `git add … && git commit && git push` (GitHub Pages redespliega solo).
  - **NUNCA commitear `deals.json` desde local.** Lo reescribe el robot en la nube todos los días;
    la copia local se queda atrás. Antes de trabajar: `git pull` para traer la del robot.
  - **Finales de línea:** el repo está en LF y el clon de Git for Windows checkoutea CRLF
    (`core.autocrlf=true` a nivel sistema). En este repo se fijó `core.autocrlf=false`; si algún
    día *todos* los archivos aparecen modificados, es eso: normalizar con `sed -i 's/\r$//'`.
- **Medir responsividad de verdad:** servir con `serve.ps1` y cargar la app dentro de un
  `<iframe width=390>` en una página `_probe.html` del mismo origen; leer `scrollWidth` desde el
  padre. Las capturas directas de Edge headless con `--window-size=390` se ven cortadas aunque
  no haya overflow real (scrollWidth=375=clientWidth → correcto). Borrar `_probe.html` al terminar.
- **Los botones que parecen tarjetas (`.nav-card`, `.feature-card`, `.hl-card`) necesitan**
  `width:100%;border:0;text-align:left` **explícitos**, porque los `<button>` no heredan ancho ni
  alineación. Se descubrió con el banner `.source-banner` (ya eliminado) el 2026-10-12.
- **Leer los PDF del IBR: usar `tools/pdf-table.ps1`, NO Word COM.** El método viejo (Word COM)
  se colgó: 200s de CPU sin producir nada, incluso con `DisableConvertPdfWarning=1`. El script
  nuevo extrae el texto con posiciones usando solo .NET (sin Node, Python ni poppler):
  descomprime los streams FlateDecode del PDF y parsea los operadores `Tm`/`Td`/`Tj`/`TJ`,
  emitiendo `pagina<TAB>y<TAB>x<TAB>texto`. Uso:
  `powershell -File tools\pdf-table.ps1 -Path IBR.pdf -Out salida.txt`
  Después se agrupan las filas por coordenada `y` (tolerancia ~0.8) y se ordenan por `x`.
  Trampas ya resueltas dentro del script:
  - En PowerShell `$Out` y `$out` **son la misma variable** (no distingue mayúsculas) — por eso
    la lista se llama `$rows`.
  - Formatear con `{0:F1}` usa el locale español y escribe decimales con **coma**, lo que rompe
    el orden numérico; hay que usar `InvariantCulture`.
  - **No filtrar los streams por `BT`**: las tablas del IBR viven en streams que no contienen
    `BT` (el objeto de texto empieza en otro stream). Filtrar por `BT` perdía tablas completas.
  - Los streams que fallan al descomprimir son metadata XML e imágenes JPEG — es esperado.
  - Los PDF mensuales se bajan de `https://landmark-cap.com/hubfs/Articulos%20diario%20financiero/IBR%20<Mes>%202026.pdf`
    (ojo: el mes va capitalizado en unos meses y en minúscula en otros; sacar la URL exacta
    del artículo `articulo-NNNN`).
