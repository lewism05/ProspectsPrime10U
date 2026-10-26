Prospects Prime 10U - Fall 2026 season data + Season page + chrome theme
=========================================================================
Everything in here drops straight into the repo folder with the same layout.
Files with the same name REPLACE the ones in the repo; the rest are new.

  index.html              REPLACE  adds the Season tab, loads season.css / season.js / chrome.css,
                                   bumps the cache stamp
  js/config.js            REPLACE  roster: Beckett Wilhelm #8 added, Cairo Merriweather #9;
                                   schedule: all 16 Fall 2026 games as GameChanger lists them
  js/season.js            NEW      the Season Review page
  css/season.css          NEW      its styles
  css/chrome.css          NEW      the holographic chrome theme (same file as last time)
  assets/chrome-*.webp/png NEW     chrome artwork for the theme
  data/team.json          REPLACE  the published stats bundle: full season, last 8, last 4,
                                   plus the game log (16 games, scores, pitchers)
  data/games.json         NEW      every game's box score, read by the Season page
  data/gc/*.csv           NEW      Season / Last 8 / Last 4 in GameChanger format, in case you
                                   ever want to re-upload through Manage
  tools/build_data.py     NEW      rebuilds data/ from GameChanger exports (see below)
  tools/gc-exports/       NEW      the 17 exports this was built from

Nothing in js/app.js, views.js, store.js, csv.js, stats.js or the other
files changes. The Season tab registers itself from season.js.

Then: GitHub Desktop -> Commit to main -> Push origin. Netlify redeploys.

AFTER THE NEXT TOURNAMENT
-------------------------
Export the season total plus each new game from GameChanger (Stats -> Export),
send them over, and the data files get rebuilt. If you want to do it yourself:

  python3 tools/build_data.py <folder of exports> <repo folder>

The script needs the schedule block at the top of it updated with the new
games (date, opponent, score) - it uses those to pin each export to a date.

NOTES
-----
- Season / Last 8 / Last 4 are real now, so Development Score, Hottest Bat
  and the window toggle all work.
- The game log in data/team.json uses ids that start with "gc-". If a game
  you logged by hand on your laptop has the same date and opponent, the app
  drops the hand-typed copy once so nothing shows twice.
- Coach passcode is unchanged.
