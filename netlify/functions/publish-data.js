/* ==========================================================================
   PUBLISH TEAM STATS TO EVERY DEVICE

   Uploading a CSV only ever changed the browser it was uploaded from. The
   shared copy is data/team.json, and until now getting stats into it meant
   downloading a file and committing it by hand - so a coach could update
   stats on a laptop, see them, and have nobody else see anything.

   This commits data/team.json directly. Netlify redeploys on the push and
   every device picks it up on next load, because the app already re-reads
   that file on boot and when a tab regains focus.

   Same environment variables as upload-photo:
     GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH (optional),
     TEAM_CODE (optional gate - unset means anyone who finds this can post)
   ========================================================================== */

const MAX_BYTES = 4 * 1024 * 1024;   // team.json is ~300KB; this is headroom

function reply(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}

exports.handler = async function (event) {
  const cfg = {
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH || 'main',
    code: process.env.TEAM_CODE
  };

  if (event.httpMethod === 'GET') {
    const missing = [];
    if (!cfg.token) missing.push('GITHUB_TOKEN');
    if (!cfg.repo) missing.push('GITHUB_REPO');
    return reply(200, {
      deployed: true,
      configured: missing.length === 0,
      missing,
      codeRequired: !!cfg.code
    });
  }

  if (event.httpMethod !== 'POST') return reply(405, { error: 'Use POST' });

  if (!cfg.token || !cfg.repo) {
    return reply(503, {
      error: 'Publishing is not set up yet.',
      detail: 'The site needs GITHUB_TOKEN and GITHUB_REPO set in Netlify.'
    });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return reply(400, { error: 'Could not read that request.' }); }

  if (cfg.code && payload.code !== cfg.code) {
    return reply(401, { error: 'That team code is not right.' });
  }
  if (!cfg.code) {
    const origin = event.headers.origin || event.headers.referer || '';
    const host = event.headers.host || '';
    if (origin && host && origin.indexOf(host) < 0) {
      return reply(403, { error: 'Publishing only works from the team site.' });
    }
  }

  const bundle = payload.bundle;
  if (!bundle || typeof bundle !== 'object' || !bundle.data) {
    return reply(400, { error: 'No stats in that request.' });
  }

  /* Refuse to publish an empty set. Overwriting a good season with nothing
     because a browser had cleared its storage would be the worst possible
     failure here, and it is a cheap thing to guard against. */
  const cats = ['batting', 'pitching', 'fielding', 'catching'];
  const blocks = cats.reduce(function (n, c) {
    return n + Object.keys((bundle.data && bundle.data[c]) || {}).length;
  }, 0);
  if (!blocks && !(bundle.games && bundle.games.length)) {
    return reply(400, {
      error: 'Nothing to publish.',
      detail: 'That would replace the live stats with an empty file.'
    });
  }

  const json = JSON.stringify(bundle, null, 2);
  if (Buffer.byteLength(json, 'utf8') > MAX_BYTES) {
    return reply(413, { error: 'That is too much data to publish at once.' });
  }

  const path = 'data/team.json';
  const api = `https://api.github.com/repos/${cfg.repo}/contents/${path}`;
  const auth = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'prospects-prime-publish'
  };

  try {
    /* Read-then-write, retried once. Two coaches publishing within seconds
       of each other collide on the SHA otherwise. */
    for (let attempt = 0; attempt < 2; attempt++) {
      let sha = null;
      const head = await fetch(`${api}?ref=${encodeURIComponent(cfg.branch)}`, { headers: auth });
      if (head.ok) sha = (await head.json()).sha;
      else if (head.status !== 404) throw new Error(`GitHub read failed (${head.status})`);

      const body = {
        message: 'Publish team stats' + (payload.note ? ' - ' + String(payload.note).slice(0, 60) : ''),
        content: Buffer.from(json, 'utf8').toString('base64'),
        branch: cfg.branch
      };
      if (sha) body.sha = sha;

      const res = await fetch(api, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        return reply(200, {
          ok: true,
          blocks,
          message: 'Published. Every device picks it up within a minute or two.'
        });
      }
      if (res.status !== 409) {
        const text = await res.text();
        throw new Error(`GitHub write failed (${res.status}): ${text.slice(0, 160)}`);
      }
    }
    throw new Error('The file is busy, try again in a moment');
  } catch (err) {
    return reply(502, {
      error: 'Could not publish.',
      detail: String(err.message || err).slice(0, 200)
    });
  }
};
