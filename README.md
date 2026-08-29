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

**Photos.** Anyone can add a photo to a player's card, and anyone can push it
up so the whole team sees it.

Tap the card, pick a photo. That is the whole thing - it saves on the device
and shares with the team by itself, no code, no second step.

A small label under the card always says which state a photo is in - **Shared
with the team** or **Saved on this device only** - so a photo that never made it
up does not sit there looking finished. If sharing fails, the photo still saves
locally and a **Try Sharing Again** button appears.

**On the open door.** `TEAM_CODE` is the switch. With it unset, uploads need no
code - which also means anyone who finds the endpoint can replace a player's
photo, because the URL is named in the page source. A same-origin check blocks
casual drive-by attempts from other sites, but it is a speed bump, not a lock;
anything running outside a browser sets its own headers.

Everything is a git commit, so anything unwanted is one revert away in GitHub.
But it would be live on the site until somebody noticed.

To close it back up, add `TEAM_CODE` in Netlify and redeploy. The app picks it
up on its own and starts asking families for it once per device. No code change
either direction.

Behind that button is a small Netlify function that commits the file into
`assets/players/` and updates `data/photos.json`. Netlify redeploys on the
commit, so it is live for everyone about a minute later. The site itself stays
static; the GitHub token lives only in Netlify's environment and never reaches
anybody's browser.

Coaches can also do it in bulk: **Manage > Team Photos** to add several at once,
then **Download Photo Pack** to save them already named correctly plus a
regenerated `photos.json`, and commit those by hand.

---

## Turning on team photo uploads

Until this is set up, Share With Team stays hidden and photos are local-only.
Four things, once.

### 1. Make a GitHub token

Go to **github.com/settings/personal-access-tokens/new**

- **Repository access:** Only select repositories, and pick this repo alone
- **Permissions:** Repository permissions > **Contents: Read and write**
- Generate it and copy it

Scope it to this one repo. A token that can write to everything you own is not
worth the convenience.

### 2. Put it in Netlify

**Site configuration > Environment variables > Add a variable:**

| Key | Value |
| --- | --- |
| `GITHUB_TOKEN` | the token you just copied |
| `GITHUB_REPO` | `lewism05/ProspectsPrime10U` |
| `TEAM_CODE` | optional. Set it and families enter it once per device. Leave it out and anyone who finds the endpoint can upload. |
| `GITHUB_BRANCH` | `main` (only if your default branch is not main) |

The token stays server-side. It is never sent to a browser and never appears in
the page source.

### 3. Redeploy

**Deploys > Trigger deploy > Deploy site.** Environment variables only take
effect on a new deploy.

### 4. Decide about the team code

`TEAM_CODE` is optional and it is the whole gate. Set it and families type it
once per device. Leave it out and photo uploads are open to anyone who finds the
URL - which is in the page source.

Adding or removing it takes effect on the next deploy. Nothing in the app needs
changing either way.

**What gets rejected:** anything that is not a JPEG, PNG or WebP; anything over
700KB; a missing or wrong team code; a request with no player name. SVG is
blocked on purpose - it can carry scripts.

### Getting stats to everyone else

**Uploading a CSV publishes it automatically.** Drop the files in, hit Update
Dashboard, and it writes `data/team.json` in the repo. Netlify rebuilds and
every phone and laptop picks it up on next load. Nothing to download, nothing
to commit by hand.

**Publish For Everyone** in Manage pushes again on demand. Use it after changes
that are not a CSV upload - lineup overrides, the game log.

The Loaded Data header shows both times, `Updated` and `published`, so a device
holding changes nobody else has is visible rather than silent.

Two things it will refuse:

- **An empty set.** Publishing nothing would replace a live season with a blank
  file, so that is rejected outright.
- **Sample data, without asking.** It warns first. Publishing fake numbers puts
  them on every family's phone as though they were real.

If publishing is not configured, uploads still work - they just stay on that one
device, and the app says so instead of implying everyone got them.

---

## Turning on team photo uploads

Until this is set up, Share With Team stays hidden and photos are local-only.
Four things, once.

### 1. Make a GitHub token

Go to **github.com/settings/personal-access-tokens/new**

- **Repository access:** Only select repositories, and pick this repo alone
- **Permissions:** Repository permissions > **Contents: Read and write**
- Generate it and copy it

Scope it to this one repo. A token that can write to everything you own is not
worth the convenience.

### 2. Put it in Netlify

**Site configuration > Environment variables > Add a variable:**

| Key | Value |
| --- | --- |
| `GITHUB_TOKEN` | the token you just copied |
| `GITHUB_REPO` | `lewism05/ProspectsPrime10U` |
| `TEAM_CODE` | optional. Set it and families enter it once per device. Leave it out and anyone who finds the endpoint can upload. |
| `GITHUB_BRANCH` | `main` (only if your default branch is not main) |

The token stays server-side. It is never sent to a browser and never appears in
the page source.

### 3. Redeploy

**Deploys > Trigger deploy > Deploy site.** Environment variables only take
effect on a new deploy.

### 4. Decide about the team code

`TEAM_CODE` is optional and it is the whole gate. Set it and families type it
once per device. Leave it out and photo uploads are open to anyone who finds the
URL - which is in the page source.

Adding or removing it takes effect on the next deploy. Nothing in the app needs
changing either way.

**What gets rejected:** anything that is not a JPEG, PNG or WebP; anything over
700KB; a missing or wrong team code; a request with no player name. SVG is
blocked on purpose - it can carry scripts.

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

## Two rooms

The app is split in two rather than laid out as one long tab bar.

**The Dugout** is where families live: Home, My Player, Roster, Batting,
Pitching, Defense, Schedule. Open to anyone with the link.

**Coaches Corner** holds Practice, Lineup and Manage - the decisions parents
should not have to read. It is visible to everyone so nobody thinks the app is
broken, and unlocks with the coach passcode.

### My Player

A parent picks their kid once and lands there every visit afterwards. It shows
the baseball card, the Development Score with the reasons behind it in plain
sentences, any team awards, what he does well, and every stat with one line
explaining what it is and what normal looks like at 10U.

What it does **not** show a parent is the critique. "Work on this" and its
drills appear only in coach mode. A weakness read cold off a screen lands very
differently than the same sentence from a coach at practice, and the parent view
says so - it points them at that conversation instead.

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
  progress.js         Development Score, game scores, awards
  myplayer.js         a family's home screen
netlify/functions/
  upload-photo.js     commits a shared player photo to the repo
  publish-data.js     commits data/team.json so stats reach every device
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

**Stats show on one device but not another.** They were uploaded but not
published. Open Manage - the Loaded Data header will say `never published`. Hit
Publish For Everyone.

**A photo shows on one device but not another.** It was saved locally and never
shared. Open that player's card and hit **Share With Team**.

**Share With Team is not showing.** The upload function is not deployed or not
configured - see "Turning on team photo uploads". Photos still work locally in
the meantime.

**Somebody uploaded a photo you did not want.** Open the repo's commit history
on GitHub, find the "Team photo for ..." commit and revert it. Then set
`TEAM_CODE` in Netlify and redeploy to close the door.

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
