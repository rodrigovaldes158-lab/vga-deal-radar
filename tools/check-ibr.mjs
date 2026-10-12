/* =============================================================
   VGA — Deal Radar · vigía del Investment Banking Report
   -------------------------------------------------------------
   Busca cada día si Landmark ya publicó el IBR del mes siguiente,
   SIN depender de que el artículo que lo enlaza esté publicado.

   Dos sondas, porque el PDF y la página se publican por separado:

   1) EL PDF EN EL CDN. El sitio corre sobre HubSpot y el archivo
      vive en una ruta predecible (/hubfs/...). Es habitual que el
      archivo se suba al preparar la publicación, antes de que la
      página que lo enlaza esté en línea. Si es así, lo detectamos
      con días de anticipación.
      Ojo: Landmark alterna mayúsculas en el nombre del mes
      ("IBR agosto 2026.pdf" pero "IBR Julio 2026.pdf"), así que se
      prueban ambas variantes.

   2) EL ARTÍCULO. Los informes son correlativos (ene=2513 … ago=2520),
      así que se prueban los siguientes números. Se verifica que la
      página realmente sea un IBR y no otro artículo de la serie.

   Lo encontrado se escribe en ibr-watch.json, que la app lee para
   mostrar un aviso en la portada.

   Corre en GitHub Actions (Node 20). Sin dependencias, sin API key.
   ============================================================= */
import { readFile, writeFile } from "node:fs/promises";

const WATCH_PATH = new URL("../ibr-watch.json", import.meta.url);

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio",
                "Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const PDF_BASE = "https://landmark-cap.com/hubfs/Articulos%20diario%20financiero";
const ARTICLE_BASE = "https://landmark-cap.com/diario-financiero/articulo-";
const UA = "Mozilla/5.0 (compatible; VGA-DealRadar/1.0; +https://github.com/rodrigovaldes158-lab/vga-deal-radar)";

// Cuántos meses y cuántos artículos hacia adelante se prueban. Dos meses
// cubre el caso de que una corrida se haya saltado un mes.
const MONTHS_AHEAD = 2;
const ARTICLES_AHEAD = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- utilidades ---------- */

// "Agosto 2026" -> { monthIndex: 7, year: 2026 }
function parseMonth(label) {
  const m = String(label || "").trim().split(/\s+/);
  const idx = MONTHS.findIndex((x) => x.toLowerCase() === (m[0] || "").toLowerCase());
  const year = parseInt(m[1], 10);
  if (idx < 0 || !Number.isFinite(year)) return null;
  return { monthIndex: idx, year };
}

function addMonths({ monthIndex, year }, n) {
  const total = monthIndex + n;
  return { monthIndex: ((total % 12) + 12) % 12, year: year + Math.floor(total / 12) };
}

const label = ({ monthIndex, year }) => `${MONTHS[monthIndex]} ${year}`;

/* ---------- sonda 1: el PDF en el CDN ---------- */

function pdfCandidates({ monthIndex, year }) {
  const name = MONTHS[monthIndex];
  // Landmark alterna mayúscula y minúscula en el mes; probamos las dos.
  return [name, name.toLowerCase()].map(
    (m) => `${PDF_BASE}/IBR%20${encodeURIComponent(m)}%20${year}.pdf`
  );
}

async function headOk(url) {
  try {
    let res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA } });
    // Algunos CDN no responden a HEAD; reintenta con GET en ese caso.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { headers: { "User-Agent": UA } });
      res.body?.cancel?.();
    }
    return res.ok;
  } catch {
    return false;
  }
}

/* ---------- sonda 2: el artículo ---------- */

async function articleIsIbr(n) {
  const url = `${ARTICLE_BASE}${n}?hsLang=es`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const html = await res.text();
    // La serie "diario-financiero" tiene otros artículos; nos quedamos solo
    // con los que son efectivamente el Investment Banking Report.
    if (!/investment\s+banking|IBR/i.test(html)) return null;
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "";
    return { url, title: title.trim().slice(0, 160) };
  } catch {
    return null;
  }
}

/* ---------- principal ---------- */

async function main() {
  const state = JSON.parse(await readFile(WATCH_PATH, "utf8"));
  const known = parseMonth(state.latestKnown?.month);
  if (!known) {
    console.error(`latestKnown.month no se pudo interpretar: ${state.latestKnown?.month}`);
    process.exit(1);
  }

  const checks = [];
  let found = null;

  // Sonda 1 — el PDF, mes a mes hacia adelante.
  for (let i = 1; i <= MONTHS_AHEAD && !found; i++) {
    const target = addMonths(known, i);
    for (const url of pdfCandidates(target)) {
      const ok = await headOk(url);
      checks.push({ tipo: "pdf", url, ok });
      console.log(`${ok ? "ENCONTRADO" : "   —      "}  ${url}`);
      if (ok) {
        found = { month: label(target), via: "pdf", url };
        break;
      }
      await sleep(400);
    }
  }

  // Sonda 2 — el artículo correlativo.
  const baseArticle = parseInt(state.latestKnown?.article, 10);
  if (!found && Number.isFinite(baseArticle)) {
    for (let i = 1; i <= ARTICLES_AHEAD && !found; i++) {
      const n = baseArticle + i;
      const hit = await articleIsIbr(n);
      checks.push({ tipo: "articulo", url: `${ARTICLE_BASE}${n}`, ok: !!hit });
      console.log(`${hit ? "ENCONTRADO" : "   —      "}  articulo-${n}`);
      if (hit) found = { month: label(addMonths(known, 1)), via: "articulo", url: hit.url, title: hit.title, article: n };
      await sleep(400);
    }
  }

  // Conserva firstSeen si ya habíamos detectado este mismo informe.
  if (found) {
    const prev = state.found;
    found.firstSeen = (prev && prev.month === found.month) ? prev.firstSeen : new Date().toISOString();
  }

  const out = {
    checkedAt: new Date().toISOString(),
    latestKnown: state.latestKnown,
    found,
    note: "Lo escribe tools/check-ibr.mjs a diario. 'found' es un informe de Landmark más nuevo que 'latestKnown', aún no incorporado a ibr.json. Al incorporarlo, actualizar latestKnown y dejar found en null."
  };
  await writeFile(WATCH_PATH, JSON.stringify(out, null, 2) + "\n");

  console.log(found
    ? `\nHay informe nuevo: ${found.month} (vía ${found.via})\n${found.url}`
    : `\nSin novedades. Último conocido: ${state.latestKnown?.month}.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
