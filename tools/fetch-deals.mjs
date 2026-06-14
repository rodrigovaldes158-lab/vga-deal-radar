/* =============================================================
   VGA — Deal Radar · automatic deal fetcher  (ETAPA 2a)
   -------------------------------------------------------------
   Fuentes:
   1) Diario Financiero (M&A) — vía Google News RSS (site:df.cl).
      Es la fuente principal para Chile: trae operaciones anunciadas
      y confirmadas, enlazando de vuelta al artículo del DF. Cubre lo
      mismo que reporta el Investment Banking Report (Landmark + DF).
   2) GDELT DOC 2.0 — complemento para US / Latam / Global.

   Para cada titular extrae adquirente / objetivo / monto / sector
   (heurística por regex). Si no logra separar adquirente→objetivo,
   IGUAL conserva la noticia usando el titular como resumen.

   MERGE: las operaciones SIN `auto:true` (curadas) se conservan
   siempre; las `auto:true` se refrescan en cada corrida.

   Corre en GitHub Actions (Node 20). Sin dependencias, sin API key.
   ============================================================= */
import { readFile, writeFile } from "node:fs/promises";

const DEALS_PATH = new URL("../deals.json", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Fuente 1: Diario Financiero (Google News RSS) ----------
   Dos consultas para ensanchar la cobertura (Google News limita los
   resultados por feed). Se deduplican luego en main(). */
const DF_QUERIES = [
  'site:df.cl (adquisición OR "adquisición de" OR adquiere OR adquirir OR adquirida OR adquirido OR fusión OR fusiona OR fusionar OR "fusión por absorción" OR "se fusiona")',
  'site:df.cl ("compra de" OR "compra el" OR "compra la" OR "compra participación" OR comprar OR comprará OR "toma control" OR "toma el control" OR "se queda con" OR "se hace con" OR OPA OR "oferta pública de adquisición" OR "vende sus operaciones" OR "vende su participación" OR "vende el" OR desinversión OR "paquete accionario" OR "joint venture" OR "M&A" OR "cierra la compra" OR "concreta la compra")'
];
const dfFeedUrl = (q) =>
  "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&hl=es-419&gl=CL&ceid=CL:es-419";

/* ---------- Fuente 2: GDELT (US / Latam / Global) ---------- */
const GDELT_REGIONS = {
  LATAM:  { country: "Latinoamérica",
            q: '(acquire OR acquisition OR merger OR adquiere OR adquisición OR fusión) (sourcecountry:BR OR sourcecountry:MX OR sourcecountry:CO OR sourcecountry:AR OR sourcecountry:PE)' },
  US:     { country: "Estados Unidos",
            q: '("agrees to acquire" OR "to acquire" OR "completes acquisition" OR "agrees to buy") sourcecountry:US' },
  GLOBAL: { country: "Global",
            q: '("agrees to acquire" OR "completes acquisition of" OR "merger agreement")' }
};
const TIMESPAN = "7d";
const MAX_PER_REGION = 60;
const MAX_TOTAL = 200;

/* ---------- Parsing de titulares ---------- */
const PARTY_PATTERNS = [
  /^(.+?)\s+agrees?\s+to\s+acquire\s+(.+)$/i,
  /^(.+?)\s+agrees?\s+to\s+buy\s+(.+)$/i,
  /^(.+?)\s+completes?\s+acquisition\s+of\s+(.+)$/i,
  /^(.+?)\s+to\s+acquire\s+(.+)$/i,
  /^(.+?)\s+to\s+buy\s+(.+)$/i,
  /^(.+?)\s+acquires?\s+(.+)$/i,
  /^(.+?)\s+buys?\s+(.+)$/i,
  /^(.+?)\s+concreta\s+(?:la\s+)?(?:adquisici[oó]n|compra)\s+(?:de\s+)?(.+)$/i,
  /^(.+?)\s+completa\s+la\s+adquisici[oó]n\s+de\s+(.+)$/i,
  /^(.+?)\s+acuerda\s+(?:comprar|adquirir)\s+(.+)$/i,
  /^(.+?)\s+(?:adquiere|compra)\s+(.+)$/i
];

function clean(s) {
  return (s || "").replace(/\s+/g, " ")
    .replace(/^[\s"'“”|:–—-]+|[\s"'“”.,;:]+$/g, "")
    .replace(/['’]s$/i, "").trim();
}
function trimTarget(s) {
  const cut = s.split(/\s+(?:for|in|por|en|amid|por un|a nivel)\s+|[—–-]\s+|\s*[:;]\s*|\s+\(/i)[0];
  return clean(cut);
}
function extractParties(title) {
  const t = title.replace(/\s+/g, " ").trim();
  for (const re of PARTY_PATTERNS) {
    const m = t.match(re);
    if (m) {
      const acquirer = clean(m[1]);
      const target = trimTarget(m[2]);
      if (acquirer && target && acquirer.length <= 55 && target.length <= 60) {
        return { acquirer, target };
      }
    }
  }
  return null;
}
function extractValue(title) {
  const m = title.match(
    /((?:US?\$|\$|€|£|R\$)\s?\d[\d.,]*\s?(?:billion|trillion|million|bn|mil\s?millones|millones|mill[oó]n)?)/i
  );
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}
const SECTORS = [
  [/\b(bank|banco|fintech|insurance|segur|asset manage|wealth|agf|inversiones)\b/i, "Finanzas / Seguros"],
  [/\b(pharma|biotech|farmac|drug|health|salud|medtech|m[eé]dic|hospital|cl[ií]nica)\b/i, "Salud / Farmacéutica"],
  [/\b(software|tech|\bai\b|cloud|data\s?center|semiconductor|cyber|digital|saas|startup)\b/i, "Tecnología"],
  [/\b(energy|energ|solar|oil|gas|power|renewable|utilit|hydro|el[eé]ctric)\b/i, "Energía"],
  [/\b(telecom|fiber|fibra|wireless|5g|broadband|telef[oó]nica)\b/i, "Telecomunicaciones"],
  [/\b(retail|consumer|food|beverage|restaurant|grocery|brand|aguas|aliment|embotellad)\b/i, "Consumo / Retail"],
  [/\b(real\s?estate|inmobil|property|reit|mall|shopping|estaciones de servicio)\b/i, "Inmobiliario"],
  [/\b(mining|miner|copper|cobre|lithium|litio|steel|metal|molycop)\b/i, "Minería"],
  [/\b(industrial|manufactur|equipment|machin|chemical|qu[ií]mic)\b/i, "Industrial"]
];
function extractSector(title) {
  for (const [re, name] of SECTORS) if (re.test(title)) return name;
  return "";
}
function inferRegion(title) {
  if (/\b(EEUU|EE\.?\s?UU|Estados Unidos|Wall Street|Warner Bros|Nasdaq)\b/i.test(title)) return "US";
  if (/\b(Brasil|brasile|M[eé]xico|mexicana?|Colombia|colombian?|Argentina|argentin|Per[uú]|peruan)\b/i.test(title)) return "LATAM";
  return "CL"; // DF es chileno: por defecto Chile
}
function decodeEntities(s) {
  return (s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
function hashId(prefix, url) {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) >>> 0;
  return prefix + "-" + h.toString(36);
}
function dealFromTitle(title, { date, url, source, region, country }) {
  const parties = extractParties(title);
  return {
    id: hashId(region.toLowerCase(), url),
    date,
    approxDate: !/\d{4}-\d{2}-\d{2}/.test(date) ? true : false,
    auto: true,
    acquirer: parties ? parties.acquirer : "",
    target: parties ? parties.target : "",
    headline: parties ? "" : title,           // fallback cuando no hay adquirente→objetivo
    country,
    region,
    sector: extractSector(title),
    value: extractValue(title),
    summary: title,
    source,
    url
  };
}

/* ---------- Fetchers ---------- */
async function fetchDFQuery(q) {
  const res = await fetch(dfFeedUrl(q), { headers: { "User-Agent": "VGA-Deal-Radar/1.0" } });
  if (!res.ok) { console.warn("DF RSS HTTP", res.status); return []; }
  const xml = await res.text();
  const items = xml.split(/<item>/).slice(1);
  const out = [];
  for (const it of items) {
    const rawTitle = (it.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
    const link = (it.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
    const pub = (it.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || "";
    const src = decodeEntities((it.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || "Diario Financiero");
    let title = decodeEntities(rawTitle.replace(/<!\[CDATA\[|\]\]>/g, "")).trim();
    title = title.replace(/\s+-\s+[^-–—]+$/, "").trim();   // quita el " - Fuente" que agrega Google News
    const d = pub ? new Date(pub) : null;
    const date = d && !isNaN(d) ? d.toISOString().slice(0, 10) : "";
    if (!title || !link || !date) continue;
    out.push(dealFromTitle(title, {
      date, url: link.trim(), source: src || "Diario Financiero",
      region: inferRegion(title), country: "Chile"
    }));
  }
  return out;
}

async function fetchDF() {
  let all = [];
  for (const q of DF_QUERIES) {
    try {
      const items = await fetchDFQuery(q);
      console.log("  DF query →", items.length, "items");
      all = all.concat(items);
    } catch (e) { console.warn("  DF query falló:", e.message); }
    await sleep(1500);
  }
  return all;
}

async function fetchGdelt(region, cfg) {
  const url = "https://api.gdeltproject.org/api/v2/doc/doc"
    + "?query=" + encodeURIComponent(cfg.q)
    + "&mode=ArtList&maxrecords=" + MAX_PER_REGION
    + "&timespan=" + TIMESPAN + "&sort=DateDesc&format=json";
  const res = await fetch(url, { headers: { "User-Agent": "VGA-Deal-Radar/1.0" } });
  if (!res.ok) { console.warn("GDELT", region, "HTTP", res.status); return []; }
  let data;
  try { data = JSON.parse(await res.text()); } catch { return []; }
  const out = [];
  for (const a of data.articles || []) {
    const title = (a.title || "").trim();
    if (!extractParties(title)) continue;     // GDELT es ruidoso: solo titulares M&A claros
    const date = (a.seendate || "").slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    out.push(dealFromTitle(title, {
      date, url: a.url, source: a.domain || "GDELT", region, country: a.sourcecountry || cfg.country
    }));
  }
  return out.map((d) => ({ ...d, approxDate: true }));
}

/* ---------- Merge & write ---------- */
const dedupeKey = (d) =>
  (d.acquirer + "→" + d.target + "|" + (d.headline || "")).toLowerCase().replace(/[^a-z0-9→|]/g, "").slice(0, 80);

async function main() {
  let curated = [];
  try {
    const prev = JSON.parse(await readFile(DEALS_PATH, "utf8"));
    curated = (prev.deals || []).filter((d) => !d.auto);
  } catch { /* sin archivo previo */ }

  let auto = [];
  try {
    const df = await fetchDF();
    console.log("Diario Financiero →", df.length, "operaciones");
    auto = auto.concat(df);
  } catch (e) { console.warn("DF falló:", e.message); }

  for (const [region, cfg] of Object.entries(GDELT_REGIONS)) {
    try {
      const items = await fetchGdelt(region, cfg);
      console.log("GDELT", region, "→", items.length);
      auto = auto.concat(items);
    } catch (e) { console.warn("GDELT", region, "falló:", e.message); }
    await sleep(2000);
  }

  const seenUrl = new Set(), seenKey = new Set(), combined = [];
  for (const d of [...curated, ...auto]) {
    if (!d.date) continue;
    const k = dedupeKey(d);
    if (seenUrl.has(d.url) || seenKey.has(k)) continue;
    seenUrl.add(d.url); seenKey.add(k);
    combined.push(d);
  }
  combined.sort((a, b) => (a.date < b.date ? 1 : -1));

  const out = {
    service: "PPA",
    generatedAt: new Date().toISOString().slice(0, 10),
    note: "Diario Financiero (M&A) + GDELT + operaciones curadas. Ver Investment Banking Report (Landmark + DF) en la app.",
    deals: combined.slice(0, MAX_TOTAL)
  };
  await writeFile(DEALS_PATH, JSON.stringify(out, null, 2));
  console.log("deals.json:", out.deals.length, "operaciones (", curated.length, "curadas +", auto.length, "auto )");
}

main();
