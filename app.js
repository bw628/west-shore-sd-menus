(function () {
  "use strict";

  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var data = null;
  var view = localStorage.getItem("msp-view") || "day";
  var selected = startOfDay(new Date());

  var contentEl = document.getElementById("content");
  var dateLabelEl = document.getElementById("date-label");
  var weekLabelEl = document.getElementById("week-label");
  var daynavEl = document.getElementById("daynav");
  var weeknavEl = document.getElementById("weeknav");
  var tabDay = document.getElementById("tab-day");
  var tabWeek = document.getElementById("tab-week");
  var footerEl = document.getElementById("footer");

  function pad2(n) { return String(n).padStart(2, "0"); }

  function iso(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function parseISO(s) {
    var parts = s.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    var out = new Date(d);
    out.setDate(out.getDate() + n);
    return out;
  }

  function isWeekend(d) {
    var g = d.getDay();
    return g === 0 || g === 6;
  }

  function longDate(d) {
    return WEEKDAYS[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate();
  }

  function shortDate(d) {
    return WEEKDAYS_SHORT[d.getDay()] + ", " + MONTHS_SHORT[d.getMonth()] + " " + d.getDate();
  }

  function escapeHTML(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function mealList(items) {
    if (!items || !items.length) {
      return '<p class="muted">N/A</p>';
    }
    return "<ul>" + items.map(function (x) {
      return "<li>" + escapeHTML(x) + "</li>";
    }).join("") + "</ul>";
  }

  function dayEntry(d) {
    if (!data || !data.days) return null;
    return data.days[iso(d)] || null;
  }

  function dayIsEmpty(entry) {
    return !entry ||
      ((!entry.breakfast || !entry.breakfast.length) &&
       (!entry.lunch_entree || !entry.lunch_entree.length) &&
       (!entry.lunch_express || !entry.lunch_express.length));
  }

  function mealCards(entry) {
    return (
      '<div class="card"><div class="card-title">🥞 Breakfast</div>' +
      mealList(entry.breakfast) +
      "</div>" +
      '<div class="card"><div class="card-title">🍎 Lunch</div>' +
      '<div class="subheading">Entrée</div>' +
      mealList(entry.lunch_entree) +
      '<div class="subheading">Express</div>' +
      mealList(entry.lunch_express) +
      "</div>"
    );
  }

  function renderDay() {
    dateLabelEl.textContent = longDate(selected);
    if (isWeekend(selected)) {
      contentEl.innerHTML =
        '<div class="card"><div class="card-title">🍽️ Meals</div>' +
        '<p class="muted">Weekend — no school.</p></div>';
      return;
    }
    var entry = dayEntry(selected);
    if (!entry) {
      contentEl.innerHTML =
        '<div class="card"><div class="card-title">🍽️ Meals</div>' +
        '<p class="muted">Menu not loaded for this date yet. Check back soon — the menu refreshes every weekday morning.</p></div>';
      return;
    }
    if (dayIsEmpty(entry)) {
      contentEl.innerHTML =
        '<div class="card"><div class="card-title">🍽️ Meals</div>' +
        '<p class="muted">No menu posted for this day.</p></div>';
      return;
    }
    contentEl.innerHTML = mealCards(entry);
  }

  function mondayOf(d) {
    return addDays(d, -((d.getDay() + 6) % 7));
  }

  function renderWeek() {
    var monday = mondayOf(selected);
    var friday = addDays(monday, 4);
    weekLabelEl.textContent =
      MONTHS_SHORT[monday.getMonth()] + " " + monday.getDate() +
      " – " + MONTHS_SHORT[friday.getMonth()] + " " + friday.getDate();
    var todayISO = iso(startOfDay(new Date()));
    var html = "";
    for (var i = 0; i < 5; i++) {
      var d = addDays(monday, i);
      var dISO = iso(d);
      var isToday = dISO === todayISO;
      var entry = dayEntry(d);
      html += '<div class="card' + (isToday ? " today" : "") + '">' +
        '<div class="day-heading">' + escapeHTML(shortDate(d)) +
        (isToday ? '<span class="today-tag">Today</span>' : "") + "</div>";
      if (!entry || dayIsEmpty(entry)) {
        html += '<p class="muted">No menu posted.</p>';
      } else {
        html += '<div class="subheading">Breakfast</div>' + mealList(entry.breakfast);
        html += '<div class="subheading">Lunch — Entrée</div>' + mealList(entry.lunch_entree);
        html += '<div class="subheading">Lunch — Express</div>' + mealList(entry.lunch_express);
      }
      html += "</div>";
    }
    contentEl.innerHTML = html;
  }

  function render() {
    tabDay.classList.toggle("active", view === "day");
    tabWeek.classList.toggle("active", view === "week");
    tabDay.setAttribute("aria-selected", view === "day" ? "true" : "false");
    tabWeek.setAttribute("aria-selected", view === "week" ? "true" : "false");
    daynavEl.hidden = view !== "day";
    weeknavEl.hidden = view !== "week";
    if (view === "day") renderDay();
    else renderWeek();
  }

  function setView(v) {
    view = v;
    try { localStorage.setItem("msp-view", v); } catch (e) {}
    render();
  }

  tabDay.addEventListener("click", function () { setView("day"); });
  tabWeek.addEventListener("click", function () { setView("week"); });
  document.getElementById("prev-day").addEventListener("click", function () {
    selected = addDays(selected, -1);
    render();
  });
  document.getElementById("next-day").addEventListener("click", function () {
    selected = addDays(selected, 1);
    render();
  });
  document.getElementById("today-btn").addEventListener("click", function () {
    selected = startOfDay(new Date());
    render();
  });
  document.getElementById("prev-week").addEventListener("click", function () {
    selected = addDays(selected, -7);
    render();
  });
  document.getElementById("next-week").addEventListener("click", function () {
    selected = addDays(selected, 7);
    render();
  });

  function formatUpdated(isoStr) {
    if (!isoStr) return "";
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    return MONTHS_SHORT[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  fetch("data.json", { cache: "no-store" })
    .then(function (resp) {
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return resp.json();
    })
    .then(function (json) {
      data = json;
      var updated = formatUpdated(data.generated_at);
      footerEl.innerHTML = updated
        ? "Menu updated " + escapeHTML(updated) +
          " &middot; Menus via <a href=\"https://www.nutrislice.com/\" rel=\"noopener\">Nutrislice</a>"
        : "Menus via Nutrislice";
      render();
    })
    .catch(function () {
      contentEl.innerHTML =
        '<div class="card"><div class="card-title">🍽️ Meals</div>' +
        '<p class="muted">Menu data couldn&rsquo;t be loaded. Check your connection and try again.</p></div>';
    });

  render();
})();
