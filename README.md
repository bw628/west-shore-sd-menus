# School Lunch Menu — Highland Elementary

One-tap cafeteria menu for Highland Elementary (West Shore School District):
breakfast entrées, and lunch entrées + Express. Day view (with prev/next day
arrows) or week view (Mon–Fri at a glance).

## Use it

Live site: https://bw628.github.io/morning-school-plan/

On iPhone: open the link in Safari → Share → **Add to Home Screen**. It opens
as a standalone full-screen app.

## How it works

- `data.json` holds the menu for the current week + next week. The app reads
  it same-origin (the Nutrislice API sends no CORS headers, so the browser
  can't fetch it directly).
- A GitHub Action (`.github/workflows/update-menu.yml`) runs weekday mornings
  (~5 AM ET) and fetches breakfast + lunch from the Nutrislice API, then
  commits an updated `data.json`.
- Menu source: Nutrislice, West Shore SD — Highland Elementary.
- No personal data: the app contains only the public school menu.
