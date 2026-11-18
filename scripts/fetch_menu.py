#!/usr/bin/env python3
"""Fetch the West Shore School District cafeteria menus from Nutrislice
and write one file per school into data/ (current week + next week).

Captures EVERY station for both meals:
  Breakfast: Entree, Daily Serve Entree, Fruit, Condiments, Milk.
  Lunch: Entree, Daily Serve Entree, Express, Vegetable, Fruit,
  Condiments, Milk.
Item names are deduped and capped at 10 per station. Station labels are
normalized (trimmed + lowercased) because the API sometimes returns
e.g. "Condiments " with a trailing space.

School list verified live against the Nutrislice schools endpoint
(https://wssdk12pa.api.nutrislice.com/menu/api/schools/) and each slug
checked for real lunch menus for the week of 2026-11-16. The district's
schools are officially "Primary" (K-2) and "Intermediate" (3-5) schools;
there is no Allen Middle School in Nutrislice any more (Crossroads is
the middle school) and the old "red-mill-elementary" / "fairview-
elementary" slugs 404. data.json is kept as a copy of Highland's file
so older cached installs of the app still load.
"""
import json
from math import isfinite
import os
import urllib.request
from datetime import date, datetime, timedelta, timezone

API_BASE = "https://wssdk12pa.api.nutrislice.com"
MAX_ITEMS = 10
OUT_DIR = "data"
LEGACY_PATH = "data.json"

# (display name, Nutrislice slug). Highland first: it is the default.
SCHOOLS = [
    ("Highland Primary School", "highland-elementary"),
    ("Cedar Cliff High School", "cedar-cliff-high-school"),
    ("Crossroads Middle School", "crossroads-middle-school"),
    ("Fairview Intermediate School", "fairview-intermediate"),
    ("Fishing Creek Primary School", "fishing-creek-elementary"),
    ("Hillside Primary School", "hillside-elementary"),
    ("Newberry Primary School", "newberry-elementary"),
    ("New Cumberland Middle School", "new-cumberland-middle-school"),
    ("Old Trail Intermediate School", "old-trail-intermediate"),
    ("Red Land High School", "red-land-high-school"),
    ("Red Mill Primary School", "redmill-elementary"),
    ("Rossmoyne Primary School", "rossmoyne-elementary"),
    ("Washington Heights Primary School", "washington-heights-elementary"),
]

# Normalized station label -> schema key
STATION_KEYS = {
    "entree": "entree",
    "entrée": "entree",
    "daily serve entree": "daily_serve",
    "express": "express",
    "vegetable": "vegetable",
    "fruit": "fruit",
    "condiments": "condiments",
    "milk": "milk",
}

BREAKFAST_SCHEMA = ["entree", "daily_serve", "fruit", "condiments", "milk"]
LUNCH_SCHEMA = [
    "entree",
    "daily_serve",
    "express",
    "vegetable",
    "fruit",
    "condiments",
    "milk",
]


def fetch_week(slug, menu_type, d):
    url = (
        f"{API_BASE}/menu/api/weeks/school/{slug}"
        f"/menu-type/{menu_type}/{d.year}/{d.month:02d}/{d.day:02d}/"
    )
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


# Keep numeric quantities in the units used by the feed. Vitamin D's
# legacy mg_vitamin_d field does not reliably contain milligrams.
NUTRIENTS = (
    "calories", "g_fat", "g_saturated_fat", "g_trans_fat", "mg_cholesterol",
    "mg_sodium", "g_carbs", "g_fiber", "g_sugar", "g_added_sugar", "g_protein",
    "mcg_vitamin_d", "mg_calcium", "mg_iron", "mg_potassium",
    "mcg_vitamin_a", "mg_vitamin_c",
)


# Reference estimate for food 1422711, whose one-sandwich entry reports
# roughly twice the manufacturer's calories. The district SKU is unconfirmed.
# https://www.smuckerawayfromhome.com/products/snacks/uncrustables-2.6oz-peanut-butter-and-grape-sandwich-72-count-case
UNCRUSTABLE_NUTRITION = {
    "calories": 300,
    "g_fat": 16,
    "g_saturated_fat": 3.5,
    "g_trans_fat": 0,
    "mg_cholesterol": 0,
    "mg_sodium": 270,
    "g_carbs": 32,
    "g_fiber": 4,
    "g_sugar": 14,
    "g_added_sugar": 12,
    "g_protein": 9,
    "mcg_vitamin_d": 0,
    "mg_calcium": 43,
    "mg_iron": 1,
    "mg_potassium": 235,
}


def extract_nutrition(food, menu_item):
    if not food.get("has_nutrition_info"):
        return {}
    values = food.get("rounded_nutrition_info") or {}
    amount = menu_item.get("serving_size_amount")
    unit = menu_item.get("serving_size_unit")
    if amount is not None and unit:
        matches = [
            size for size in food.get("food_sizes") or []
            if str(size.get("serving_size_amount")) == str(amount)
            and size.get("serving_size_unit") == unit
        ]
        if len(matches) == 1:
            values = matches[0].get("nutrition_info") or {}
        elif (str((food.get("serving_size_info") or {}).get("serving_size_amount")),
              (food.get("serving_size_info") or {}).get("serving_size_unit")) != (str(amount), unit):
            return {}
    return {
        key: value for key in NUTRIENTS
        if type(value := values.get(key)) in (int, float) and isfinite(value) and value >= 0
    }


def extract_stations(day):
    """Return station names and optional nutrition for the same menu items."""
    out = {}
    nutrition = {}
    current = None
    for item in (day or {}).get("menu_items", []) or []:
        if item.get("is_station_header"):
            label = (item.get("text") or "").strip().lower()
            current = STATION_KEYS.get(label)
            continue
        food = item.get("food") or {}
        name = food.get("name")
        if not name or not current:
            continue
        names = out.setdefault(current, [])
        if name in names or len(names) >= MAX_ITEMS:
            continue
        names.append(name)
        values = extract_nutrition(food, item)
        amount, unit = item.get("serving_size_amount"), item.get("serving_size_unit")
        if amount is None or not unit:
            serving = food.get("serving_size_info") or {}
            amount, unit = serving.get("serving_size_amount"), serving.get("serving_size_unit")
        if food.get("id") == 1422711 and str(amount) in ("1", "1.0") and unit == "each":
            values = UNCRUSTABLE_NUTRITION.copy()
        if amount is not None and str(amount).strip() and unit:
            values["serving_size"] = f"{amount} {unit}"
        if values:
            nutrition.setdefault(current, {})[name] = values
    return out, nutrition


def sunday_of(d):
    return d - timedelta(days=(d.weekday() + 1) % 7)


def fetch_school(name, slug):
    today = date.today()
    days = {}
    weeks = []
    for anchor in (today, today + timedelta(days=7)):
        sun = sunday_of(anchor)
        weeks.append(sun.isoformat())
        for menu_type in ("breakfast", "lunch"):
            week = fetch_week(slug, menu_type, anchor)
            for day in week.get("days", []):
                iso = day.get("date")
                if not iso:
                    continue
                entry = days.setdefault(
                    iso,
                    {
                        "breakfast": {k: [] for k in BREAKFAST_SCHEMA},
                        "lunch": {k: [] for k in LUNCH_SCHEMA},
                    },
                )
                stations, nutrition = extract_stations(day)
                entry.setdefault("nutrition", {})[menu_type] = nutrition
                schema = (
                    BREAKFAST_SCHEMA if menu_type == "breakfast" else LUNCH_SCHEMA
                )
                target = entry["breakfast"] if menu_type == "breakfast" else entry["lunch"]
                for key in schema:
                    if stations.get(key):
                        target[key] = stations[key]
    return {
        "generated_at": datetime.now(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
        "school": name,
        "slug": slug,
        "weeks": sorted(set(weeks)),
        "days": days,
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    highland = None
    for name, slug in SCHOOLS:
        data = fetch_school(name, slug)
        path = os.path.join(OUT_DIR, slug + ".json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"Wrote {path}: {len(data['days'])} days, weeks {data['weeks']}")
        if slug == "highland-elementary":
            highland = data
    if highland is not None:
        with open(LEGACY_PATH, "w", encoding="utf-8") as f:
            json.dump(highland, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"Wrote {LEGACY_PATH} (Highland copy for cached installs)")


if __name__ == "__main__":
    main()
