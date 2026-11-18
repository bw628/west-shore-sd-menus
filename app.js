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
  var menuRequest = 0;

  // User preferences, persisted in localStorage. Both default ON.
  function readPref(key, def) {
    try {
      var v = localStorage.getItem(key);
      if (v === null) return def;
      return v === "1";
    } catch (e) { return def; }
  }
  function writePref(key, val) {
    try { localStorage.setItem(key, val ? "1" : "0"); } catch (e) {}
  }
  var lunchFirst = readPref("msp-lunch-first", true);
  var after6Tomorrow = readPref("msp-after6-tomorrow", true);

  // District schools, verified live against the Nutrislice schools
  // endpoint. Highland first: it is the default. Names are the
  // official Nutrislice names (the district's schools are "Primary"
  // and "Intermediate" schools).
  var SCHOOLS = [
    ["highland-elementary", "Highland Primary School"],
    ["cedar-cliff-high-school", "Cedar Cliff High School"],
    ["crossroads-middle-school", "Crossroads Middle School"],
    ["fairview-intermediate", "Fairview Intermediate School"],
    ["fishing-creek-elementary", "Fishing Creek Primary School"],
    ["hillside-elementary", "Hillside Primary School"],
    ["newberry-elementary", "Newberry Primary School"],
    ["new-cumberland-middle-school", "New Cumberland Middle School"],
    ["old-trail-intermediate", "Old Trail Intermediate School"],
    ["red-land-high-school", "Red Land High School"],
    ["redmill-elementary", "Red Mill Primary School"],
    ["rossmoyne-elementary", "Rossmoyne Primary School"],
    ["washington-heights-elementary", "Washington Heights Primary School"]
  ];
  var DEFAULT_SCHOOL = "highland-elementary";

  function readStringPref(key, def) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? def : v;
    } catch (e) { return def; }
  }
  function writeStringPref(key, val) {
    try { localStorage.setItem(key, val); } catch (e) {}
  }
  function schoolName(slug) {
    for (var i = 0; i < SCHOOLS.length; i++) {
      if (SCHOOLS[i][0] === slug) return SCHOOLS[i][1];
    }
    return SCHOOLS[0][1];
  }
  function validSchool(slug) {
    for (var i = 0; i < SCHOOLS.length; i++) {
      if (SCHOOLS[i][0] === slug) return true;
    }
    return false;
  }

  // Each device keeps its own school (localStorage). The pick is
  // per-phone, so other parents sharing the app see their own school,
  // not Ben's. A saved slug that is no longer in the list falls back
  // to Highland.
  var school = readStringPref("msp-school", DEFAULT_SCHOOL);
  if (!validSchool(school)) school = DEFAULT_SCHOOL;

  // Every fresh load opens on Day view showing today. The toggle works
  // within the session, but the view is never restored from storage.
  var view = "day";

  // Landing day for a fresh load: today, or the next school day when the
  // "after 6 PM, open tomorrow" setting is on and it is 6 PM or later.
  function landingDay() {
    var now = new Date();
    var today = startOfDay(now);
    if (after6Tomorrow && now.getHours() >= 18) return stepDay(today, 1);
    return today;
  }

  var selected = landingDay();

  var contentEl = document.getElementById("content");
  var dateLabelEl = document.getElementById("date-label");
  var todayBtnEl = document.getElementById("today-btn");
  var weekLabelEl = document.getElementById("week-label");
  var daynavEl = document.getElementById("daynav");
  var weeknavEl = document.getElementById("weeknav");
  var tabDay = document.getElementById("tab-day");
  var tabWeek = document.getElementById("tab-week");
  var searchBtnEl = document.getElementById("search-btn");
  var searchnavEl = document.getElementById("searchnav");
  var searchInputEl = document.getElementById("search-input");
  var searchSuggestEl = document.getElementById("search-suggest");
  var searchClearEl = document.getElementById("search-clear");
  var schoolBtnEl = document.getElementById("school-btn");
  var schoolSheetEl = document.getElementById("school-sheet");
  var schoolBackdropEl = document.getElementById("school-backdrop");
  var schoolListEl = document.getElementById("school-list");
  var schoolCloseEl = document.getElementById("school-close");
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
    return '<ul class="meal-list" role="list">' + items.map(function (x) {
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

  function mealCard(meal, title, sections) {
    var html = '<section class="card meal-card"><h2 class="card-title meal-title">' +
      title + '</h2><div class="meal-stations">';
    sections.forEach(function (section) {
      html += '<div class="meal-station station-' + section[1] + '">' +
        '<h3 class="subheading">' + escapeHTML(section[0]) + '</h3>' +
        mealList(stationItems(meal, section[1])) + '</div>';
    });
    return html + '</div>' + extrasHTML(meal) + '</section>';
  }

  // Keep the saved meal-order preference in both views.
  function mealCards(entry) {
    var breakfast = mealCard(entry.breakfast, "Breakfast", BREAKFAST_MAINS);
    var lunch = mealCard(entry.lunch, "Lunch", LUNCH_MAINS);
    return lunchFirst ? lunch + breakfast : breakfast + lunch;
  }

  function noSchoolCard() {
    return '<div class="card"><div class="card-title">Meals</div>' +
      '<p class="muted">No school</p></div>';
  }

  function renderDay() {
    dateLabelEl.textContent = longDate(selected);
    todayBtnEl.setAttribute("aria-current",
      iso(selected) === iso(new Date()) ? "date" : "false");
    if (isWeekend(selected)) {
      // Fallback only: the day arrows skip weekends, so this is reached
      // only if the selected date lands on a weekend some other way.
      contentEl.innerHTML =
        '<div class="card"><div class="card-title">Meals</div>' +
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
    var html = '<div class="card week-card' + (isToday ? " today" : "") + '">' +
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
    if (searchBtnEl) {
      searchBtnEl.classList.toggle("active", view === "search");
      searchBtnEl.setAttribute("aria-expanded", view === "search" ? "true" : "false");
    }
    daynavEl.hidden = view !== "day";
    weeknavEl.hidden = view !== "week";
    searchnavEl.hidden = view !== "search";
    if (view !== "search") hideSuggest();
    if (view === "day") renderDay();
    else if (view === "week") renderWeek();
    else renderSearch();
  }

  function setView(v) {
    view = v;
    // Week view always opens at today.
    if (v === "week") selected = startOfDay(new Date());
    render();
  }

  tabDay.addEventListener("click", function () { setView("day"); });
  tabWeek.addEventListener("click", function () { setView("week"); });
  // The magnifier button in the header opens the search view; tapping
  // it again closes search and goes back to Day view. Day/Week tabs
  // close search too, since setView changes the view.
  if (searchBtnEl) {
    searchBtnEl.addEventListener("click", function () {
      if (view === "search") {
        setView("day");
      } else {
        setView("search");
        if (searchInputEl) searchInputEl.focus();
      }
    });
  }
  document.getElementById("prev-day").addEventListener("click", function () {
    selected = stepDay(selected, -1);
    render();
  });
  document.getElementById("next-day").addEventListener("click", function () {
    selected = stepDay(selected, 1);
    render();
  });
  todayBtnEl.addEventListener("click", function () {
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

  // --- Food search ---
  // The autocomplete list is every distinct item name in the loaded
  // data.json, across every day, meal, and station. Favorites are not
  // involved: search is per-device and nothing leaves the phone.
  var allItems = [];
  var searchItem = null; // currently selected item name, or null

  function buildItemList() {
    var seen = {};
    var list = [];
    if (!data || !data.days) { allItems = []; return; }
    Object.keys(data.days).forEach(function (dISO) {
      var entry = normalizeEntry(data.days[dISO]);
      if (!entry) return;
      ["breakfast", "lunch"].forEach(function (mealKey) {
        var meal = entry[mealKey] || {};
        Object.keys(meal).forEach(function (station) {
          (meal[station] || []).forEach(function (name) {
            if (name && !seen[name]) { seen[name] = true; list.push(name); }
          });
        });
      });
    });
    list.sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    allItems = list;
  }

  // Case-insensitive substring match, alphabetical (allItems is sorted).
  function matchItems(q) {
    var needle = String(q || "").trim().toLowerCase();
    if (!needle) return [];
    return allItems.filter(function (name) {
      return name.toLowerCase().indexOf(needle) !== -1;
    });
  }

  function hideSuggest() {
    if (searchSuggestEl) searchSuggestEl.hidden = true;
  }

  // The × button shows only while the search box has text.
  function updateClearBtn() {
    if (searchClearEl) {
      searchClearEl.hidden = !(searchInputEl && searchInputEl.value);
    }
  }

  // Empty the box, drop the results, and hand focus back to the input
  // so the keyboard stays up for the next search.
  function clearSearch() {
    if (searchInputEl) searchInputEl.value = "";
    searchItem = null;
    hideSuggest();
    updateClearBtn();
    renderSearch();
    if (searchInputEl) searchInputEl.focus();
  }

  function showSuggest(matches) {
    if (!searchSuggestEl) return;
    if (!matches.length) { hideSuggest(); return; }
    searchSuggestEl.innerHTML = matches.slice(0, 8).map(function (name) {
      return '<button type="button" class="suggest-item" data-item="' +
        escapeHTML(name) + '">' + escapeHTML(name) + "</button>";
    }).join("");
    searchSuggestEl.hidden = false;
  }

  function selectSearchItem(name) {
    searchItem = name;
    if (searchInputEl) searchInputEl.value = name;
    hideSuggest();
    updateClearBtn();
    renderSearch();
  }

  // Future dates (today onward) on which `item` appears, split by meal.
  // An item can appear in both meals on the same date; it is listed
  // under both.
  function itemDates(item) {
    var out = { breakfast: [], lunch: [] };
    if (!data || !data.days || !item) return out;
    var todayISO = iso(startOfDay(new Date()));
    Object.keys(data.days).sort().forEach(function (dISO) {
      if (dISO < todayISO) return;
      var entry = normalizeEntry(data.days[dISO]);
      if (!entry) return;
      ["breakfast", "lunch"].forEach(function (mealKey) {
        var meal = entry[mealKey] || {};
        var found = Object.keys(meal).some(function (station) {
          return (meal[station] || []).indexOf(item) !== -1;
        });
        if (found) out[mealKey].push(parseISO(dISO));
      });
    });
    return out;
  }

  function lastLoadedISO() {
    if (!data || !data.days) return null;
    var keys = Object.keys(data.days).sort();
    return keys.length ? keys[keys.length - 1] : null;
  }

  // Walk up from a clicked node looking for a data-* attribute.
  function closestData(el, key) {
    while (el) {
      if (el.dataset && el.dataset[key]) return el.dataset[key];
      el = el.parentNode;
    }
    return null;
  }

  // Month grid for the current month. Today gets one treatment (accent
  // outline), days featuring the item another (filled background); a day
  // that is both gets both. Only loaded weekdays are tappable — tapping
  // one jumps to that day in Day view.
  function calendarHTML(dates) {
    var today = startOfDay(new Date());
    var year = today.getFullYear();
    var month = today.getMonth();
    var first = new Date(year, month, 1);
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var todayISO = iso(today);
    var itemSet = {};
    dates.breakfast.concat(dates.lunch).forEach(function (d) {
      itemSet[iso(d)] = true;
    });
    var loadedSet = {};
    if (data && data.days) {
      Object.keys(data.days).forEach(function (k) { loadedSet[k] = true; });
    }
    var heads = ["S", "M", "T", "W", "T", "F", "S"].map(function (h) {
      return '<span class="cal-head">' + h + "</span>";
    }).join("");
    var cells = "";
    var i, day;
    for (i = 0; i < first.getDay(); i++) {
      cells += '<span class="cal-day blank"></span>';
    }
    for (day = 1; day <= daysInMonth; day++) {
      var d = new Date(year, month, day);
      var dISO = iso(d);
      var cls = "cal-day";
      if (dISO === todayISO) cls += " today";
      if (itemSet[dISO]) cls += " item";
      if (d < today) cls += " past";
      if (loadedSet[dISO] && !isWeekend(d)) {
        cells += '<button type="button" class="' + cls +
          '" data-goto="' + dISO + '">' + day + "</button>";
      } else {
        cells += '<span class="' + cls + '">' + day + "</span>";
      }
    }
    return '<div class="card"><div class="card-title">' +
      escapeHTML(MONTHS[month] + " " + year) + "</div>" +
      '<div class="cal">' + heads + cells + "</div>" +
      '<p class="cal-legend"><span class="cal-key today"></span> Today' +
      " &nbsp; <span class=\"cal-key item\"></span> On the menu</p></div>";
  }

  function dateListHTML(dates, mealLabel) {
    if (!dates.length) {
      return '<p class="muted">Not coming up for ' +
        escapeHTML(mealLabel.toLowerCase()) + ".</p>";
    }
    return '<ul class="result-list">' + dates.map(function (d) {
      return '<li><button type="button" class="result-date" data-goto="' +
        iso(d) + '">' + escapeHTML(shortDate(d)) +
        ' <span class="result-chev">\u203A</span></button></li>';
    }).join("") + "</ul>";
  }

  function renderSearch() {
    if (!data) {
      contentEl.innerHTML =
        '<div class="card"><p class="muted">Loading menu&hellip;</p></div>';
      return;
    }
    if (!searchItem) {
      contentEl.innerHTML =
        '<div class="card"><div class="card-title">Food search</div>' +
        "<p class=\"muted\">Type a food above to see the days it&rsquo;s on " +
        "the menu &mdash; breakfast and lunch separately.</p></div>";
      return;
    }
    var dates = itemDates(searchItem);
    var last = lastLoadedISO();
    var html = calendarHTML(dates);
    html += '<div class="card"><div class="card-title">' +
      escapeHTML(searchItem) + "</div>";
    if (!dates.breakfast.length && !dates.lunch.length) {
      html += '<p class="muted">Not on the menu in the loaded menus.</p>';
    } else {
      html += '<div class="subheading">Breakfast</div>' +
        dateListHTML(dates.breakfast, "Breakfast");
      html += '<div class="subheading">Lunch</div>' +
        dateListHTML(dates.lunch, "Lunch");
    }
    if (last) {
      html += '<p class="muted">Menus loaded through ' +
        escapeHTML(longDate(parseISO(last))) + ".</p>";
    }
    html += "</div>";
    contentEl.innerHTML = html;
  }

  if (searchInputEl) {
    searchInputEl.addEventListener("input", function () {
      updateClearBtn();
      var q = searchInputEl.value;
      if (!String(q).trim()) {
        searchItem = null;
        hideSuggest();
        renderSearch();
        return;
      }
      showSuggest(matchItems(q));
    });
    searchInputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var matches = matchItems(searchInputEl.value);
        if (matches.length) selectSearchItem(matches[0]);
      } else if (e.key === "Escape") {
        hideSuggest();
      }
    });
    // Hide suggestions shortly after blur so a tap on a suggestion
    // still lands before the list disappears.
    searchInputEl.addEventListener("blur", function () {
      setTimeout(hideSuggest, 150);
    });
  }

  if (searchClearEl) {
    searchClearEl.addEventListener("click", function () { clearSearch(); });
  }

  if (searchSuggestEl) {
    searchSuggestEl.addEventListener("click", function (e) {
      var name = closestData(e.target, "item");
      if (name) selectSearchItem(name);
    });
  }

  // Tapping a date in the search results or calendar jumps to that day
  // in Day view.
  contentEl.addEventListener("click", function (e) {
    var dISO = closestData(e.target, "goto");
    if (dISO) {
      selected = parseISO(dISO);
      setView("day");
    }
  });

  // Settings toggles at the bottom of the page. Both persist in
  // localStorage. The 6 PM setting applies on the next fresh load, and
  // immediately too when it is currently after 6 PM.
  var setLunchFirstEl = document.getElementById("set-lunch-first");
  var setAfter6El = document.getElementById("set-after6-tomorrow");
  if (setLunchFirstEl && setAfter6El) {
    setLunchFirstEl.checked = lunchFirst;
    setAfter6El.checked = after6Tomorrow;
    setLunchFirstEl.addEventListener("change", function () {
      lunchFirst = setLunchFirstEl.checked;
      writePref("msp-lunch-first", lunchFirst);
      render();
    });
    setAfter6El.addEventListener("change", function () {
      after6Tomorrow = setAfter6El.checked;
      writePref("msp-after6-tomorrow", after6Tomorrow);
      if (new Date().getHours() >= 18) selected = landingDay();
      render();
    });
  }

  function formatUpdated(isoStr) {
    if (!isoStr) return "";
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    return MONTHS_SHORT[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  function updateSchoolChrome() {
    document.documentElement.dataset.school = school;
    var name = schoolName(school);
    if (schoolBtnEl) {
      schoolBtnEl.innerHTML = escapeHTML(name) +
        ' <span class="chev">\u2304</span>';
    }
    document.title = "West Shore SD Menus \u2014 " + name;
  }

  // Each school has its own menu file under data/.
  function loadSchool(slug) {
    var request = ++menuRequest;
    return fetch("data/" + slug + ".json?v=10", { cache: "no-store" })
      .then(function (resp) {
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        return resp.json();
      })
      .then(function (json) {
        if (request !== menuRequest) return;
        data = json;
        buildItemList();
        // If the user already typed before the data arrived, offer
        // suggestions for what is in the box now.
        if (searchInputEl && searchInputEl.value) {
          showSuggest(matchItems(searchInputEl.value));
        }
        var updated = formatUpdated(data.generated_at);
        footerEl.innerHTML = updated
          ? "Menu updated " + escapeHTML(updated) +
            " &middot; Menus via <a href=\"https://www.nutrislice.com/\" rel=\"noopener\">Nutrislice</a>"
          : "Menus via Nutrislice";
        render();
      })
      .catch(function () {
        if (request !== menuRequest) return;
        contentEl.innerHTML =
          '<div class="card"><div class="card-title">Meals</div>' +
          '<p class="muted">Menu data couldn&rsquo;t be loaded. Check your connection and try again.</p></div>';
      });
  }

  // --- School picker (bottom sheet) ---
  function openSchoolPicker() {
    if (!schoolSheetEl || !schoolListEl) return;
    schoolListEl.innerHTML = SCHOOLS.map(function (s) {
      var isCurrent = s[0] === school;
      return '<li><button type="button" class="school-item' +
        (isCurrent ? " current" : "") + '" data-school="' + s[0] + '"' +
        (isCurrent ? ' aria-current="true"' : "") + ">" +
        '<span class="school-name">' + escapeHTML(s[1]) + "</span>" +
        (isCurrent ? '<span class="school-check">\u2713</span>' : "") +
        "</button></li>";
    }).join("");
    schoolSheetEl.hidden = false;
  }

  function closeSchoolPicker() {
    if (schoolSheetEl) schoolSheetEl.hidden = true;
  }

  function selectSchool(slug) {
    if (!validSchool(slug)) return;
    closeSchoolPicker();
    if (slug === school) return;
    school = slug;
    data = null;
    allItems = [];
    footerEl.textContent = '';
    writeStringPref("msp-school", school);
    updateSchoolChrome();
    // Drop the old school's search state before the new data lands.
    searchItem = null;
    if (searchInputEl) searchInputEl.value = "";
    hideSuggest();
    updateClearBtn();
    contentEl.innerHTML =
      '<div class="card"><p class="muted">Loading menu&hellip;</p></div>';
    loadSchool(school);
  }

  if (schoolBtnEl) {
    schoolBtnEl.addEventListener("click", function () { openSchoolPicker(); });
  }
  if (schoolCloseEl) {
    schoolCloseEl.addEventListener("click", function () { closeSchoolPicker(); });
  }
  if (schoolBackdropEl) {
    schoolBackdropEl.addEventListener("click", function () { closeSchoolPicker(); });
  }
  if (schoolListEl) {
    schoolListEl.addEventListener("click", function (e) {
      var slug = closestData(e.target, "school");
      if (slug) selectSchool(slug);
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSchoolPicker();
  });

  updateSchoolChrome();
  loadSchool(school);

  render();
})();
