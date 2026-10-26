"""Build the Prospects Prime 10U data files from GameChanger per-game + season exports.

  python3 build_data.py <dir with GC csvs> <output dir>

Produces (under <output dir>):
  data/team.json          published bundle the app's store reads (season / last_8 / last_4 windows + game log)
  data/games.json         per-game box data for the Season page
  data/gc/*.csv           the three GameChanger-format CSVs (Season, Last 8, Last 4) for Manage uploads

File order: GameChanger numbered the downloads most-recent-first, so Stats_1.csv is the latest game and
Stats_16.csv the first. The schedule below (from GameChanger's schedule page) fixes the dates and opponents.
"""
import csv, glob, re, json, sys, os, datetime
from collections import OrderedDict

SRC, OUT = sys.argv[1], sys.argv[2]

# Chronological schedule from GameChanger (date, away?, opponent, location, us, them) -> maps to file 16..1
SCHEDULE = [
 ("2026-09-13", True,  "Dirtbags Gold 10U",          "Phillips Park", 3, 5),
 ("2026-09-13", False, "The MOB 10U",                "Phillips Park", 14, 3),
 ("2026-09-13", True,  "Diamondcore 10U",            "", 9, 5),
 ("2026-09-13", True,  "Dirtbags Gold 10U",          "", 10, 3),
 ("2026-09-20", False, "Dingers Gold 10U",           "Kessler Mountain Regional Park", 14, 2),
 ("2026-09-20", True,  "10U Missouri Padres",        "Kessler Mountain Regional Park", 2, 7),
 ("2026-09-20", True,  "Arkansas Rangers 10U",       "Kessler Mountain Regional Park", 8, 2),
 ("2026-09-20", True,  "10U Missouri Padres",        "", 15, 14),
 ("2026-10-03", True,  "Tulsa Lions 10U",            "Phillips Park", 21, 1),
 ("2026-10-03", False, "Nukes Jackson 10U",          "", 2, 4),
 ("2026-10-04", False, "Arkansas Sliders White 10U", "Phillips Park", 14, 5),
 ("2026-10-04", True,  "Diamondcore 10U",            "Phillips Park", 12, 9),
 ("2026-10-04", True,  "Legacy Gilbert 10U",         "Phillips Park", 0, 5),
 ("2026-10-23", False, "Prospects Duddleston 10U",   'C.L. "Charlie" and Willie George Park', 5, 4),
 ("2026-10-24", True,  "DOC 2035 Navy 10U",          'C.L. "Charlie" and Willie George Park', 7, 8),
 ("2026-10-25", False, "DOC 2035 Navy 10U",          "Phillips Park", 2, 3),
]
# Tournament / weekend grouping (by date cluster) - label only
WEEKENDS = {"2026-09-13": "Sept 13 weekend", "2026-09-20": "Sept 20 weekend", "2026-10-03": "Oct 3-4 weekend",
            "2026-10-04": "Oct 3-4 weekend", "2026-10-23": "Oct 23-25 weekend", "2026-10-24": "Oct 23-25 weekend",
            "2026-10-25": "Oct 23-25 weekend"}

SEC_NAME = {'Batting': 'batting', 'Pitching': 'pitching', 'Fielding': 'fielding'}

def read_raw(f):
    rows = list(csv.reader(open(f, encoding='utf-8-sig')))
    rows = [r for r in rows if any(c.strip() for c in r)]
    band, hdr = rows[0], rows[1]
    body = [r for r in rows[2:] if r[0] != 'Glossary']
    return band, hdr, body

def sec_map(band):
    out, cur = [], ''
    for b in band:
        if b.strip() in SEC_NAME: cur = SEC_NAME[b.strip()]
        out.append(cur)
    return out

def num(v):
    v = (v or '').strip()
    if v in ('', '-', 'N/A'): return None
    try:
        return int(v) if re.fullmatch(r'-?\d+', v) else float(v)
    except ValueError:
        return None

def ip_outs(v):
    n = num(v)
    if n is None: return 0
    w = int(n); f = round((n - w) * 10)
    return w * 3 + f

def outs_ip_str(o):
    return f"{o // 3}.{o % 3}"

def outs_ip_dec(o):
    return round(o / 3, 3)

def rate(a, b, dec=3):
    if not b: return '-'
    s = f"{a / b:.{dec}f}"
    return s[1:] if s.startswith('0.') else s

def pct(a, b):
    return '-' if not b else f"{100 * a / b:.2f}"

def fix(a, b, dec=3):
    return '-' if not b else f"{a / b:.{dec}f}"

# ---------------------------------------------------------------- load
files = sorted(glob.glob(os.path.join(SRC, '*.csv')))
games_raw, season_raw = [], None
for f in files:
    m = re.search(r'Stats_(\d+)\.csv$', f)
    band, hdr, body = read_raw(f)
    if m: games_raw.append((int(m.group(1)), band, hdr, body))
    else: season_raw = (band, hdr, body)
games_raw.sort(key=lambda x: -x[0])          # file 16 first = chronological
assert len(games_raw) == len(SCHEDULE) == 16
band, hdr = season_raw[0], season_raw[1]
secs = sec_map(band)
keys = [(s, h) for s, h in zip(secs, hdr)]
idx = {}
for i, (s, h) in enumerate(keys):
    idx.setdefault((s, h), i)
def col(row, s, h):
    return row[idx[(s, h)]] if (s, h) in idx else ''

# ---------------------------------------------------------------- per-game structures
def player_name(r): return f"{r[2].strip()} {r[1].strip()}".strip()

POS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
def extract(row):
    b = lambda h: num(col(row, 'batting', h))
    p = lambda h: num(col(row, 'pitching', h))
    f = lambda h: num(col(row, 'fielding', h))
    bat = dict(gp=b('GP') or 0, pa=b('PA') or 0, ab=b('AB') or 0, h=b('H') or 0, b1=b('1B') or 0, b2=b('2B') or 0, b3=b('3B') or 0,
               hr=b('HR') or 0, rbi=b('RBI') or 0, r=b('R') or 0, bb=b('BB') or 0, k=b('SO') or 0, kl=b('K-L') or 0,
               hbp=b('HBP') or 0, roe=b('ROE') or 0, sb=b('SB') or 0, cs=b('CS') or 0, qab=b('QAB') or 0, ps=b('PS') or 0,
               hhb=b('HHB') or 0, lob=b('LOB') or 0, xbh=b('XBH') or 0, tb=b('TB') or 0, rbi2=b('2OUTRBI') or 0)
    outs = ip_outs(col(row, 'pitching', 'IP'))
    pit = None
    if outs or (p('BF') or 0):
        pit = dict(outs=outs, ip=outs_ip_dec(outs), ipText=outs_ip_str(outs), gs=p('GS') or 0, bf=p('BF') or 0, pitches=p('#P') or 0,
                   w=p('W') or 0, l=p('L') or 0, sv=p('SV') or 0, h=p('H') or 0, r=p('R') or 0, er=p('ER') or 0, bb=p('BB') or 0,
                   k=p('SO') or 0, hbp=p('HBP') or 0, wp=p('WP') or 0,
                   strikePct=(lambda v: None if v is None else round(v / 100, 4))(num(col(row, 'pitching', 'S%'))),
                   fpsPct=(lambda v: None if v is None else round(v / 100, 4))(num(col(row, 'pitching', 'FPS%'))), sb=p('SB') or 0, cs=p('CS') or 0, pik=p('PIK') or 0)
    fld = dict(tc=f('TC') or 0, po=f('PO') or 0, a=f('A') or 0, e=f('E') or 0, dp=f('DP') or 0)
    catching = None
    cinn = ip_outs(col(row, 'fielding', 'INN'))
    if cinn:
        att = col(row, 'fielding', 'SB-ATT').strip()
        m = re.fullmatch(r'(\d+)-(\d+)', att)
        catching = dict(outs=cinn, inn=outs_ip_str(cinn), pb=f('PB') or 0, sb=int(m.group(1)) if m else (f('SB') or 0),
                        att=int(m.group(2)) if m else 0, cs=f('CS') or 0)
    pos = {}
    for pk in POS:
        o = ip_outs(col(row, 'fielding', pk))
        if o: pos[pk] = o
    return bat, pit, fld, catching, pos

games = []
for n, (fileidx, gband, ghdr, gbody) in enumerate(games_raw, start=1):
    assert ghdr == hdr, f'header mismatch in file {fileidx}'
    date, away, opp, loc, us, them = SCHEDULE[n - 1]
    players, totals = [], None
    for r in gbody:
        if r[0] == 'Totals':
            tb_, tp_, tf_, tc_, _ = extract(r); totals = dict(bat=tb_, pit=tp_, fld=tf_, cat=tc_)
            continue
        bat, pit, fld, cat, pos = extract(r)
        players.append(dict(name=player_name(r), num=num(r[0]), bat=bat, pit=pit, fld=fld, cat=cat, pos=pos))
    assert totals['bat']['r'] == us and totals['pit']['r'] == them, f'score mismatch game {n}: csv {totals["bat"]["r"]}-{totals["pit"]["r"]} vs schedule {us}-{them}'
    games.append(dict(n=n, id=f'gc-{date}-{n}', file=f'Stats_{fileidx}.csv', date=date, away=away, opponent=opp, location=loc,
                      us=us, them=them, result='W' if us > them else ('L' if us < them else 'T'),
                      innings=totals['pit']['ipText'], weekend=WEEKENDS.get(date, ''), team=totals, players=players))

# season from the season file
season_players, season_totals = [], None
for r in season_raw[2]:
    if r[0] == 'Totals':
        tb_, tp_, tf_, tc_, _ = extract(r); season_totals = dict(bat=tb_, pit=tp_, fld=tf_, cat=tc_); continue
    bat, pit, fld, cat, pos = extract(r)
    season_players.append(dict(name=player_name(r), num=num(r[0]), bat=bat, pit=pit, fld=fld, cat=cat, pos=pos))

os.makedirs(os.path.join(OUT, 'data', 'gc'), exist_ok=True)
json.dump(dict(built=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'), source='GameChanger exports',
               season='Fall 2026', games=games, seasonTotals=season_totals, seasonPlayers=season_players),
          open(os.path.join(OUT, 'data', 'games.json'), 'w'), separators=(',', ':'))

# ---------------------------------------------------------------- aggregated GC-format CSVs
# Columns that are plain counts get summed. Rate columns we can derive are recomputed; the rest are '-'.
COUNT = set()
RATE_DERIVED = {}
def agg_rows(game_list):
    """Return list of row-lists in GC column order for the given games (plus Totals)."""
    by = OrderedDict()
    for g in game_list:
        for r in g['_rows']:
            key = r[0] + '|' + r[1] + '|' + r[2]
            by.setdefault(key, []).append(r)
    out = []
    for key, rows in by.items():
        out.append(aggregate(rows))
    # Totals row last
    tot = [r for r in out if r[0] == 'Totals']
    out = [r for r in out if r[0] != 'Totals'] + tot
    return out

def aggregate(rows):
    base = rows[0]
    res = list(base)
    for i, (s, h) in enumerate(keys):
        if i < 3: continue
        vals = [num(r[i]) for r in rows]
        if all(v is None for v in vals): res[i] = '-'; continue
        res[i] = str(sum(v for v in vals if v is not None))
    r = res
    def g(s, h): return num(col(r, s, h)) or 0
    def setc(s, h, v):
        if (s, h) in idx: r[idx[(s, h)]] = v
    # --- batting rates
    pa, ab, h, bb, hbp, k = g('batting','PA'), g('batting','AB'), g('batting','H'), g('batting','BB'), g('batting','HBP'), g('batting','SO')
    b1, b2, b3, hr, sf, sac = g('batting','1B'), g('batting','2B'), g('batting','3B'), g('batting','HR'), g('batting','SF'), g('batting','SAC')
    tb = b1 + 2*b2 + 3*b3 + 4*hr
    setc('batting','TB', str(tb)); setc('batting','XBH', str(b2+b3+hr))
    obp_den = ab + bb + hbp + sf
    setc('batting','AVG', rate(h, ab)); setc('batting','OBP', rate(h+bb+hbp, obp_den)); setc('batting','SLG', rate(tb, ab))
    setc('batting','OPS', '-' if not ab or not obp_den else rate((h+bb+hbp)/obp_den + tb/ab, 1))
    setc('batting','QAB%', pct(g('batting','QAB'), pa)); setc('batting','SB%', pct(g('batting','SB'), g('batting','SB')+g('batting','CS')))
    setc('batting','PA/BB', fix(pa, bb, 1)); setc('batting','BB/K', fix(bb, k, 3)); setc('batting','C%', pct(ab-k, ab))
    setc('batting','PS/PA', fix(g('batting','PS'), pa, 3)); setc('batting','2S+3%', pct(g('batting','2S+3'), pa)); setc('batting','6+%', pct(g('batting','6+'), pa))
    setc('batting','AB/HR', fix(ab, hr, 1)); setc('batting','BABIP', rate(h-hr, ab-k-hr+sf))
    for h_ in ['LD%','FB%','GB%','BA/RISP']: setc('batting', h_, '-')
    # --- pitching rates (IP in baseball notation: sum outs)
    outs = sum(ip_outs(col(x, 'pitching', 'IP')) for x in rows)
    ip = outs / 3
    setc('pitching','IP', outs_ip_str(outs))
    ph, pr, per, pbb, pk, pbf, pp, phbp = g('pitching','H'), g('pitching','R'), g('pitching','ER'), g('pitching','BB'), g('pitching','SO'), g('pitching','BF'), g('pitching','#P'), g('pitching','HBP')
    setc('pitching','ERA', '-' if not ip else f"{per*6/ip:.3f}"); setc('pitching','WHIP', '-' if not ip else f"{(pbb+ph)/ip:.3f}")
    setc('pitching','SV%', pct(g('pitching','SV'), g('pitching','SVO'))); setc('pitching','SB%', pct(g('pitching','SB'), g('pitching','SB')+g('pitching','CS')))
    setc('pitching','BAA', rate(ph, pbf - pbb - phbp - g('pitching','SAC') if (('pitching','SAC') in idx) else pbf - pbb - phbp))
    setc('pitching','P/IP', fix(pp, ip, 1)); setc('pitching','P/BF', fix(pp, pbf, 3)); setc('pitching','BB/INN', fix(pbb, ip, 3))
    setc('pitching','K/BF', rate(pk, pbf)); setc('pitching','K/BB', fix(pk, pbb, 3))
    # strike % : weight the per-game S% by pitches
    sp = sum((num(col(x,'pitching','S%')) or 0) * (num(col(x,'pitching','#P')) or 0) for x in rows)
    setc('pitching','S%', '-' if not pp else f"{sp/pp:.2f}")
    fp = sum((num(col(x,'pitching','FPS%')) or 0) * (num(col(x,'pitching','BF')) or 0) for x in rows)
    setc('pitching','FPS%', '-' if not pbf else f"{fp/pbf:.2f}")
    for h_ in ['<3%','FIP','FPSO%','FPSW%','FPSH%','SM%','WEAK%','HHB%','GO/AO','LD%','FB%','GB%','BABIP','BA/RISP',
               'FBS%','FBSW%','FBSM%','CTS%','CTSW%','CTSM%','CBS%','CBSW%','CBSM%','SLS%','SLSW%','SLSM%','CHS%','CHSW%','CHSM%','OSS%','OSSW%','OSSM%']:
        setc('pitching', h_, '-')
    for h_ in ['MPHFB','MPHCT','MPHCB','MPHSL','MPHCH','MPHOS']: setc('pitching', h_, 'N/A')
    # --- fielding
    tc, po, a, e = g('fielding','TC'), g('fielding','PO'), g('fielding','A'), g('fielding','E')
    setc('fielding','FPCT', rate(po+a, tc))
    cinn = sum(ip_outs(col(x,'fielding','INN')) for x in rows); setc('fielding','INN', outs_ip_str(cinn))
    sb_ = 0; att_ = 0
    for x in rows:
        m = re.fullmatch(r'(\d+)-(\d+)', col(x,'fielding','SB-ATT').strip())
        if m: sb_ += int(m.group(1)); att_ += int(m.group(2))
    setc('fielding','SB-ATT', f'{sb_}-{att_}'); setc('fielding','SB', str(sb_)); setc('fielding','CS', str(att_-sb_)); setc('fielding','CS%', pct(att_-sb_, att_))
    tot_o = 0
    for pk_ in POS + ['SF']:
        o = sum(ip_outs(col(x,'fielding',pk_)) for x in rows); setc('fielding', pk_, outs_ip_str(o)); tot_o += o
    setc('fielding','Total', outs_ip_str(tot_o))
    return r

for g, (fileidx, gband, ghdr, gbody) in zip(games, games_raw):
    g['_rows'] = gbody

def write_csv(path, rows):
    with open(path, 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh, quoting=csv.QUOTE_ALL)
        w.writerow(band); w.writerow(hdr)
        for r in rows: w.writerow(r)

season_rows = [r for r in season_raw[2]]
write_csv(os.path.join(OUT, 'data', 'gc', 'ProspectsPrime10U_Season.csv'), season_rows)
last8 = agg_rows(games[-8:]); write_csv(os.path.join(OUT, 'data', 'gc', 'ProspectsPrime10U_Last8.csv'), last8)
last4 = agg_rows(games[-4:]); write_csv(os.path.join(OUT, 'data', 'gc', 'ProspectsPrime10U_Last4.csv'), last4)
# sanity: aggregate of all 16 must equal season counts
allagg = agg_rows(games)
for ra in allagg:
    rs = [x for x in season_rows if x[:3] == ra[:3]][0]
    for i, (s, h) in enumerate(keys):
        if i < 3: continue
        va, vs = num(ra[i]), num(rs[i])
        if va is None or vs is None: continue
        if h in ('LOB',) or s == 'fielding' and h in ('TC','E','FPCT'): continue  # GC team-level quirks
        if abs(va - vs) > 0.011 and h not in ('AVG','OBP','SLG','OPS','ERA','WHIP','BAA','S%','FPS%','BABIP','SB%','CS%','QAB%','PA/BB','BB/K','C%','PS/PA','2S+3%','6+%','AB/HR','P/IP','P/BF','BB/INN','K/BF','K/BB','SV%'):
            print('DIFF', ra[1], s, h, va, vs)
        elif abs(va - vs) > 0.011:
            print('rate diff', ra[1], s, h, va, vs)

# ---------------------------------------------------------------- team.json (store bundle)
def headers_prefixed():
    out, seen = [], {}
    for i, (s, h) in enumerate(keys):
        name = (s + '.' + h) if s else h
        if not h: name = '_col%d' % i
        if name in seen: seen[name] += 1; name = name + '_' + str(seen[name])
        else: seen[name] = 0
        out.append(name)
    return out
HP = headers_prefixed()
def block(rows, fname, section):
    """Each category block carries only its own section's columns (plus the name columns).
    P10.CSV.findCol looks for 'section.COL' first, so this is lossless for the app and a third the size."""
    cols = [i for i, (s, h) in enumerate(keys) if i < 3 or s == section]
    hp = [HP[i] for i in cols]
    return dict(headers=hp, data=[dict(zip(hp, [r[i].strip() for i in cols])) for r in rows], file=fname)

now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
data = {}
for cat in ['batting', 'pitching', 'fielding', 'catching']:
    sec = 'fielding' if cat == 'catching' else cat
    data[cat] = dict(season=block(season_rows, 'ProspectsPrime10U_Season.csv', sec),
                     last_8=block(last8, 'ProspectsPrime10U_Last8.csv', sec),
                     last_4=block(last4, 'ProspectsPrime10U_Last4.csv', sec))
gamelog = []
for g in games:
    pitchers = [dict(name=p['name'], ip=p['pit']['ip'], r=p['pit']['r'], bb=p['pit']['bb'], k=p['pit']['k'], pitches=p['pit']['pitches'])
                for p in g['players'] if p['pit'] and p['pit']['outs'] > 0]
    gamelog.append(dict(id=g['id'], date=g['date'], opponent=g['opponent'], away=g['away'], us=g['us'], them=g['them'],
                        lineup=[], pitchers=pitchers,
                        notes=(g['location'] + ' · ' if g['location'] else '') + g['innings'] + ' innings · from GameChanger'))
gamelog.sort(key=lambda x: (x['date'], x['id']), reverse=True)
wins = sum(1 for g in games if g['result'] == 'W'); losses = sum(1 for g in games if g['result'] == 'L')
bundle = dict(app='prospects-10u', version=1,
              meta=dict(updatedAt=now, source='published', gamesPlayed=len(games), record=f'{wins}-{losses}',
                        publishedAt=now, note='Fall 2026 · 16 games · GameChanger exports'),
              data=data, games=gamelog)
json.dump(bundle, open(os.path.join(OUT, 'data', 'team.json'), 'w'), separators=(',', ':'))

# ---------------------------------------------------------------- config schedule snippet
sched = []
for g in games:
    sched.append("    { id: %d, date: '%s', away: %s, opponent: '%s', location: '%s', time: '', result: { us: %d, them: %d } }" %
                 (g['n'], g['date'], 'true' if g['away'] else 'false', g['opponent'].replace("'", "\\'"),
                  g['location'].replace("'", "\\'").replace('"', '\\"'), g['us'], g['them']))
open(os.path.join(OUT, 'schedule_snippet.js'), 'w').write(',\n'.join(sched) + '\n')
print('games', len(games), 'record', wins, losses, '| team.json', os.path.getsize(os.path.join(OUT,'data','team.json')), 'bytes | games.json', os.path.getsize(os.path.join(OUT,'data','games.json')))
