#!/usr/bin/env python3
"""Fetch the Highland Elementary cafeteria menu from Nutrislice and write
data.json (current week + next week).

Captures EVERY station for both meals:
  Breakfast: Entree, Daily Serve Entree, Fruit, Condiments, Milk.
  Lunch: Entree, Daily Serve Entree, Express, Vegetable, Fruit,
  Condiments, Milk.
Item names are deduped and capped at 10 per station. Station labels are
normalized (trimmed + lowercased) because the API sometimes returns
e.g. "Condiments " with a trailing space.
"""
import json
import urllib.request
from datetime import date, datetime, timedelta, timezone

SCHOOL_SLUG = "highland-elementary"
API_BASE = "https://wssdk12pa.api.nutrislice.com"
MAX_ITEMS = 10
OUT_PATH = "data.json"

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


def fetch_week(menu_type, d):
    url = (
        f"{API_BASE}/menu/api/weeks/school/{SCHOOL_SLUG}"
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


def main():
    today = date.today()
    days = {}
    weeks = []
    for anchor in (today, today + timedelta(days=7)):
        sun = sunday_of(anchor)
        weeks.append(sun.isoformat())
        for menu_type in ("breakfast", "lunch"):
            week = fetch_week(menu_type, anchor)
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
    data = {
        "generated_at": datetime.now(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
        "school": "Highland Elementary",
        "weeks": sorted(set(weeks)),
        "days": days,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {OUT_PATH}: {len(days)} days, weeks {data['weeks']}")


if __name__ == "__main__":
    main()
