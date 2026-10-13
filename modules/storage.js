// Skladište fotografija: dva izvora – vaš disk (lokalni ili Samba folder montiran na server)
// i Google Drive (fascikla koju panel sam napravi). Stavka se u meniju pojavljuje tek kada se
// bar jedno skladište podesi.
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const crypto = require('crypto');
const multer = require('multer');

const IMG_RE = /\.(jpe?g|png|webp|gif|heic|heif|tiff?|bmp)$/i;
const SKIP_RE = /^(\.|@eaDir$|Thumbs\.db$|desktop\.ini$)/i; // skriveni i sistemski fajlovi
const TRASH = '_kanta';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
// Adrese Google servisa (u testu se preusmeravaju na probni server)
const OAUTH = process.env.GOOGLE_OAUTH_BASE || 'https://oauth2.googleapis.com';
const GAPI = process.env.GOOGLE_API_BASE || 'https://www.googleapis.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

module.exports = (ctx) => {
  const { app, store, sharp, requireAdmin, adminOnly } = ctx;
  const clean = (v, n = 300) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
  const safeName = (n) => path.basename(String(n || 'fajl')).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').slice(0, 180) || 'fajl';

  // ---------- podešavanja ----------
  const cfg = () => {
    const d = store.data;
    d.storage ||= {};
    d.storage.disk ||= { enabled: false, label: 'Naš disk', path: '' };
    d.storage.google ||= { enabled: false, label: 'Google Drive', clientId: '', clientSecret: '', refreshToken: '', rootId: '', rootName: 'Teodora Studio', email: '' };
    return d.storage;
  };
  const diskOn = () => !!(cfg().disk.enabled && cfg().disk.path);
  const googleOn = () => !!(cfg().google.enabled && cfg().google.refreshToken);
  ctx.services.storage = { enabled: () => diskOn() || googleOn() };

  const CACHE = path.join(ctx.DATA_DIR, 'stcache');
  fs.mkdirSync(CACHE, { recursive: true });

  // =====================================================================
  //  Izvor 1: disk (lokalni ili Samba montiran na server)
  // =====================================================================
  function root() {
    const p = cfg().disk.path;
    if (!p) throw new Error('Skladište na disku nije podešeno.');
    return path.resolve(p);
  }
  // Sve ostaje unutar podešene fascikle: ".." i putanje van korena se odbijaju.
  function resolveIn(rel) {
    const base = root();
    const full = path.resolve(base, '.' + path.posix.normalize('/' + String(rel || '/')));
    if (full !== base && !full.startsWith(base + path.sep)) throw new Error('Nedozvoljena putanja.');
    return full;
  }
  const toRel = (full) => {
    const r = path.relative(root(), full).split(path.sep).join('/');
    return '/' + (r === '' ? '' : r);
  };
  async function stats(p) {
    try {
      return await fsp.stat(p);
    } catch {
      return null;
    }
  }
  const entry = (name, st, rel) => ({
    name,
    path: rel,
    type: st.isDirectory() ? 'folder' : 'file',
    size: st.isDirectory() ? null : st.size,
    at: st.mtimeMs,
    image: !st.isDirectory() && IMG_RE.test(name),
  });

  const disk = {
    id: 'disk',
    on: diskOn,
    label: () => cfg().disk.label || 'Naš disk',

    async status() {
      const c = cfg().disk;
      const out = { enabled: !!c.enabled, label: c.label || 'Naš disk', path: c.path || '', ok: false, writable: false, error: '', free: null, total: null };
      if (!c.path) return out;
      try {
        const st = await fsp.stat(c.path);
        if (!st.isDirectory()) {
          out.error = 'Putanja postoji, ali nije fascikla.';
          return out;
        }
        out.ok = true;
        await fsp.access(c.path, fs.constants.W_OK).then(() => (out.writable = true)).catch(() => {});
        if (fsp.statfs) {
          const f = await fsp.statfs(c.path).catch(() => null);
          if (f) {
            out.total = Number(f.blocks) * Number(f.bsize);
            out.free = Number(f.bavail) * Number(f.bsize);
          }
        }
      } catch (e) {
        out.error = e.code === 'ENOENT' ? 'Fascikla ne postoji na serveru.' : e.message;
      }
      return out;
    },

    async list(p, q) {
      const dir = resolveIn(p || '/');
      const items = [];
      if (q) {
        const needle = q.toLowerCase();
        const stack = [dir];
        let seen = 0;
        while (stack.length && items.length < 400 && seen < 20000) {
          const cur = stack.shift();
          const list = await fsp.readdir(cur, { withFileTypes: true }).catch(() => []);
          for (const d of list) {
            if (SKIP_RE.test(d.name) || d.name === TRASH) continue;
            seen++;
            const full = path.join(cur, d.name);
            if (d.isDirectory()) stack.push(full);
            if (d.name.toLowerCase().includes(needle)) {
              const st = await stats(full);
              if (st) items.push(entry(d.name, st, toRel(full)));
            }
          }
        }
      } else {
        for (const d of await fsp.readdir(dir, { withFileTypes: true })) {
          if (SKIP_RE.test(d.name)) continue;
          const full = path.join(dir, d.name);
          const st = await stats(full);
          if (st) items.push(entry(d.name, st, toRel(full)));
        }
      }
      items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'sr') : a.type === 'folder' ? -1 : 1));
      const rel = toRel(dir);
      const crumbs = [{ path: '/', name: disk.label() }];
      let acc = '';
      for (const part of rel.split('/').filter(Boolean)) {
        acc += '/' + part;
        crumbs.push({ path: acc, name: part });
      }
      return { path: rel, crumbs, items, truncated: items.length >= 400 };
    },

    async sendFile(res, p, download) {
      const full = resolveIn(p);
      const st = await stats(full);
      if (!st || !st.isFile()) throw new Error('Fajl ne postoji.');
      if (download) return res.download(full);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.sendFile(full);
    },

    // vraća lokalni fajl za pravljenje sličice (original ostaje na mestu)
    async localCopy(p) {
      const full = resolveIn(p);
      const st = await stats(full);
      if (!st || !st.isFile()) throw new Error('Fajl ne postoji.');
      return { file: full, temp: false, key: full + st.mtimeMs + st.size };
    },

    async upload(p, files) {
      const dir = resolveIn(p || '/');
      const st = await stats(dir);
      if (!st || !st.isDirectory()) throw new Error('Fascikla ne postoji.');
      const added = [];
      for (const f of files) {
        const name = safeName(f.originalname);
        const ext = path.extname(name);
        const base = name.slice(0, name.length - ext.length);
        let target = path.join(dir, name);
        for (let i = 2; fs.existsSync(target); i++) target = path.join(dir, `${base} (${i})${ext}`);
        await fsp.rename(f.path, target).catch(async () => {
          await fsp.copyFile(f.path, target);
          await fsp.rm(f.path, { force: true });
        });
        added.push(path.basename(target));
      }
      return added;
    },

    async mkdir(p, name) {
      const dir = resolveIn(path.posix.join(p || '/', name));
      await fsp.mkdir(dir, { recursive: false });
      return toRel(dir);
    },

    async rename(p, name) {
      const from = resolveIn(p);
      const to = path.join(path.dirname(from), name);
      if (fs.existsSync(to)) throw new Error('To ime je već zauzeto.');
      await fsp.rename(from, to);
      return toRel(to);
    },

    async move(items, to) {
      const dest = resolveIn(to || '/');
      const st = await stats(dest);
      if (!st || !st.isDirectory()) throw new Error('Odredišna fascikla ne postoji.');
      let moved = 0;
      for (const it of items) {
        const from = resolveIn(it);
        if (from === dest || dest.startsWith(from + path.sep)) continue;
        let target = path.join(dest, path.basename(from));
        const ext = path.extname(target);
        const base = target.slice(0, target.length - ext.length);
        for (let i = 2; fs.existsSync(target); i++) target = `${base} (${i})${ext}`;
        await fsp.rename(from, target).catch(() => {});
        moved++;
      }
      return moved;
    },

    // brisanje ide u fasciklu _kanta unutar skladišta
    async remove(items) {
      const trash = path.join(root(), TRASH, new Date().toISOString().slice(0, 10));
      await fsp.mkdir(trash, { recursive: true });
      let n = 0;
      for (const it of items) {
        const from = resolveIn(it);
        if (from === root() || path.basename(from) === TRASH) continue;
        let to = path.join(trash, path.basename(from));
        for (let i = 2; fs.existsSync(to); i++) to = path.join(trash, `${path.basename(from)} (${i})`);
        await fsp.rename(from, to).catch(async (e) => {
          if (e.code === 'EXDEV') {
            await fsp.cp(from, to, { recursive: true });
            await fsp.rm(from, { recursive: true, force: true });
          }
        });
        n++;
      }
      return n;
    },

    // fajlovi za slanje klijentu (fascikla = svi fajlovi iz nje)
    async sources(items) {
      const out = [];
      for (const p of items) {
        const full = resolveIn(p);
        const st = await stats(full);
        if (!st) continue;
        if (st.isDirectory()) {
          for (const d of await fsp.readdir(full, { withFileTypes: true })) {
            if (d.isFile() && !SKIP_RE.test(d.name)) out.push({ path: path.join(full, d.name), name: d.name });
          }
        } else out.push({ path: full, name: path.basename(full) });
      }
      return { sources: out, cleanup: async () => {} };
    },
  };

  // =====================================================================
  //  Izvor 2: Google Drive (povezivanje kodom, bez domena i sertifikata)
  // =====================================================================
  let token = { access: '', exp: 0 };
  let device = null; // povezivanje u toku

  const form = (o) => new URLSearchParams(o).toString();
  async function gjson(r) {
    const t = await r.text();
    let j = {};
    try {
      j = t ? JSON.parse(t) : {};
    } catch {}
    if (!r.ok) throw new Error(j.error_description || j.error?.message || j.error || `Google greška ${r.status}`);
    return j;
  }

  // Mrežna greška se objašnjava ljudski (server bez interneta, Google nedostupan...)
  const netErr = (e) => new Error(/fetch failed|ENOTFOUND|ECONN|EAI_AGAIN|timeout/i.test(e.message) ? 'Server trenutno ne može da pristupi Google-u (proverite internet vezu servera).' : e.message);

  async function access() {
    const g = cfg().google;
    if (!g.refreshToken) throw new Error('Google Drive nije povezan.');
    if (token.access && token.exp > Date.now() + 60000) return token.access;
    let j;
    try {
      j = await gjson(
        await fetch(`${OAUTH}/token`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: form({ client_id: g.clientId, client_secret: g.clientSecret, refresh_token: g.refreshToken, grant_type: 'refresh_token' }),
        })
      );
    } catch (e) {
      if (/invalid_grant|unauthorized_client|invalid_client/i.test(e.message)) {
        throw new Error('Veza sa Google Drive-om više ne važi – povežite ga ponovo u Podešavanjima.');
      }
      throw netErr(e);
    }
    token = { access: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
    return token.access;
  }

  async function gapi(url, opts = {}) {
    const a = await access();
    try {
      return await fetch(url.startsWith('http') ? url : GAPI + url, {
        ...opts,
        headers: { authorization: 'Bearer ' + a, ...(opts.headers || {}) },
      });
    } catch (e) {
      throw netErr(e);
    }
  }
  const gcall = async (url, opts) => gjson(await gapi(url, opts));

  const FIELDS = 'id,name,mimeType,size,modifiedTime,thumbnailLink,parents';

  async function ensureRoot() {
    const g = cfg().google;
    if (g.rootId) {
      const r = await gapi(`/drive/v3/files/${g.rootId}?fields=id,name,trashed`);
      if (r.ok) {
        const j = await r.json();
        if (!j.trashed) return g.rootId;
      }
    }
    const name = g.rootName || 'Teodora Studio';
    const found = await gcall(`/drive/v3/files?q=${encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and trashed=false`)}&fields=files(id,name)&pageSize=10`);
    let id = found.files?.[0]?.id;
    if (!id) {
      const made = await gcall('/drive/v3/files?fields=id', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
      });
      id = made.id;
    }
    g.rootId = id;
    store.save();
    return id;
  }

  const gItem = (f) => ({
    name: f.name,
    path: f.id,
    type: f.mimeType === FOLDER_MIME ? 'folder' : 'file',
    size: f.size ? Number(f.size) : null,
    at: f.modifiedTime ? Date.parse(f.modifiedTime) : null,
    image: f.mimeType !== FOLDER_MIME && (IMG_RE.test(f.name || '') || String(f.mimeType || '').startsWith('image/')),
  });

  const google = {
    id: 'google',
    on: googleOn,
    label: () => cfg().google.label || 'Google Drive',

    async status() {
      const g = cfg().google;
      const out = {
        enabled: !!g.enabled,
        label: g.label || 'Google Drive',
        connected: !!g.refreshToken,
        hasApp: !!(g.clientId && g.clientSecret),
        email: g.email || '',
        rootName: g.rootName || 'Teodora Studio',
        error: '',
        pending: device ? { code: device.user_code, url: device.verification_url, expiresAt: device.expiresAt } : null,
      };
      if (g.refreshToken) {
        try {
          await access();
        } catch (e) {
          out.error = e.message;
        }
      }
      return out;
    },

    async list(p, q) {
      const rootId = await ensureRoot();
      const folder = p && p !== '/' ? p : rootId;
      const query = q
        ? `name contains '${q.replace(/'/g, "\\'")}' and trashed=false`
        : `'${folder}' in parents and trashed=false`;
      const j = await gcall(`/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(${FIELDS})&pageSize=400&orderBy=folder,name`);
      const items = (j.files || []).map(gItem);
      // putanja do fascikle (za navigaciju gore)
      const crumbs = [{ path: rootId, name: google.label() }];
      if (folder !== rootId) {
        const chain = [];
        let cur = folder;
        for (let i = 0; i < 10 && cur && cur !== rootId; i++) {
          const f = await gcall(`/drive/v3/files/${cur}?fields=id,name,parents`).catch(() => null);
          if (!f) break;
          chain.unshift({ path: f.id, name: f.name });
          cur = f.parents?.[0];
        }
        crumbs.push(...chain);
      }
      return { path: folder, crumbs, items, truncated: items.length >= 400 };
    },

    async sendFile(res, id, download) {
      const meta = await gcall(`/drive/v3/files/${id}?fields=name,mimeType,size`);
      const r = await gapi(`/drive/v3/files/${id}?alt=media`);
      if (!r.ok) throw new Error('Fajl nije dostupan na Drive-u.');
      res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
      if (meta.size) res.setHeader('Content-Length', meta.size);
      if (download) res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`);
      const buf = Buffer.from(await r.arrayBuffer());
      res.end(buf);
    },

    async localCopy(id) {
      const meta = await gcall(`/drive/v3/files/${id}?fields=name,size,modifiedTime`);
      const tmp = path.join(os.tmpdir(), 'st-' + crypto.randomBytes(8).toString('hex') + path.extname(meta.name || ''));
      const r = await gapi(`/drive/v3/files/${id}?alt=media`);
      if (!r.ok) throw new Error('Fajl nije dostupan na Drive-u.');
      await fsp.writeFile(tmp, Buffer.from(await r.arrayBuffer()));
      return { file: tmp, temp: true, key: id + (meta.modifiedTime || '') + (meta.size || ''), name: meta.name };
    },

    async upload(p, files) {
      const parent = p && p !== '/' ? p : await ensureRoot();
      const added = [];
      for (const f of files) {
        const name = safeName(f.originalname);
        const meta = JSON.stringify({ name, parents: [parent] });
        const body = await fsp.readFile(f.path);
        const boundary = '----teodora' + crypto.randomBytes(8).toString('hex');
        const head = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${f.mimetype || 'application/octet-stream'}\r\n\r\n`);
        const tail = Buffer.from(`\r\n--${boundary}--`);
        const r = await gapi('/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
          method: 'POST',
          headers: { 'content-type': `multipart/related; boundary=${boundary}` },
          body: Buffer.concat([head, body, tail]),
        });
        const j = await gjson(r);
        await fsp.rm(f.path, { force: true });
        added.push(j.name || name);
      }
      return added;
    },

    async mkdir(p, name) {
      const parent = p && p !== '/' ? p : await ensureRoot();
      const j = await gcall('/drive/v3/files?fields=id', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] }),
      });
      return j.id;
    },

    async rename(id, name) {
      await gcall(`/drive/v3/files/${id}?fields=id`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      return id;
    },

    async move(items, to) {
      const dest = to && to !== '/' ? to : await ensureRoot();
      let moved = 0;
      for (const id of items) {
        const f = await gcall(`/drive/v3/files/${id}?fields=parents`).catch(() => null);
        if (!f) continue;
        const prev = (f.parents || []).join(',');
        await gapi(`/drive/v3/files/${id}?addParents=${dest}${prev ? '&removeParents=' + prev : ''}&fields=id`, { method: 'PATCH' });
        moved++;
      }
      return moved;
    },

    // na Drive-u brisanje ide u Google kantu, odakle se vraća u roku od 30 dana
    async remove(items) {
      let n = 0;
      for (const id of items) {
        await gcall(`/drive/v3/files/${id}?fields=id`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ trashed: true }),
        }).catch(() => {});
        n++;
      }
      return n;
    },

    async sources(items) {
      const temps = [];
      const out = [];
      for (const id of items) {
        const meta = await gcall(`/drive/v3/files/${id}?fields=id,name,mimeType`).catch(() => null);
        if (!meta) continue;
        if (meta.mimeType === FOLDER_MIME) {
          const j = await gcall(`/drive/v3/files?q=${encodeURIComponent(`'${id}' in parents and trashed=false`)}&fields=files(id,name,mimeType)&pageSize=400`);
          for (const f of j.files || []) {
            if (f.mimeType === FOLDER_MIME) continue;
            const c = await google.localCopy(f.id);
            temps.push(c.file);
            out.push({ path: c.file, name: f.name });
          }
        } else {
          const c = await google.localCopy(id);
          temps.push(c.file);
          out.push({ path: c.file, name: meta.name });
        }
      }
      return { sources: out, cleanup: async () => Promise.all(temps.map((t) => fsp.rm(t, { force: true }).catch(() => {}))) };
    },
  };

  const PROV = (name) => (name === 'google' ? google : disk);
  const useProv = (req) => {
    const name = clean(req.query?.provider || req.body?.provider, 10) === 'google' ? 'google' : 'disk';
    const p = PROV(name);
    if (!p.on()) throw new Error(name === 'google' ? 'Google Drive nije povezan.' : 'Skladište na disku nije podešeno.');
    return p;
  };

  // =====================================================================
  //  Podešavanja
  // =====================================================================
  app.get('/api/admin/storage/config', requireAdmin, async (req, res) => {
    res.json({ disk: await disk.status(), google: await google.status() });
  });

  app.put('/api/admin/storage/config', adminOnly, async (req, res) => {
    const b = req.body || {};
    const c = cfg();
    if (b.disk) {
      if (b.disk.path !== undefined) c.disk.path = clean(b.disk.path, 400);
      if (b.disk.label !== undefined) c.disk.label = clean(b.disk.label, 60) || 'Naš disk';
      if (b.disk.enabled !== undefined) c.disk.enabled = !!b.disk.enabled;
    }
    if (b.google) {
      if (b.google.label !== undefined) c.google.label = clean(b.google.label, 60) || 'Google Drive';
      if (b.google.rootName !== undefined) c.google.rootName = clean(b.google.rootName, 80) || 'Teodora Studio';
      if (b.google.enabled !== undefined) c.google.enabled = !!b.google.enabled;
    }
    store.save();
    const st = await disk.status();
    if (c.disk.enabled && !st.ok) {
      c.disk.enabled = false;
      store.save();
      return res.status(400).json({ error: st.error || 'Fascikla nije dostupna.', disk: { ...st, enabled: false }, google: await google.status() });
    }
    res.json({ disk: st, google: await google.status() });
  });

  // ---------- povezivanje sa Google Drive-om (kodom, bez domena) ----------
  app.post('/api/admin/storage/google/start', adminOnly, async (req, res) => {
    const g = cfg().google;
    const id = clean(req.body?.clientId, 200) || g.clientId;
    const secret = clean(req.body?.clientSecret, 200) || g.clientSecret;
    if (!id || !secret) return res.status(400).json({ error: 'Upišite Client ID i Client secret iz Google Cloud-a.' });
    try {
      const j = await gjson(
        await fetch(`${OAUTH}/device/code`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: form({ client_id: id, scope: DRIVE_SCOPE }),
        })
      );
      g.clientId = id;
      g.clientSecret = secret;
      store.save();
      device = {
        device_code: j.device_code,
        user_code: j.user_code,
        verification_url: j.verification_url || j.verification_uri || 'https://www.google.com/device',
        interval: Math.max(5, Number(j.interval) || 5),
        expiresAt: Date.now() + (Number(j.expires_in) || 1800) * 1000,
      };
      res.json({ code: device.user_code, url: device.verification_url, expiresAt: device.expiresAt });
    } catch (e) {
      res.status(400).json({ error: /fetch failed|ENOTFOUND|ECONN/i.test(e.message) ? 'Server ne može da pristupi Google-u (proverite internet vezu servera).' : e.message });
    }
  });

  app.post('/api/admin/storage/google/poll', adminOnly, async (req, res) => {
    if (!device) return res.status(400).json({ error: 'Povezivanje nije započeto.' });
    if (device.expiresAt < Date.now()) {
      device = null;
      return res.status(400).json({ error: 'Kod je istekao – pokrenite povezivanje ponovo.' });
    }
    const g = cfg().google;
    try {
      const r = await fetch(`${OAUTH}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form({ client_id: g.clientId, client_secret: g.clientSecret, device_code: device.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j.error === 'authorization_pending' || j.error === 'slow_down') return res.json({ waiting: true });
        device = null;
        return res.status(400).json({ error: j.error_description || j.error || 'Povezivanje nije uspelo.' });
      }
      g.refreshToken = j.refresh_token || g.refreshToken;
      g.enabled = true;
      token = { access: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
      device = null;
      store.save();
      // naziv naloga i fascikla za fotografije
      try {
        const about = await gcall('/drive/v3/about?fields=user(emailAddress)');
        g.email = about.user?.emailAddress || '';
      } catch {}
      await ensureRoot().catch(() => {});
      store.save();
      res.json({ ok: true, google: await google.status() });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/admin/storage/google/disconnect', adminOnly, async (req, res) => {
    const g = cfg().google;
    Object.assign(g, { refreshToken: '', rootId: '', email: '', enabled: false });
    token = { access: '', exp: 0 };
    device = null;
    store.save();
    res.json({ ok: true, google: await google.status() });
  });

  // =====================================================================
  //  Pregled i rad sa fajlovima (isti za oba izvora)
  // =====================================================================
  app.get('/api/admin/storage/list', requireAdmin, async (req, res) => {
    try {
      const p = useProv(req);
      const out = await p.list(clean(req.query.p, 400), clean(req.query.q, 80));
      res.json({ ...out, provider: p.id, label: p.label(), providers: list() });
    } catch (e) {
      res.status(400).json({ error: e.message, providers: list() });
    }
  });

  const list = () => [
    ...(diskOn() ? [{ id: 'disk', label: disk.label() }] : []),
    ...(googleOn() ? [{ id: 'google', label: google.label() }] : []),
  ];

  app.get('/api/admin/storage/providers', requireAdmin, (req, res) => res.json({ providers: list() }));

  app.get('/api/admin/storage/file', requireAdmin, async (req, res) => {
    try {
      const p = useProv(req);
      await p.sendFile(res, clean(req.query.p, 400), req.query.dl === '1');
    } catch (e) {
      if (!res.headersSent) res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/admin/storage/thumb', requireAdmin, async (req, res) => {
    if (!sharp) return res.status(404).end();
    let copy = null;
    try {
      const p = useProv(req);
      copy = await p.localCopy(clean(req.query.p, 400));
      const big = req.query.s === 'l';
      const key = crypto.createHash('sha1').update(copy.key + (big ? 'l' : 's')).digest('hex');
      const out = path.join(CACHE, key + '.webp');
      if (!fs.existsSync(out)) {
        await sharp(copy.file)
          .rotate()
          .resize(big ? 1600 : 360, big ? 1600 : 360, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: big ? 80 : 70 })
          .toFile(out);
      }
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.sendFile(out);
    } catch {
      if (!res.headersSent) res.status(404).end();
    } finally {
      if (copy?.temp) fsp.rm(copy.file, { force: true }).catch(() => {});
    }
  });

  const upload = multer({
    dest: path.join(os.tmpdir(), 'st-up'),
    limits: { fileSize: (Number(ctx.MAX_FILE_MB) || 10240) * 1024 * 1024 },
  });

  app.post('/api/admin/storage/upload', requireAdmin, (req, res) => {
    upload.array('files', 500)(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Fajl je prevelik.' : err.message });
      try {
        const p = useProv(req);
        const added = await p.upload(clean(req.query.p, 400), req.files || []);
        res.json({ added });
      } catch (e) {
        for (const f of req.files || []) await fsp.rm(f.path, { force: true }).catch(() => {});
        res.status(400).json({ error: e.message });
      }
    });
  });

  app.post('/api/admin/storage/folder', requireAdmin, async (req, res) => {
    try {
      const p = useProv(req);
      const name = clean(req.body?.name, 120).replace(/[\\/]/g, '');
      if (!name) return res.status(400).json({ error: 'Upišite naziv fascikle.' });
      res.json({ ok: true, path: await p.mkdir(clean(req.body?.p, 400), name) });
    } catch (e) {
      res.status(400).json({ error: e.code === 'EEXIST' ? 'Fascikla sa tim imenom već postoji.' : e.message });
    }
  });

  app.post('/api/admin/storage/rename', requireAdmin, async (req, res) => {
    try {
      const p = useProv(req);
      const name = clean(req.body?.name, 180).replace(/[\\/]/g, '');
      if (!name) return res.status(400).json({ error: 'Upišite novo ime.' });
      res.json({ ok: true, path: await p.rename(clean(req.body?.p, 400), name) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/admin/storage/move', requireAdmin, async (req, res) => {
    try {
      const p = useProv(req);
      const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500).map((x) => clean(x, 400)) : [];
      res.json({ moved: await p.move(items, clean(req.body?.to, 400)) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/admin/storage/delete', requireAdmin, async (req, res) => {
    try {
      const p = useProv(req);
      const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500).map((x) => clean(x, 400)) : [];
      res.json({ moved: await p.remove(items), trash: p.id === 'google' ? 'Google kanta' : '/' + TRASH });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/admin/storage/trash/empty', adminOnly, async (req, res) => {
    try {
      await fsp.rm(path.join(root(), TRASH), { recursive: true, force: true });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ---------- slanje klijentu, vezano za zakazivanje ----------
  app.post('/api/admin/storage/send', requireAdmin, async (req, res) => {
    const b = req.body || {};
    let cleanup = async () => {};
    try {
      const p = useProv(req);
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 500).map((x) => clean(x, 400));
      const got = await p.sources(items);
      cleanup = got.cleanup;
      if (!got.sources.length) return res.status(400).json({ error: 'Izaberite fotografije koje šaljete.' });

      const t = await ctx.services.transfers.createFromFiles(req, {
        sources: got.sources,
        client: { salutation: b.salutation, firstName: b.firstName, lastName: b.lastName, email: b.email },
        bookingId: clean(b.bookingId, 40) || null,
        message: b.message,
        sendEmail: b.sendEmail !== false,
      });
      res.json(t);
    } catch (e) {
      res.status(400).json({ error: e.message });
    } finally {
      await cleanup();
    }
  });
};
