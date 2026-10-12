/* =============================================================
   VGA — Deal Radar · app logic
   Vanilla JS, no build step.
   ============================================================= */
(function () {
  "use strict";

  var REGION_LABEL = { CL: "Chile", LATAM: "Latinoamérica", US: "EE.UU.", GLOBAL: "Global" };
  var MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

  var state = { deals: [], period: 1, region: "ALL", service: null, screen: "services", generatedAt: "", ibr: null };

  // ---- DOM refs ----
  var screens = {
    services: document.getElementById("screen-services"),
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

  // ---- Navigation ----
  function show(name) {
    state.screen = name;
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle("is-active", k === name);
    });
    backBtn.hidden = name === "services";
    window.scrollTo(0, 0);
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
      '<div class="sheet-meta">PPA · ' + (REGION_LABEL[d.region] || esc(d.region)) + "</div>" +
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
  document.querySelectorAll(".svc-card[data-service]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.service = b.getAttribute("data-service");
      show("deals");
      renderDeals();
    });
  });

  var PARENT = { deals: "services", ibr: "deals" };
  backBtn.addEventListener("click", function () { show(PARENT[state.screen] || "services"); });

  // ---- Informe IB ----
  document.getElementById("ibrBtn").addEventListener("click", function () {
    show("ibr");
    renderIBR();
  });

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
      if (state.screen === "deals") renderDeals();   // refresh if data arrived after navigating
    })
    .catch(function () { state.deals = []; });

  fetch("ibr.json", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.ibr = data;
      if (state.screen === "ibr") renderIBR();
    })
    .catch(function () { state.ibr = null; });

  // Optional deep-link: #ibr opens the Informe IB screen directly.
  if (location.hash === "#ibr") {
    show("ibr");
    renderIBR();
  }

  // Optional deep-link: #ppa opens the PPA list. #ppa-3 / #ppa-7 also preset the period.
  if (location.hash.indexOf("#ppa") === 0) {
    var p = parseInt(location.hash.split("-")[1], 10);
    if (p === 1 || p === 3 || p === 7) {
      state.period = p;
      periodFilter.querySelectorAll(".chip").forEach(function (c) {
        c.classList.toggle("is-on", parseInt(c.getAttribute("data-period"), 10) === p);
      });
    }
    state.service = "PPA";
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
