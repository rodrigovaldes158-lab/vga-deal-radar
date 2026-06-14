/* =============================================================
   VGA — Deal Radar · app logic
   Vanilla JS, no build step.
   ============================================================= */
(function () {
  "use strict";

  var REGION_LABEL = { CL: "Chile", LATAM: "Latinoamérica", US: "EE.UU.", GLOBAL: "Global" };
  var MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

  var state = { deals: [], period: 1, region: "ALL", service: null, screen: "services", generatedAt: "" };

  // ---- DOM refs ----
  var screens = {
    services: document.getElementById("screen-services"),
    deals: document.getElementById("screen-deals")
  };
  var backBtn = document.getElementById("backBtn");
  var dealList = document.getElementById("dealList");
  var emptyState = document.getElementById("emptyState");
  var resultMeta = document.getElementById("resultMeta");
  var regionFilter = document.getElementById("regionFilter");
  var periodFilter = document.getElementById("periodFilter");
  var sheetBackdrop = document.getElementById("sheetBackdrop");
  var sheetBody = document.getElementById("sheetBody");

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

  backBtn.addEventListener("click", function () { show("services"); });

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
