# School Lunch Menu — West Shore School District

One-tap cafeteria menu for West Shore School District: pick your school
in the header, then see breakfast entrées and lunch entrées + Express.
Day view (with prev/next day arrows), week view (Mon–Fri at a glance),
or food search (find the next days a food is on the menu).

## Use it

Live site: https://bw628.github.io/morning-school-plan/

On iPhone: open the link in Safari → Share → **Add to Home Screen**. It opens
as a standalone full-screen app.

## How it works

- `data/<school-slug>.json` holds the menu for the current week + next week
  for each of the district's 13 schools. The app reads its school's file
  same-origin (the Nutrislice API sends no CORS headers, so the browser
  can't fetch it directly). `data.json` is a copy of Highland's file, kept
  so older cached installs still load.
- A GitHub Action (`.github/workflows/update-menu.yml`) runs weekday mornings
  (~5 AM ET) and fetches breakfast + lunch from the Nutrislice API for all
  schools, then commits the updated files.
- Menu source: Nutrislice, West Shore SD.
- No personal data: the app contains only the public school menus. Each
  phone's school pick, meal-order and after-6 PM settings live only on
  that device (localStorage).
