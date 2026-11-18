# West Shore SD Menus

One-tap cafeteria menu for West Shore School District: pick your school
in the header, then see breakfast entrées and lunch entrées + Express.
Day view (with prev/next day arrows), week view (Mon–Fri at a glance),
or food search (find the next days a food is on the menu).

## Use it

Live site: https://bw628.github.io/Morning-school-plan/

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

## School colors

The selected school sets the accent and featured meal colors in both light
and dark mode. Hex values are adapted for the app from school-published
branding and newsletters. Highland uses the requested purple and teal.

| School | Palette used in the app | Reference |
| --- | --- | --- |
| Highland | Purple and teal | User-provided colors |
| Cedar Cliff | Navy, white and gold | [School branding](https://www.wssd.k12.pa.us/cedarcliff.aspx), [school profile](https://www.wssd.k12.pa.us/Content.aspx?id=17810) |
| Red Land | Red, navy and white | [School branding](https://www.wssd.k12.pa.us/redland.aspx) |
| Crossroads | Navy and red | [School newsletter](https://www.wssd.k12.pa.us/monthlynewsletter6556.aspx) |
| Fairview | Royal blue and gold | [School newsletter graphic](https://www.wssd.k12.pa.us/fairviewintermediateschool.aspx) |
| Fishing Creek | Blue and aqua | [School newsletter graphic](https://www.wssd.k12.pa.us/fishingcreek.aspx) |
| Hillside | Blue and gold | [School newsletter graphic](https://www.wssd.k12.pa.us/hillside.aspx) |
| Newberry | Navy and periwinkle | [School newsletter](https://www.wssd.k12.pa.us/MonthlyNewsletter1.aspx) |
| New Cumberland | Blue and light blue | [School newsletter](https://www.wssd.k12.pa.us/MonthlyNewsletterNCMS.aspx) |
| Old Trail | Navy and scarlet | [School newsletter](https://www.wssd.k12.pa.us/monthlynewsletter7516.aspx) |
| Red Mill | Red and blue | [School newsletter logo](https://www.wssd.k12.pa.us/redmill.aspx) |
| Rossmoyne | Brown and gold | [School newsletter graphic](https://www.wssd.k12.pa.us/rossmoyne.aspx) |
| Washington Heights | Blue and gold | [School newsletter graphic](https://www.wssd.k12.pa.us/washingtonheights.aspx) |
