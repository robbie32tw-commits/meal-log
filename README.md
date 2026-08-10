# 三餐日記

An implementation of the `三餐日記.dc.html` design as a working app — no build step,
no dependencies, no backend. Records and photos live in the browser (IndexedDB);
preferences live in localStorage.

## Run

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>. A server is required — IndexedDB is unavailable
on `file://`. (`.claude/launch.json` runs the same command.)

Below 460px wide the app fills the screen; above that it renders in the design's
390 × 844 frame.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Shell: status bar, screen container, tab bar, FAB, toast/dialog roots |
| `ds/industry/styles.css` | The Industry design system, vendored verbatim from the design project |
| `css/app.css` | Screen styles — the design file's inline styles lifted into classes |
| `js/util.js` | Dates, currency, meal slots, image resizing |
| `js/db.js` | IndexedDB store for records (photos are Blobs on the record) |
| `js/settings.js` | Preferences and reminder config |
| `js/app.js` | State, screens, actions |

Take colors, type, spacing and shadows from the `ds/industry/styles.css` tokens
rather than hard-coding values — see that project's `readme.md` for the rules.

## Screens

- **今日** — today's three slots plus any snacks, running daily total, empty slots as add buttons.
- **新增／編輯** — photo (camera or album), name, price, meal slot, place, tags. Delete when editing.
- **月曆** — real calendar with prev/next months, a dot per recorded meal, month totals.
- **單日詳情** — every record for a date with photo, edit and delete, and 補記 buttons for missing slots.
- **統計** — week/month toggle; meal count, spend, daily average, spend chart, per-slot completion rate and top tags, all computed from the records.
- **搜尋** — live search over name, place and tags, with tag chips as filters.
- **設定** — reminders, preferences, export, backup/restore, sample data, wipe.

## Notes on what the design implies but a static web app can't do

- **同步裝置** has no backend. The section lists the local device and 立即同步
  says so rather than pretending. 備份 replaces the design's iCloud row with a
  real backup file (JSON, photos inlined) plus restore.
- **提醒** fire as browser notifications only while the page is open. Real
  background reminders need a native app or push service.
- **PDF 匯出** builds a month album in the page and opens the print dialog —
  "Save as PDF" there produces the file. CSV and JSON download directly.
- **附近的店** would need a places API; the field suggests the three places you
  used most recently instead.

## Photos are duotoned

Per the design system, every content photograph goes through `.duotone`, which
washes it into the steel accent — so meal photos render monochrome blue. To show
them in their own color, drop `duotone` from the four photo containers in
`js/app.js` (`.thumb`, `.photo-drop`, `.day-photo`, `.result-thumb`).
