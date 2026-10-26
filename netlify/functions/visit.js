/* ==========================================================================
   SITE TRAFFIC - WHO IS USING THE APP, AND HOW OFTEN

   Every page load sends one small ping here (see js/visits.js). The ping is
   stored in Netlify Blobs, which is key-value storage that comes with the
   site - nothing to sign up for, nothing committed to the repo, no redeploy.

   What is stored per visit, and nothing more:
     t       when
     did     a random id the browser made for itself, so one phone counts
             as one phone across days (it is not tied to a person)
     name    what the visitor typed in the "who's on this phone" box, if
             they filled it in - this is how a visit maps to a person
     player  the player chosen on the My Player tab, if any - this is how
             a visit maps to a family
     coach   whether coach mode was on
     phone   small screen or not

   No IP addresses, no names of adults, no location. The GET side, which
   turns all of that into a summary, is admin-only:

     ADMIN_CODE   required. Set it in Netlify > Site configuration >
                  Environment variables. The summary refuses to load until
                  it exists, and only a browser holding the code can read
                  it. The coach passcode in config.js does NOT open this.

   Storage: one entry per visit in a blob store named "visits", keyed
   v/<day in Central time>/<time>/<random>/<details>. The details ride in
   the key so a summary is a single list call.
   ========================================================================== */

const { getStore, connectLambda } = require('@netlify/blobs');

const STORE = 'visits';
const TZ = 'America/Chicago';

function reply(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}

/* YYYY-MM-DD for a date in the team's time zone, so "today" rolls over at
   midnight in Arkansas rather than at 7pm. */
function dayKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return get('year') + '-' + get('month') + '-' + get('day');
}

function daysBack(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(dayKey(new Date(Date.now() - i * 86400000)));
  return out;
}

function clean(s, max) {
  return String(s || '').replace(/[^\w .'\-]/g, '').slice(0, max);
}

/* Each visit is its own entry, and everything about it is encoded in the
   key, so a summary needs one list call and no reads. There is no shared
   file for two visitors to overwrite, which matters because the default
   consistency mode can serve a slightly stale read. */
function encode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function decode(str) {
  try { return JSON.parse(Buffer.from(str, 'base64url').toString()); } catch (e) { return null; }
}

async function record(store, body) {
  let p;
  try { p = JSON.parse(body || '{}'); } catch (e) { return reply(400, { error: 'bad json' }); }
  const did = clean(p.did, 24);
  if (!did) return reply(400, { error: 'no device id' });
  const now = new Date();
  const meta = {
    did,
    name: clean(p.name, 40),
    role: clean(p.role, 16),
    player: clean(p.player, 40),
    coach: !!p.coach,
    phone: !!p.phone
  };
  const key = 'v/' + dayKey(now) + '/' + now.toISOString() + '/' + Math.random().toString(36).slice(2, 6) + '/' + encode(meta);
  await store.set(key, '1');
  return reply(200, { ok: true });
}

async function listVisits(store, days) {
  const wanted = new Set(daysBack(days));
  const out = [];
  const { blobs } = await store.list({ prefix: 'v/' });
  (blobs || []).forEach((b) => {
    const parts = String(b.key).split('/');
    if (parts.length < 5 || !wanted.has(parts[1])) return;
    const meta = decode(parts.slice(4).join('/'));
    if (!meta) return;
    out.push(Object.assign({ day: parts[1], t: parts[2] }, meta));
  });
  return out;
}

async function summary(store, days) {
  const keys = daysBack(days);
  const visits = await listVisits(store, days);
  const byDay = {};
  visits.forEach((v) => { (byDay[v.day] = byDay[v.day] || []).push(v); });

  const perDay = [];
  const byPlayer = {};
  const byPerson = {};
  const byDevice = {};
  let total = 0, phone = 0, coach = 0;

  for (const day of keys) {
    const list = byDay[day] || [];
    const devices = new Set();
    list.forEach((v) => {
      const who = v.name || '(no name entered)';
      const pe = byPerson[who] || (byPerson[who] = { visits: 0, devices: new Set(), days: new Set(), last: v.t, players: new Set(), role: '' });
      if (v.role) pe.role = v.role;
      pe.visits++; pe.devices.add(v.did); pe.days.add(day); if (v.player) pe.players.add(v.player); if (v.t > pe.last) pe.last = v.t;
      total++;
      if (v.phone) phone++;
      if (v.coach) coach++;
      devices.add(v.did);
      const d = byDevice[v.did] || (byDevice[v.did] = { visits: 0, first: v.t, last: v.t, player: '', name: '', coach: false, phone: !!v.phone, days: new Set() });
      d.visits++;
      if (v.t < d.first) d.first = v.t;
      if (v.t > d.last) d.last = v.t;
      if (v.player) d.player = v.player;
      if (v.name) d.name = v.name;
      if (v.coach) d.coach = true;
      d.days.add(day);
      const name = v.player || (v.coach ? '(coach, no player picked)' : '(no player picked)');
      const pl = byPlayer[name] || (byPlayer[name] = { visits: 0, devices: new Set(), last: v.t, days: new Set() });
      pl.visits++;
      pl.devices.add(v.did);
      pl.days.add(day);
      if (v.t > pl.last) pl.last = v.t;
    });
    perDay.push({ day, visits: list.length, devices: devices.size });
  }
  perDay.reverse();

  const players = Object.keys(byPlayer).map((name) => ({
    name, visits: byPlayer[name].visits, devices: byPlayer[name].devices.size,
    days: byPlayer[name].days.size, last: byPlayer[name].last
  })).sort((a, b) => b.visits - a.visits);

  const people = Object.keys(byPerson).map((name) => ({
    name, visits: byPerson[name].visits, devices: byPerson[name].devices.size, days: byPerson[name].days.size,
    last: byPerson[name].last, role: byPerson[name].role, players: Array.from(byPerson[name].players).join(', ')
  })).sort((a, b) => b.visits - a.visits);

  const devices = Object.keys(byDevice).map((id) => ({
    id: id.slice(0, 6), visits: byDevice[id].visits, days: byDevice[id].days.size, player: byDevice[id].player, name: byDevice[id].name || '',
    coach: byDevice[id].coach, phone: byDevice[id].phone, first: byDevice[id].first, last: byDevice[id].last
  })).sort((a, b) => b.last.localeCompare(a.last));

  return {
    days, total, uniqueDevices: devices.length, phone, coach,
    today: perDay.length ? perDay[perDay.length - 1].visits : 0,
    perDay, people, players, devices
  };
}

exports.handler = async function (event) {
  const adminCode = process.env.ADMIN_CODE;
  let store;
  try {
    /* Functions written in this handler style do not get the Blobs
       connection handed to them automatically; this reads it off the
       request. Without it the store call fails with "environment has
       not been configured to use Netlify Blobs". */
    connectLambda(event);
    store = getStore(STORE);
  } catch (e) {
    return reply(503, { error: 'Storage is not available on this site.', detail: String(e.message || e) });
  }

  if (event.httpMethod === 'POST') {
    try { return await record(store, event.body); }
    catch (e) { return reply(500, { error: 'Could not save the visit.', detail: String(e.message || e) }); }
  }

  if (event.httpMethod !== 'GET') return reply(405, { error: 'Use GET or POST' });

  if (!adminCode) {
    return reply(503, { error: 'Not set up yet.', detail: 'Set ADMIN_CODE in Netlify (Site configuration > Environment variables), then redeploy.', configured: false });
  }
  const sent = (event.headers && (event.headers['x-admin-code'] || event.headers['X-Admin-Code'])) || '';
  if (sent !== adminCode) return reply(401, { error: 'That admin code did not match.', configured: true });

  const q = event.queryStringParameters || {};
  const days = Math.max(1, Math.min(90, parseInt(q.days, 10) || 30));
  try { return reply(200, await summary(store, days)); }
  catch (e) { return reply(500, { error: 'Could not read the visit log.', detail: String(e.message || e) }); }
};
