# Prospects Prime 10U Baseball

Stat hub for the Prospects Prime 10U travel team. Static site - no build step, no npm,
no server. Drag the folder onto Netlify and it runs.

---

## Deploy in 2 minutes

**Option A - drag and drop (fastest)**

1. Go to https://app.netlify.com/drop
2. Drag this entire folder onto the page
3. Netlify gives you a URL like `random-name-123.netlify.app`
4. Site settings > Change site name > `prospects10u` (or whatever is free)

**Option B - connect to Git (better long term)**

1. Push this folder to a GitHub repo
2. Netlify > Add new site > Import an existing project > pick the repo
3. Build command: **leave blank**. Publish directory: **`.`**
4. Every push now redeploys automatically

Option B is what you want before we set up the daily sync, because the sync
works by committing an updated `data/team.json` to the repo.

---

## Before you go live - three edits

Everything you need to change lives in **`js/config.js`**.

**1. The coach passcode.** Line near the bottom:

```js
coachCode: 'prospects10',
```

Change it. This gates the Lineup Builder, Manage tab, playing-time analysis and
matchup planning. Note honestly what it is and is not: it is a speed bump that
keeps parents out of lineup decisions. Anyone who views the page source can read
it. Do not put anything genuinely private in this app.

**2. The schedule.** It is currently empty:

```js
schedule: [],
```

Fill it in like this and the Schedule tab, the Next Game card and the matchup
planner all light up:

```js
schedule: [
  { id: 1, date: '2026-03-07', away: true,  opponent: 'Springdale Baseball Club 10U',
    location: 'Memorial Park', time: '10:00 AM' },
  { id: 2, date: '2026-03-07', away: false, opponent: 'Diamond Dawgs NWA 10U',
    location: 'Memorial Park', time: '1:30 PM' }
],
```

`date` must be `YYYY-MM-DD`. `away: true` means we are the visiting team.
`time` and `location` are optional.

**3. Weather location.** Defaults to Fayetteville, AR. If you play elsewhere:

```js
location: { lat: 36.0626, lng: -94.1574, label: 'Fayetteville, AR' }
```

Forecasts come from Open-Meteo - free, no API key, no account.

Optional: fill in each player's position and whether they pitch in the `roster`
array. The app infers both from your stats, so this is only worth doing if you
want positions showing before the first upload.

---

## Loading stats

1. Export CSVs from GameChanger (Team > Stats > Export)
2. Open the site, click the gear, enter your coach passcode
3. Go to **Manage**, drop the CSVs in, click **Update Dashboard**

**File naming matters.** The app reads the filename to figure out what each file
is. Include the category and the window:

```
Prospects10U_Batting_Season.csv
Prospects10U_Batting_Last8.csv
Prospects10U_Batting_Last4.csv
Prospects10U_Pitching_Season.csv
Prospects10U_Fielding_Season.csv
```

If a filename is ambiguous the app auto-detects the category from the columns,
and you can override both category and window from the dropdowns on each file
row before you process.

GameChanger's two-row header format (a section band over the real column names)
is handled. So is a single-row header. Both `Player` and separate `First`/`Last`
columns work, and `Last, First` ordering is handled too.

Only the Season files are required. Last 8 and Last 4 unlock the stat-window
toggle and the hot/cold trend arrows.

### Trying it before real stats exist

**Manage > Load Sample Data** fills every screen with made-up numbers in one
click. While it is on, the status pill in the masthead reads **Sample data**
instead of a timestamp, and the footer says so too. **Clear All Data** in Manage
removes it.

Jackson's line in the sample is carried over from his real 9U season. The other
eight are invented. The files live in `sample/` in the real 174-column
GameChanger format, so loading them exercises the same parser your real export
will hit.

Delete the `sample/` folder before you hand the link out if you would rather it
not be reachable at all.

### Player cards

Clicking any player anywhere - a roster card, a table row, a leaderboard - opens
their baseball card. It spins in once, then sits there. **Flip Card** turns it
over to a full stat back: batting, pitching, fielding, innings by position, and
a short scouting line generated from what the numbers actually say.

**Photos.** There are two kinds, and the difference matters.

A **team photo** is a file committed to `assets/players/<slug>.jpg`, named after
the player: `jackson-lewis.jpg`, `manuel-cruz-jr.jpg`. It ships with the site, so
**everybody sees it, on every device.** That is the one you want.

A **local photo** is one someone adds from the card itself. It is downscaled and
compressed in their browser and saved in that browser's storage. It shows up for
them and nobody else, on that one device.

That is not a limitation I chose - it is what a static site is. There is no
server for a phone to upload to. A photo added on a phone physically cannot
reach anyone else's device.

So the workflow is: **Coach > Manage > Team Photos.** Tap a player, pick their
photo, repeat. Hit **Download Photo Pack** and every photo saves already named
correctly. Drop them into `assets/players/`, commit, push. Forty seconds later
every parent has them.

If a parent wants their kid's photo on the card for the whole team, they send it
to you and you add it. Tell them that up front, or they will add one on their
phone, see it on their phone, and reasonably assume everyone else can too.

### Getting stats to everyone else

Uploading only changes **your** browser. To push numbers to parents and players:

**Manage > Publish for Everyone** downloads a `team.json`. Drop it into the
site's `data/` folder replacing the old one, then redeploy. That is it - every
visitor now sees the new numbers with nothing to install and nothing to click.
The app checks for a newer `team.json` on load and when a tab regains focus.

This is the step the daily sync will automate.

---

## How things work

**Where the numbers come from.** Everything is computed from your CSVs. Nothing
is invented. If a stat is missing from the export the app derives it where the
math allows (SLG from hits and extra-base hits, ERA from earned runs and
innings, strike% from strikes over pitches) and shows an em dash where it
cannot.

**The 10U benchmarks.** Every color, grade and flag traces back to the `bench`
block in `js/config.js`, calibrated for competitive 10U travel ball. Green is
elite or above average, amber is average, red needs work. If your league plays
noticeably tougher or softer, edit those numbers - the whole app re-tunes.

**Tiers (Core / Support / Develop)** are OPS rank within the roster, among
players with at least 8 plate appearances. They are relative to your own team,
not to the league.

**The lineup engine** scores every player against every batting spot rather than
just sorting by OPS. Each spot weights on-base, contact, power and speed
differently - so a slugger can grade C leading off and A in the four-hole. Low
sample sizes are pulled toward the middle so a hot 4-at-bat stretch does not
jump a kid to third in the order. Tag each player's speed on the Lineup tab and
the leadoff and nine-hole ratings get noticeably better. Any slot you override
by hand sticks until you hit Reset.

**The staff order** weights strike percentage heaviest, then walks, then runs
allowed, then strikeouts - and scales by innings actually thrown. That ordering
is deliberate: at 10U the kid who throws strikes beats the kid with better stuff
essentially every time.

**Drills** are not generic. The app detects what each player's numbers actually
flag - high strikeout rate, low on-base, walks from the mound, error rate - and
pulls only the drills that address those. Each drill is tagged for whether it
needs a full team practice, a backyard, or nothing but the kid.

**Pitch counts.** The Pitching tab carries USA Baseball's rest requirements for
ages 9-10 (75 pitch daily max). The app does not track pitch counts per outing -
GameChanger does that - it is there so the rule is in front of you.

---

## What parents and players see

Everything except the Lineup and Manage tabs: team and player stats, the roster
with player cards, the schedule with weather, benchmarks, development drills,
and every player's detail card with their team ranks and what they do well.

They do not see lineup decisions, playing-time analysis or the matchup planner.
Those two tabs stay visible with a padlock, so nobody thinks the site is broken.

---

## File map

```
index.html            page shell
netlify.toml          caching + security headers
data/team.json        published stats - this is what the daily sync updates
assets/               logo, star mark, favicons
vendor/               Chart.js, vendored so nothing depends on a CDN
sample/               fake CSVs for testing - safe to delete
css/
  base.css            design tokens, typography, reset
  layout.css          shell, nav, hero, grids, responsive
  components.css      cards, tables, badges, drawer, modals
  cards.css           the baseball card itself
js/
  config.js           ROSTER, SCHEDULE, BENCHMARKS, PASSCODE  <- edit this one
  csv.js              GameChanger CSV parser + column matching
  cards.js            baseball card: spin, flip, photo upload
  stats.js            stat extraction, player build, tiers, ranks
  store.js            state, localStorage, publish/load
  insights.js         weakness detection, achievements, team focus
  drills.js           the drill library
  lineup.js           batting-order and pitcher rating engines
  schedule.js         games, countdowns, Open-Meteo weather
  charts.js           Chart.js wrappers
  views.js            all rendering
  app.js              routing and events
```

To test with fake data before your real stats are ready, upload the files in
`sample/`. Delete that folder before going live so nobody confuses it for real.

---

## Troubleshooting

**A photo shows on one device but not another.** That is a local photo, not a
team photo. Local photos live in one browser's storage and cannot travel. Add it
under Manage > Team Photos, download the pack, commit the file to
`assets/players/`, and it will be on every device.

**A player shows no stats.** Their name in GameChanger does not match
`js/config.js`. The matcher handles `Last, First`, suffixes like Jr., and
last-name-plus-first-initial, but an actual spelling difference will miss. Fix
the name in config.js to match the export exactly.

**The stat-window toggle is greyed out.** You have only loaded Season files.
Upload Last 8 / Last 4 exports to enable them.

**Weather is missing.** Open-Meteo only forecasts about 16 days out. Games
further away show no forecast until they get closer.

**Charts are blank.** `vendor/chart.umd.min.js` did not upload. Re-deploy the
whole folder.

**Parents see old numbers.** You uploaded but did not publish. Manage > Publish
for Everyone, then replace `data/team.json` and redeploy.

**I forgot the passcode.** It is in `js/config.js` in plain text.

---

## Next: the daily sync

Once this is deployed and connected to a Git repo, the remaining piece is
pulling GameChanger daily and committing an updated `data/team.json` so the site
refreshes itself. The app is already built for it - the publish format and the
`data/team.json` loader are the two halves of that pipeline, and both work now.
