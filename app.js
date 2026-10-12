/* =============================================================
   VGA — Deal Radar · app logic
   Vanilla JS, no build step.
   ============================================================= */
(function () {
  "use strict";

  var REGION_LABEL = { CL: "Chile", LATAM: "Latinoamérica", US: "EE.UU.", GLOBAL: "Global" };
  var MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

  var state = { deals: [], period: 1, region: "ALL", screen: "home", generatedAt: "", ibr: null };

  // ---- DOM refs ----
  var screens = {
    home: document.getElementById("screen-home"),
    deals: document.getElementById("screen-deals"),
    ibr: document.getElementById("screen-ibr")
  };
  var backBtn = document.getElementById("backBtn");
  var dealList = document.getElementById("dealList");
  var emptyState = document.getElementById("emptyState");
  var resultMeta = document.getElementById("resultMeta");
  var regionFilter = document.getElementById("regionFilter");
  var periodFilter = document.getElementById("periodFilter");
  var sheetBackdrop = document.getElementById("sheetBackdrop");
  var sheetBody = document.getElementById("sheetBody");
  var ibrGroups = document.getElementById("ibrGroups");
  var ibrSub = document.getElementById("ibrSub");
  var ibrReportLink = document.getElementById("ibrReportLink");
  var ibrEmpty = document.getElementById("ibrEmpty");
  var heroEyebrow = document.getElementById("heroEyebrow");
  var statStrip = document.getElementById("statStrip");
  var featuredBox = document.getElementById("featured");
  var highlightsBox = document.getElementById("highlights");
  var homeEmpty = document.getElementById("homeEmpty");
  var goIbrSub = document.getElementById("goIbrSub");
  var goDealsSub = document.getElementById("goDealsSub");

  // ---- Helpers ----
  function fmtDate(iso) {
    var d = new Date(iso + "T00:00:00");
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  // Escape untrusted text (deal fields come from public news headlines).
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  // Only allow http(s) links from data.
  function safeUrl(u) {
    return /^https?:\/\//i.test(u || "") ? u : "#";
  }
  // Title: "Acquirer → Target" when parsed, else the full headline.
  function dealTitleHtml(d) {
    if (d.acquirer && d.target) {
      return esc(d.acquirer) + ' <span class="arrow">→</span> ' + esc(d.target);
    }
    return esc(d.headline || d.summary || "");
  }
  // "US$ 290 millones" -> 290 (millions). 0 when not disclosed.
  function parseValue(v) {
    if (!v) return 0;
    var m = String(v).replace(/\./g, "").match(/(\d+(?:,\d+)?)/);
    return m ? parseFloat(m[1].replace(",", ".")) : 0;
  }
  function thousands(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function monthsAgo(n) {
    var d = new Date();
    d.setMonth(d.getMonth() - n);
    return d;
  }

  function filtered() {
    var cutoff = monthsAgo(state.period);
    return state.deals
      .filter(function (x) { return new Date(x.date + "T00:00:00") >= cutoff; })
      .filter(function (x) { return state.region === "ALL" || x.region === state.region; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  // ---- Cover art ----------------------------------------------------------
  // Generated inline SVG, one theme per sector family. No external images, so
  // the app keeps working offline and nothing extra has to be cached.
  var gradSeq = 0;
  // Each sector key has a photo in assets/sectores/<key>.jpg plus a gradient +
  // glyph that shows through if the photo has not been cached yet.
  var SECTORS = {
    mineria:      { glyph: "peaks",  a: "#0B1F3A", b: "#1E5F74" },
    energia:      { glyph: "bolt",   a: "#0C4A43", b: "#14B8A6" },
    agro:         { glyph: "peaks",  a: "#11331F", b: "#4E8C4A" },
    inmobiliario: { glyph: "blocks", a: "#13233F", b: "#425C7A" },
    industrial:   { glyph: "blocks", a: "#2A1F1A", b: "#8A5A3B" },
    salud:        { glyph: "pulse",  a: "#0E3A4A", b: "#17A2B8" },
    tecnologia:   { glyph: "nodes",  a: "#152B52", b: "#4F6BA8" },
    educacion:    { glyph: "nodes",  a: "#1A2440", b: "#5A6E9A" },
    portuario:    { glyph: "waves",  a: "#0A2E4A", b: "#2B8CA8" },
    aerolineas:   { glyph: "waves",  a: "#102A46", b: "#3E7FA8" },
    retail:       { glyph: "bars",   a: "#2B1C3A", b: "#7A5A9A" },
    financiero:   { glyph: "bars",   a: "#0B1F3A", b: "#2C7A7B" }
  };
  // Order matters: "Alimentos" must land on agro before "consumo/retail" is tested.
  function sectorKey(sector) {
    var s = (sector || "").toLowerCase();
    if (/miner|litio/.test(s)) return "mineria";
    if (/energ|transmis/.test(s)) return "energia";
    if (/forest|agr|aliment/.test(s)) return "agro";
    if (/inmobil|hotel|construc/.test(s)) return "inmobiliario";
    if (/industrial|acero/.test(s)) return "industrial";
    if (/salud|farmac|sanitar/.test(s)) return "salud";
    if (/tecnolog|medios/.test(s)) return "tecnologia";
    if (/educac/.test(s)) return "educacion";
    if (/portuar|log/.test(s)) return "portuario";
    if (/aerol/.test(s)) return "aerolineas";
    if (/consumo|retail|deporte/.test(s)) return "retail";
    return "financiero";
  }
  function glyph(kind) {
    switch (kind) {
      case "peaks":
        return '<path d="M0 100 L42 44 L72 78 L104 30 L160 100 Z" fill="#fff" opacity=".16"/>' +
               '<path d="M0 100 L34 62 L68 100 Z" fill="#fff" opacity=".10"/>';
      case "bolt":
        return '<path d="M86 14 L58 56 H78 L70 92 L104 46 H82 Z" fill="#fff" opacity=".20"/>' +
               '<circle cx="34" cy="30" r="16" fill="#fff" opacity=".08"/>';
      case "blocks":
        return '<rect x="28" y="52" width="26" height="48" fill="#fff" opacity=".16"/>' +
               '<rect x="62" y="32" width="26" height="68" fill="#fff" opacity=".12"/>' +
               '<rect x="96" y="60" width="26" height="40" fill="#fff" opacity=".18"/>';
      case "pulse":
        return '<path d="M12 68 H48 L58 44 L72 88 L86 58 L96 68 H148" fill="none" stroke="#fff" ' +
               'stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".22"/>';
      case "nodes":
        return '<path d="M38 70 L72 36 L118 60" fill="none" stroke="#fff" stroke-width="3" opacity=".18"/>' +
               '<circle cx="38" cy="70" r="11" fill="#fff" opacity=".20"/>' +
               '<circle cx="72" cy="36" r="8" fill="#fff" opacity=".14"/>' +
               '<circle cx="118" cy="60" r="13" fill="#fff" opacity=".16"/>';
      case "waves":
        return '<path d="M-4 66 Q26 48 56 66 T116 66 T176 66" fill="none" stroke="#fff" stroke-width="5" opacity=".18"/>' +
               '<path d="M-4 84 Q26 66 56 84 T116 84 T176 84" fill="none" stroke="#fff" stroke-width="5" opacity=".12"/>';
      default:
        return '<rect x="30" y="64" width="18" height="36" rx="3" fill="#fff" opacity=".14"/>' +
               '<rect x="56" y="46" width="18" height="54" rx="3" fill="#fff" opacity=".18"/>' +
               '<rect x="82" y="30" width="18" height="70" rx="3" fill="#fff" opacity=".22"/>' +
               '<rect x="108" y="54" width="18" height="46" rx="3" fill="#fff" opacity=".12"/>';
    }
  }
  function coverSvg(sector) {
    var key = sectorKey(sector);
    var t = SECTORS[key];
    var id = "g" + (++gradSeq);
    return '<svg class="cover" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
             '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
               '<stop offset="0" stop-color="' + t.a + '"/><stop offset="1" stop-color="' + t.b + '"/>' +
             '</linearGradient></defs>' +
             '<rect width="160" height="100" fill="url(#' + id + ')"/>' +
             glyph(t.glyph) +
           "</svg>" +
           '<img class="cover-img" src="assets/sectores/' + key + '.jpg" alt="" />' +
           '<span class="cover-tint"></span>';
  }

  // ---- Navigation ----
  function show(name) {
    state.screen = name;
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle("is-active", k === name);
    });
    backBtn.hidden = name === "home";
    window.scrollTo(0, 0);
  }

  // ---- Home ---------------------------------------------------------------
  function renderHome() {
    var data = state.ibr;
    if (!data || !data.transactions || !data.transactions.length) {
      homeEmpty.hidden = false;
      return;
    }
    homeEmpty.hidden = true;
    var txs = data.transactions;
    var announced = txs.filter(function (t) { return t.status === "Anunciada"; });

    heroEyebrow.textContent = (data.month || "") + " · Chile";

    // Stat strip
    var total = 0;
    txs.forEach(function (t) { total += parseValue(t.value); });
    statStrip.innerHTML =
      stat(txs.length, "Operaciones") +
      stat(thousands(total), "US$ millones") +
      stat(announced.length, "Anunciadas");

    // Ranked by disclosed amount; the biggest one becomes the featured card.
    var ranked = txs.filter(function (t) { return parseValue(t.value) > 0; })
                    .sort(function (a, b) { return parseValue(b.value) - parseValue(a.value); });
    if (!ranked.length) ranked = txs.slice(0, 6);

    var top = ranked[0];
    featuredBox.innerHTML = "";
    var fc = document.createElement("button");
    fc.className = "feature-card";
    fc.type = "button";
    fc.innerHTML =
      '<span class="feature-cover">' + coverSvg(top.sector) +
        '<span class="feature-badge">' + esc(top.status) + "</span>" +
      "</span>" +
      '<span class="feature-body">' +
        '<span class="feature-sector">' + esc(top.sector || "M&A") + "</span>" +
        '<span class="feature-title">' + esc(top.acquirer) + ' <span class="arrow">→</span> ' + esc(top.target) + "</span>" +
        '<span class="feature-meta">' +
          (top.value ? '<span class="feature-value">' + esc(top.value) + "</span>" : "") +
          '<span class="feature-date">' + (top.date ? fmtDate(top.date) : "Por cerrar") + "</span>" +
        "</span>" +
      "</span>";
    fc.addEventListener("click", function () { openIbrSheet(top, data); });
    featuredBox.appendChild(fc);

    // Next five by amount
    highlightsBox.innerHTML = "";
    ranked.slice(1, 6).forEach(function (t) {
      var card = document.createElement("button");
      card.className = "hl-card";
      card.type = "button";
      card.innerHTML =
        '<span class="hl-cover">' + coverSvg(t.sector) + "</span>" +
        '<span class="hl-body">' +
          '<span class="hl-sector">' + esc(t.sector || "M&A") + "</span>" +
          '<span class="hl-title">' + esc(t.acquirer) + ' <span class="arrow">→</span> ' + esc(t.target) + "</span>" +
          '<span class="hl-value">' + esc(t.value || "No divulgado") + "</span>" +
        "</span>";
      card.addEventListener("click", function () { openIbrSheet(t, data); });
      highlightsBox.appendChild(card);
    });

    goIbrSub.textContent = txs.length + " transacciones · " + (data.month || "");
  }
  function stat(v, k) {
    return '<div class="stat"><span class="stat-v">' + esc(v) + '</span><span class="stat-k">' + esc(k) + "</span></div>";
  }

  // ---- Rendering ----
  function renderDeals() {
    var rows = filtered();
    dealList.innerHTML = "";
    emptyState.hidden = rows.length > 0;

    var periodTxt = state.period === 1 ? "último mes" : "últimos " + state.period + " meses";
    var regionTxt = state.region === "ALL" ? "todas las regiones" : REGION_LABEL[state.region];
    var updatedTxt = state.generatedAt ? " · actualizado " + fmtDate(state.generatedAt) : "";
    resultMeta.textContent = rows.length + " operación" + (rows.length === 1 ? "" : "es") +
      " · " + periodTxt + " · " + regionTxt + updatedTxt;

    rows.forEach(function (d) {
      var card = document.createElement("button");
      card.className = "deal-card";
      var pill = function (txt, cls) { return txt ? '<span class="deal-pill' + (cls ? " " + cls : "") + '">' + esc(txt) + "</span>" : ""; };
      card.innerHTML =
        '<div class="deal-top">' +
          '<span class="deal-date">' + fmtDate(d.date) + (d.approxDate ? " ≈" : "") + "</span>" +
          '<span class="deal-region">' + (REGION_LABEL[d.region] || esc(d.region)) + "</span>" +
        "</div>" +
        '<div class="deal-title">' + dealTitleHtml(d) + "</div>" +
        '<div class="deal-sub">' +
          pill(d.sector) +
          pill(d.country) +
          pill(d.value, "deal-value") +
        "</div>";
      card.addEventListener("click", function () { openSheet(d); });
      dealList.appendChild(card);
    });
  }

  // ---- Detail sheet ----
  function openSheet(d) {
    sheetBody.innerHTML =
      "<h2>" + dealTitleHtml(d) + "</h2>" +
      '<div class="sheet-meta">Radar · ' + (REGION_LABEL[d.region] || esc(d.region)) + "</div>" +
      '<p class="sheet-summary">' + esc(d.summary) + "</p>" +
      row("Fecha", fmtDate(d.date) + (d.approxDate ? ' <span class="approx">(aprox.)</span>' : "")) +
      (d.acquirer ? row("Adquirente", esc(d.acquirer)) : "") +
      (d.target ? row("Objetivo", esc(d.target)) : "") +
      row("País", esc(d.country)) +
      row("Sector", esc(d.sector) || "—") +
      row("Monto", esc(d.value) || "No divulgado") +
      row("Fuente", esc(d.source)) +
      '<a class="sheet-cta" href="' + esc(safeUrl(d.url)) + '" target="_blank" rel="noopener">Abrir fuente / noticia ↗</a>' +
      '<p class="sheet-note">Oportunidad potencial de PPA. Verifica el cierre de la operación antes de prospectar.</p>';
    sheetBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function row(k, v) {
    return '<div class="sheet-row"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>";
  }
  function closeSheet() {
    sheetBackdrop.hidden = true;
    document.body.style.overflow = "";
  }

  // ---- Events ----
  var PARENT = { deals: "home", ibr: "home" };
  backBtn.addEventListener("click", function () { show(PARENT[state.screen] || "home"); });

  document.getElementById("goIbr").addEventListener("click", function () {
    show("ibr");
    renderIBR();
  });
  document.getElementById("goDeals").addEventListener("click", function () {
    show("deals");
    renderDeals();
  });

  // ---- Informe IB ----
  function renderIBR() {
    var data = state.ibr;
    ibrGroups.innerHTML = "";
    if (!data || !data.transactions || !data.transactions.length) {
      ibrEmpty.hidden = false;
      ibrSub.textContent = "Transacciones del Investment Banking Report (Landmark + DF).";
      return;
    }
    ibrEmpty.hidden = true;
    ibrSub.textContent = (data.month || "") + " · " + data.transactions.length + " transacciones · Landmark + DF";
    ibrReportLink.href = safeUrl(data.reportUrl);

    var groups = [
      { label: "Anunciadas", rows: data.transactions.filter(function (t) { return t.status === "Anunciada"; }) },
      { label: "Completadas", rows: data.transactions.filter(function (t) { return t.status !== "Anunciada"; }) }
    ];
    groups.forEach(function (g) {
      if (!g.rows.length) return;
      var h = document.createElement("div");
      h.className = "ibr-group-head";
      h.textContent = g.label + " (" + g.rows.length + ")";
      ibrGroups.appendChild(h);
      var list = document.createElement("div");
      list.className = "deal-list";
      g.rows.forEach(function (t) {
        var card = document.createElement("button");
        card.className = "deal-card";
        var pill = function (txt, cls) { return txt ? '<span class="deal-pill' + (cls ? " " + cls : "") + '">' + esc(txt) + "</span>" : ""; };
        var when = t.date ? fmtDate(t.date) : "Anunciada";
        card.innerHTML =
          '<div class="deal-top">' +
            '<span class="deal-date">' + esc(when) + "</span>" +
            '<span class="deal-region ' + (t.status === "Anunciada" ? "is-announced" : "is-done") + '">' + esc(t.status) + "</span>" +
          "</div>" +
          '<div class="deal-title">' + esc(t.acquirer) + ' <span class="arrow">→</span> ' + esc(t.target) + "</div>" +
          '<div class="deal-sub">' + pill(t.sector) + pill(t.value, "deal-value") + "</div>";
        card.addEventListener("click", function () { openIbrSheet(t, data); });
        list.appendChild(card);
      });
      ibrGroups.appendChild(list);
    });
  }

  function openIbrSheet(t, data) {
    sheetBody.innerHTML =
      "<h2>" + esc(t.acquirer) + ' <span class="arrow">→</span> ' + esc(t.target) + "</h2>" +
      '<div class="sheet-meta">Informe IB · ' + esc(data.month || "") + " · " + esc(t.status) + "</div>" +
      '<p class="sheet-summary">' + esc(t.summary) + "</p>" +
      (t.date ? row("Fecha", fmtDate(t.date)) : row("Estado", "Anunciada (aún no cerrada)")) +
      row("Comprador", esc(t.acquirer)) +
      row("Activo adquirido", esc(t.target)) +
      row("Vendedor", esc(t.seller) || "—") +
      row("Monto", esc(t.value) || "No divulgado") +
      row("Sector", esc(t.sector) || "—") +
      '<a class="sheet-cta" href="' + esc(safeUrl(data.reportUrl)) + '" target="_blank" rel="noopener">Ver reporte oficial ↗</a>' +
      '<p class="sheet-note">Fuente: Investment Banking Report (Landmark + Diario Financiero). Oportunidad potencial de PPA.</p>';
    sheetBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
  }

  periodFilter.addEventListener("click", function (e) {
    var b = e.target.closest(".chip");
    if (!b) return;
    state.period = parseInt(b.getAttribute("data-period"), 10);
    periodFilter.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-on"); });
    b.classList.add("is-on");
    renderDeals();
  });

  regionFilter.addEventListener("change", function () {
    state.region = regionFilter.value;
    renderDeals();
  });

  document.getElementById("sheetClose").addEventListener("click", closeSheet);
  sheetBackdrop.addEventListener("click", function (e) {
    if (e.target === sheetBackdrop) closeSheet();
  });

  // ---- Load data ----
  fetch("deals.json", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.deals = data.deals || [];
      state.generatedAt = data.generatedAt || "";
      goDealsSub.textContent = state.deals.length + " operaciones" +
        (state.generatedAt ? " · actualizado " + fmtDate(state.generatedAt) : "");
      if (state.screen === "deals") renderDeals();   // refresh if data arrived after navigating
    })
    .catch(function () { state.deals = []; });

  fetch("ibr.json", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.ibr = data;
      renderHome();
      if (state.screen === "ibr") renderIBR();
    })
    .catch(function () { state.ibr = null; homeEmpty.hidden = false; });

  // Optional deep-link: #ibr opens the Informe IB screen directly.
  if (location.hash === "#ibr") {
    show("ibr");
    renderIBR();
  }

  // Optional deep-link: #ppa opens the news radar. #ppa-3 / #ppa-7 also preset the period.
  if (location.hash.indexOf("#ppa") === 0) {
    var p = parseInt(location.hash.split("-")[1], 10);
    if (p === 1 || p === 3 || p === 7) {
      state.period = p;
      periodFilter.querySelectorAll(".chip").forEach(function (c) {
        c.classList.toggle("is-on", parseInt(c.getAttribute("data-period"), 10) === p);
      });
    }
    show("deals");
    renderDeals();
  }

  // ---- PWA service worker ----
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
