(function () {
  "use strict";

  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Mains shown as regular sections; only condiments + milk fold away.
  var BREAKFAST_MAINS = [
    ["Entr\u00e9e", "entree"],
    ["Daily Serve", "daily_serve"],
    ["Fruit", "fruit"]
  ];
  var LUNCH_MAINS = [
    ["Entr\u00e9e", "entree"],
    ["Daily Serve Entr\u00e9e", "daily_serve"],
    ["Express", "express"],
    ["Vegetable", "vegetable"],
    ["Fruit", "fruit"]
  ];
  var EXTRAS = [
    ["Condiments", "condiments"],
    ["Milk", "milk"]
  ];

  var data = null;
  // Every fresh load opens on Day view showing today. The toggle works
  // within the session, but the view is never restored from storage.
  var view = "day";
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

  function isWeekday(d) {
    return !isWeekend(d);
  }

  // Step one calendar day, skipping Sat/Sun entirely: Friday -> Monday,
  // Monday -> Friday.
  function stepDay(d, dir) {
    var out = addDays(d, dir);
    while (isWeekend(out)) out = addDays(out, dir);
    return out;
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

  // Normalize an entry to the current per-station shape. Tolerates the
  // older flat schema (breakfast / lunch_entree / lunch_express arrays)
  // in case a stale data.json is served.
  function normalizeEntry(entry) {
    if (!entry) return null;
    if (Array.isArray(entry.breakfast) || Array.isArray(entry.lunch_entree)) {
      return {
        breakfast: {
          entree: entry.breakfast || [],
          daily_serve: [],
          fruit: [],
          condiments: [],
          milk: []
        },
        lunch: {
          entree: entry.lunch_entree || [],
          daily_serve: [],
          express: entry.lunch_express || [],
          vegetable: [],
          fruit: [],
          condiments: [],
          milk: []
        }
      };
    }
    return entry;
  }

  function stationItems(meal, key) {
    if (!meal || !Array.isArray(meal[key])) return [];
    return meal[key];
  }

  function mealIsEmpty(meal, sections) {
    if (!meal) return true;
    for (var i = 0; i < sections.length; i++) {
      if (stationItems(meal, sections[i][1]).length) return false;
    }
    return true;
  }

  function dayIsEmpty(entry) {
    if (!entry) return true;
    var all = BREAKFAST_MAINS.concat(LUNCH_MAINS).concat(EXTRAS);
    var b = entry.breakfast || {};
    var l = entry.lunch || {};
    return mealIsEmpty(b, all) && mealIsEmpty(l, all);
  }

  function extrasHTML(meal) {
    var inner = "";
    EXTRAS.forEach(function (sec) {
      var items = stationItems(meal, sec[1]);
      if (!items.length) return;
      inner += '<div class="subheading">' + escapeHTML(sec[0]) + "</div>" +
        mealList(items);
    });
    if (!inner) return "";
    return '<details class="extras"><summary>Condiments &amp; milk</summary>' +
      inner + "</details>";
  }

  function mealCards(entry) {
    var b = entry.breakfast || {};
    var l = entry.lunch || {};
    var html = '<div class="card"><div class="card-title">\uD83E\uDD5E Breakfast</div>';
    BREAKFAST_MAINS.forEach(function (sec) {
      html += '<div class="subheading">' + escapeHTML(sec[0]) + "</div>" +
        mealList(stationItems(b, sec[1]));
    });
    html += extrasHTML(b) + "</div>";

    html += '<div class="card"><div class="card-title">\uD83C\uDF4E Lunch</div>';
    LUNCH_MAINS.forEach(function (sec) {
      html += '<div class="subheading">' + escapeHTML(sec[0]) + "</div>" +
        mealList(stationItems(l, sec[1]));
    });
    html += extrasHTML(l) + "</div>";
    return html;
  }

  function noSchoolCard() {
    return '<div class="card"><div class="card-title">\uD83C\uDF7D\uFE0F Meals</div>' +
      '<p class="muted">No school</p></div>';
  }

  function renderDay() {
    dateLabelEl.textContent = longDate(selected);
    if (isWeekend(selected)) {
      // Fallback only: the day arrows skip weekends, so this is reached
      // only if the selected date lands on a weekend some other way.
      contentEl.innerHTML =
        '<div class="card"><div class="card-title">\uD83C\uDF7D\uFE0F Meals</div>' +
        '<p class="muted">Weekend \u2014 no school.</p></div>';
      return;
    }
    var entry = normalizeEntry(dayEntry(selected));
    if (!entry || dayIsEmpty(entry)) {
      contentEl.innerHTML = noSchoolCard();
      return;
    }
    contentEl.innerHTML = mealCards(entry);
  }

  function mondayOf(d) {
    return addDays(d, -((d.getDay() + 6) % 7));
  }

  function dayCardHTML(d) {
    var dISO = iso(d);
    var todayISO = iso(startOfDay(new Date()));
    var isToday = dISO === todayISO;
    var entry = normalizeEntry(dayEntry(d));
    var html = '<div class="card' + (isToday ? " today" : "") + '">' +
      '<div class="day-heading">' + escapeHTML(shortDate(d)) +
      (isToday ? '<span class="today-tag">Today</span>' : "") + "</div>";
    if (!entry || dayIsEmpty(entry)) {
      html += '<p class="muted">No school</p>';
    } else {
      html += mealCards(entry);
    }
    return html + "</div>";
  }

  function renderWeek() {
    var monday = mondayOf(selected);
    var friday = addDays(monday, 4);
    weekLabelEl.textContent =
      MONTHS_SHORT[monday.getMonth()] + " " + monday.getDate() +
      " \u2013 " + MONTHS_SHORT[friday.getMonth()] + " " + friday.getDate();
    var today = startOfDay(new Date());
    var isCurrentWeek = iso(mondayOf(today)) === iso(monday);
    // Anchor for "the rest of this week": today on weekdays; next Monday
    // on weekends (the current week is over, so next week is the one
    // that matters).
    var anchor = today;
    if (isCurrentWeek && isWeekend(today)) anchor = addDays(monday, 7);
    var html = "";
    var earlier = "";
    for (var i = 0; i < 5; i++) {
      var d = addDays(monday, i);
      if (isCurrentWeek && d < anchor) {
        earlier += dayCardHTML(d);
      } else {
        html += dayCardHTML(d);
      }
    }
    if (earlier) {
      html += '<details class="earlier"><summary>Earlier this week</summary>' +
        earlier + "</details>";
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
    // Week view always opens at today.
    if (v === "week") selected = startOfDay(new Date());
    render();
  }

  tabDay.addEventListener("click", function () { setView("day"); });
  tabWeek.addEventListener("click", function () { setView("week"); });
  document.getElementById("prev-day").addEventListener("click", function () {
    selected = stepDay(selected, -1);
    render();
  });
  document.getElementById("next-day").addEventListener("click", function () {
    selected = stepDay(selected, 1);
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
        '<div class="card"><div class="card-title">\uD83C\uDF7D\uFE0F Meals</div>' +
        '<p class="muted">Menu data couldn&rsquo;t be loaded. Check your connection and try again.</p></div>';
    });

  render();
})();
