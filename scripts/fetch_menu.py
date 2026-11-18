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


def extract_stations(day):
    """Pull item names for every station of one Nutrislice day object.

    Returns {station_key: [deduped names, capped at MAX_ITEMS]}.
    """
    out = {}
    current = None
    for item in (day or {}).get("menu_items", []) or []:
        if item.get("is_station_header"):
            label = (item.get("text") or "").strip().lower()
            current = STATION_KEYS.get(label)
            continue
        name = (item.get("food") or {}).get("name")
        if name and current:
            out.setdefault(current, []).append(name)
    for key, names in out.items():
        seen = set()
        deduped = []
        for name in names:
            if name not in seen:
                seen.add(name)
                deduped.append(name)
        out[key] = deduped[:MAX_ITEMS]
    return out


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
                stations = extract_stations(day)
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
