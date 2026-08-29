/* ==========================================================================
   PROSPECTS PRIME 10U — CONFIG
   Roster, schedule, benchmarks. Edit this file to change team data.
   Everything else reads from here.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.CONFIG = {

  team: {
    name: 'Prospects Prime',
    shortName: 'Prospects',
    ageGroup: '10U',
    fullName: 'Prospects Prime 10U Baseball',
    season: '2026',
    homeField: 'Phillips Park',
    /* Used for the weather forecast on the schedule page.
       Change to your home city if games are elsewhere. */
    location: { lat: 36.0626, lng: -94.1574, label: 'Fayetteville, AR' }
  },

  /* ------------------------------------------------------------------
     ROSTER
     Names must match GameChanger exactly (first + last) so stats link up.
     pos / pitcher / bats / throws are optional - fill in when known.
     ------------------------------------------------------------------ */
  roster: [
    { name: 'Jackson Lewis',    num: 4,  pos: '',  alt: '', pitcher: null, bats: '', throws: '' },
    { name: 'Asher Steele',     num: 13, pos: '',  alt: '', pitcher: null, bats: '', throws: '' },
    { name: 'Coleman Claypool', num: 6,  pos: '',  alt: '', pitcher: null, bats: '', throws: '' },
    { name: 'Hunter Bierman',   num: 2,  pos: '',  alt: '', pitcher: null, bats: '', throws: '' },
    { name: 'James Blaylock',   num: 51, pos: '',  alt: '', pitcher: null, bats: '', throws: '' },
    { name: 'Manuel Cruz Jr.',  num: 12, pos: '',  alt: '', pitcher: null, bats: '', throws: '' },
    { name: 'Mason Graham',     num: 10, pos: '',  alt: '', pitcher: null, bats: '', throws: '' },
    { name: 'Noah Boyd',        num: 11, pos: '',  alt: '', pitcher: null, bats: '', throws: '' },
    { name: 'Roman Lyles',      num: 7,  pos: '',  alt: '', pitcher: null, bats: '', throws: '' }
  ],

  /* ------------------------------------------------------------------
     SCHEDULE
     Add games here. away:true means we are the visiting team.
     Leave empty [] and the Schedule tab shows an "add games" state.
     ------------------------------------------------------------------ */
  schedule: [],

  /* ------------------------------------------------------------------
     10U BENCHMARKS
     Calibrated for competitive 10U travel ball (46 ft mound / 60 ft bases,
     kid pitch). These drive tier assignment, color coding, percentile
     context and the weakness detector.

     elite  = top of the age group
     good   = above average for competitive 10U
     avg    = the middle of the pack
     watch  = below this, flag it for development
     ------------------------------------------------------------------ */
  bench: {
    batting: {
      avg: { elite: .450, good: .360, avg: .290, watch: .215 },
      obp: { elite: .600, good: .500, avg: .420, watch: .330 },
      slg: { elite: .650, good: .490, avg: .380, watch: .280 },
      ops: { elite: 1.200, good: .980, avg: .800, watch: .620 },
      // strikeout rate: LOWER is better (inverted)
      kRate: { elite: .08, good: .15, avg: .24, watch: .34, invert: true },
      // walk rate: higher is better
      bbRate: { elite: .22, good: .15, avg: .09, watch: .05 },
      /* Quality At Bat rate. GameChanger computes this and it is the best
         single number at this age: it credits a hard-hit out, an 8-pitch
         at-bat, a walk, moving a runner over. Rewards process over result.
         Benchmarks are for competitive travel ball, 10U-14U. */
      qab: { elite: .58, good: .50, avg: .42, watch: .34 }
    },
    pitching: {
      // ERA: LOWER is better (inverted)
      era: { elite: 2.00, good: 3.50, avg: 5.50, watch: 8.00, invert: true },
      whip: { elite: 1.00, good: 1.40, avg: 1.90, watch: 2.50, invert: true },
      strike: { elite: .62, good: .56, avg: .50, watch: .44 },
      bbip: { elite: .45, good: .85, avg: 1.40, watch: 2.10, invert: true },
      kip: { elite: 1.80, good: 1.30, avg: .85, watch: .50 }
    },
    fielding: {
      fpct: { elite: .960, good: .910, avg: .850, watch: .760 },
      // errors per chance: LOWER is better
      errRate: { elite: .04, good: .09, avg: .15, watch: .24, invert: true }
    },
    catching: {
      csPct: { elite: .35, good: .22, avg: .12, watch: .05 },
      pbPerG: { elite: .5, good: 1.2, avg: 2.2, watch: 3.5, invert: true }
    }
  },

  /* Minimum sample before a stat is treated as meaningful */
  minSample: {
    pa: 8,     // plate appearances before batting stats are trusted
    ip: 3,     // innings pitched before pitching stats are trusted
    tc: 5      // total chances before fielding stats are trusted
  },

  /* Tier cutoffs - what fraction of the roster lands in each tier */
  tiers: {
    core:    0.34,   // top third
    support: 0.70    // next third; rest are Develop
  },

  /* Pitch count guidance. USA Baseball / Little League 10U guidance:
     max 75 pitches per day for ages 9-10, with rest requirements. */
  pitchLimits: {
    maxPerDay: 75,
    rest: [
      { pitches: 66, days: 4 },
      { pitches: 51, days: 3 },
      { pitches: 36, days: 2 },
      { pitches: 21, days: 1 },
      { pitches: 1,  days: 0 }
    ]
  },

  /* Coach passcode. CHANGE THIS before you deploy.
     This is light gating, not real security - it keeps parents out of the
     lineup builder, it does not protect secrets. Anyone who views source
     can read it. Never put anything truly private in this app. */
  coachCode: 'prospects10',

  /* Where the published data file lives (relative to index.html) */
  dataUrl: 'data/team.json',

  /* localStorage namespace */
  ns: 'prospects10u_v1'
};

/* Convenience lookups built from the roster */
P10.CONFIG.rosterByName = {};
P10.CONFIG.roster.forEach(function (p) {
  P10.CONFIG.rosterByName[p.name.toLowerCase()] = p;
});
