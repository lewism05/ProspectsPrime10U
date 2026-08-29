/* ==========================================================================
   UPLOAD A PLAYER PHOTO FOR THE WHOLE TEAM

   A static site has no server, so a photo a parent adds on their phone
   cannot reach anyone else. This is that server - one small function.

   It takes a photo, commits it to assets/players/<slug>.jpg in the repo,
   and adds the player to data/photos.json. Netlify redeploys on the push,
   and about a minute later the photo is on every device.

   Nothing secret ever reaches the browser. The GitHub token lives only in
   Netlify's environment variables, and only this function can read it.

   Required environment variables (Netlify > Site configuration >
   Environment variables):

     GITHUB_TOKEN   fine-grained token, THIS REPO ONLY, Contents: Read+Write
     GITHUB_REPO    lewism05/ProspectsPrime10U
     GITHUB_BRANCH  optional, defaults to main

     TEAM_CODE      OPTIONAL, and it is the on/off switch for the gate:
                      set   - families must enter it once per device
                      unset - anyone who reaches this URL can upload

   Leaving TEAM_CODE unset is a deliberate trade. The endpoint is named in
   the page source, so with no code anyone who finds it can replace a
   player's photo. Everything is a git commit, so anything unwanted is one
   revert away - but it would be live on the site until somebody noticed.
   Set TEAM_CODE again at any time to close it back up; no code change.
   ========================================================================== */

const MAX_BYTES = 700 * 1024;          // generous; the client sends ~80KB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function reply(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}

/* One GitHub Contents API write. Reads the current SHA first because an
   update needs it; a 404 there just means we are creating the file. */
async function putFile(cfg, path, contentB64, message) {
  const api = `https://api.github.com/repos/${cfg.repo}/contents/${path}`;
  const auth = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'prospects-prime-photo-upload'
  };

  let sha = null;
  const head = await fetch(`${api}?ref=${encodeURIComponent(cfg.branch)}`, { headers: auth });
  if (head.ok) sha = (await head.json()).sha;
  else if (head.status !== 404) {
    throw new Error(`GitHub read failed (${head.status})`);
  }

  const body = { message, content: contentB64, branch: cfg.branch };
  if (sha) body.sha = sha;

  const res = await fetch(api, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub write failed (${res.status}): ${text.slice(0, 180)}`);
  }
  return res.json();
}

/* Read the manifest, add this player, write it back. Retried once because
   two parents uploading at the same moment will collide on the SHA. */
async function addToManifest(cfg, slug) {
  const path = 'data/photos.json';
  const api = `https://api.github.com/repos/${cfg.repo}/contents/${path}`;
  const auth = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'prospects-prime-photo-upload'
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    let players = [];
    let sha = null;

    const head = await fetch(`${api}?ref=${encodeURIComponent(cfg.branch)}`, { headers: auth });
    if (head.ok) {
      const meta = await head.json();
      sha = meta.sha;
      try {
        const parsed = JSON.parse(Buffer.from(meta.content, 'base64').toString('utf8'));
        if (Array.isArray(parsed.players)) players = parsed.players;
      } catch (e) { /* corrupt or empty manifest: rebuild it */ }
    }

    if (players.includes(slug)) return { unchanged: true };

    players.push(slug);
    players.sort();

    const next = Buffer.from(JSON.stringify({
      note: 'Slugs of players who have a team photo in assets/players/.',
      players
    }, null, 2)).toString('base64');

    const body = {
      message: `Add ${slug} to the photo manifest`,
      content: next,
      branch: cfg.branch
    };
    if (sha) body.sha = sha;

    const res = await fetch(api, {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) return res.json();
    if (res.status !== 409) {
      throw new Error(`Manifest write failed (${res.status})`);
    }
    // 409: somebody else wrote it between our read and write. Read again.
  }
  throw new Error('Manifest is busy, try again in a moment');
}

exports.handler = async function (event) {
  const cfg = {
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH || 'main',
    code: process.env.TEAM_CODE
  };

  /* A GET reports whether uploads are actually usable, not merely whether
     this file got deployed. The client needs the difference: a deployed but
     unconfigured function means the Share button would fail every time, and
     a button that cannot work should not be on screen. No secrets here -
     only whether each variable is present. */
  if (event.httpMethod === 'GET') {
    const missing = [];
    if (!cfg.token) missing.push('GITHUB_TOKEN');
    if (!cfg.repo) missing.push('GITHUB_REPO');
    return reply(200, {
      deployed: true,
      configured: missing.length === 0,
      missing: missing,
      // The client only prompts when there is actually a code to enter.
      codeRequired: !!cfg.code
    });
  }

  if (event.httpMethod !== 'POST') return reply(405, { error: 'Use POST' });

  if (!cfg.token || !cfg.repo) {
    return reply(503, {
      error: 'Team photo uploads are not set up yet.',
      detail: 'Ask your coach - the site needs GITHUB_TOKEN and GITHUB_REPO set in Netlify.'
    });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return reply(400, { error: 'Could not read that request.' }); }

  const { player, image, code } = payload;

  /* The code is enforced only when one is configured. With TEAM_CODE unset
     the gate is deliberately open - see the note at the top of this file. */
  if (cfg.code && code !== cfg.code) {
    return reply(401, { error: 'That team code is not right.' });
  }

  /* With no code, this is the only thing standing between the endpoint and
     a passing script. A browser cannot forge Origin, so it blocks casual
     drive-by abuse from another site. It does NOT stop anything running
     outside a browser, where headers are whatever the caller says they
     are - it is a speed bump, not a lock. */
  if (!cfg.code) {
    const origin = event.headers.origin || event.headers.referer || '';
    const host = event.headers.host || '';
    if (origin && host && origin.indexOf(host) < 0) {
      return reply(403, { error: 'Uploads only work from the team site.' });
    }
  }

  if (!player || typeof player !== 'string') return reply(400, { error: 'Which player is this?' });
  const slug = slugify(player);
  if (!slug) return reply(400, { error: 'That player name is not usable as a filename.' });

  if (typeof image !== 'string') return reply(400, { error: 'No image received.' });
  const m = /^data:([a-z/+.-]+);base64,(.+)$/i.exec(image);
  if (!m) return reply(400, { error: 'That image is not in the expected format.' });

  const mime = m[1].toLowerCase();
  if (!ALLOWED.includes(mime)) {
    return reply(415, { error: 'Photos need to be a JPEG, PNG or WebP.' });
  }

  const b64 = m[2];
  const bytes = Math.floor(b64.length * 3 / 4);
  if (bytes > MAX_BYTES) {
    return reply(413, { error: 'That photo is too big. Try a smaller one.' });
  }

  try {
    await putFile(
      cfg,
      `assets/players/${slug}.jpg`,
      b64,
      `Team photo for ${player}`
    );
    await addToManifest(cfg, slug);

    return reply(200, {
      ok: true,
      slug,
      message: 'Photo added for the whole team. It will be live in about a minute.'
    });
  } catch (err) {
    return reply(502, {
      error: 'Could not save that photo.',
      detail: String(err.message || err).slice(0, 200)
    });
  }
};
