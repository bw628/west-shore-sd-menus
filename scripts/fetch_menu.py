#!/usr/bin/env python3
"""Fetch the Highland Elementary cafeteria menu from Nutrislice and write
data.json (current week + next week).

Breakfast: Entree station only.
Lunch: Entree + Express stations.
Item names are deduped and capped at 10 per station.
"""
import json
import urllib.request
from datetime import date, datetime, timedelta, timezone

SCHOOL_SLUG = "highland-elementary"
API_BASE = "https://wssdk12pa.api.nutrislice.com"
MAX_ITEMS = 10
OUT_PATH = "data.json"


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


def extract(day, station):
    """Pull item names from one station of one Nutrislice day object."""
    out = []
    current = None
    for item in (day or {}).get("menu_items", []) or []:
        if item.get("is_station_header"):
            label = (item.get("text") or "").strip().lower()
            if label in ("entree", "entrée"):
                current = "Entree"
            elif label == "express":
                current = "Express"
            else:
                current = None
            continue
        name = (item.get("food") or {}).get("name")
        if name and current == station:
            out.append(name)
    seen = set()
    deduped = []
    for name in out:
        if name not in seen:
            seen.add(name)
            deduped.append(name)
    return deduped[:MAX_ITEMS]


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
                    {"breakfast": [], "lunch_entree": [], "lunch_express": []},
                )
                if menu_type == "breakfast":
                    entry["breakfast"] = extract(day, "Entree")
                else:
                    entry["lunch_entree"] = extract(day, "Entree")
                    entry["lunch_express"] = extract(day, "Express")
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
