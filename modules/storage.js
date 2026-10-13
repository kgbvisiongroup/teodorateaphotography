// Skladište fotografija: pregled, pretraga, otpremanje i slanje klijentu sa vašeg diska
// (lokalni disk ili Samba deljeni folder montiran na server). Stavka se u meniju pojavljuje
// tek kada se skladište podesi.
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const multer = require('multer');

const IMG_RE = /\.(jpe?g|png|webp|gif|heic|heif|tiff?|bmp)$/i;
const SKIP_RE = /^(\.|@eaDir$|Thumbs\.db$|desktop\.ini$)/i; // skriveni i sistemski fajlovi
const TRASH = '_kanta';

module.exports = (ctx) => {
  const { app, store, sharp, requireAdmin, adminOnly } = ctx;
  const clean = (v, n = 300) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);

  // ---------- podešavanja ----------
  const cfg = () => {
    const d = store.data;
    d.storage ||= {};
    d.storage.disk ||= { enabled: false, label: 'Naš disk', path: '' };
    return d.storage;
  };
  const diskOn = () => !!(cfg().disk.enabled && cfg().disk.path);
  ctx.services.storage = { enabled: () => diskOn() };

  // ---------- bezbedne putanje ----------
  // Sve ostaje unutar podešene fascikle: ".." i linkovi van korena se odbijaju.
  function root() {
    const p = cfg().disk.path;
    if (!p) throw new Error('Skladište nije podešeno.');
    return path.resolve(p);
  }
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
      const st = await fsp.stat(p);
      return st;
    } catch {
      return null;
    }
  }

  // ---------- stanje skladišta ----------
  async function diskStatus() {
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
  }

  app.get('/api/admin/storage/config', requireAdmin, async (req, res) => {
    res.json({ disk: await diskStatus() });
  });

  app.put('/api/admin/storage/config', adminOnly, async (req, res) => {
    const b = req.body || {};
    const c = cfg().disk;
    if (b.path !== undefined) c.path = clean(b.path, 400);
    if (b.label !== undefined) c.label = clean(b.label, 60) || 'Naš disk';
    if (b.enabled !== undefined) c.enabled = !!b.enabled;
    store.save();
    const st = await diskStatus();
    // Uključeno skladište mora da postoji, inače se gasi i javlja greška
    if (c.enabled && !st.ok) {
      c.enabled = false;
      store.save();
      return res.status(400).json({ error: st.error || 'Fascikla nije dostupna.', disk: { ...st, enabled: false } });
    }
    res.json({ disk: st });
  });

  // ---------- pregled ----------
  const entry = (name, st, rel) => ({
    name,
    path: rel,
    type: st.isDirectory() ? 'folder' : 'file',
    size: st.isDirectory() ? null : st.size,
    at: st.mtimeMs,
    image: !st.isDirectory() && IMG_RE.test(name),
  });

  app.get('/api/admin/storage/list', requireAdmin, async (req, res) => {
    if (!diskOn()) return res.status(400).json({ error: 'Skladište nije podešeno.' });
    try {
      const rel = clean(req.query.p, 400) || '/';
      const dir = resolveIn(rel);
      const q = clean(req.query.q, 80).toLowerCase();
      const items = [];

      if (q) {
        // Pretraga kroz podfascikle (ograničena, da ne optereti server)
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
            if (d.name.toLowerCase().includes(q)) {
              const st = await stats(full);
              if (st) items.push(entry(d.name, st, toRel(full)));
            }
          }
        }
      } else {
        const list = await fsp.readdir(dir, { withFileTypes: true });
        for (const d of list) {
          if (SKIP_RE.test(d.name)) continue;
          const full = path.join(dir, d.name);
          const st = await stats(full);
          if (st) items.push(entry(d.name, st, toRel(full)));
        }
      }

      items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'sr') : a.type === 'folder' ? -1 : 1));
      res.json({
        path: toRel(dir),
        parent: toRel(dir) === '/' ? null : toRel(path.dirname(dir)),
        label: cfg().disk.label,
        items,
        truncated: items.length >= 400,
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ---------- jedan fajl: pregled, preuzimanje, sličica ----------
  app.get('/api/admin/storage/file', requireAdmin, async (req, res) => {
    if (!diskOn()) return res.status(400).end();
    try {
      const full = resolveIn(clean(req.query.p, 400));
      const st = await stats(full);
      if (!st || !st.isFile()) return res.status(404).json({ error: 'Fajl ne postoji.' });
      if (req.query.dl === '1') return res.download(full);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.sendFile(full);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  const CACHE = path.join(ctx.DATA_DIR, 'stcache');
  fs.mkdirSync(CACHE, { recursive: true });

  app.get('/api/admin/storage/thumb', requireAdmin, async (req, res) => {
    if (!diskOn() || !sharp) return res.status(404).end();
    try {
      const full = resolveIn(clean(req.query.p, 400));
      const st = await stats(full);
      if (!st || !st.isFile()) return res.status(404).end();
      const big = req.query.s === 'l';
      const key = crypto.createHash('sha1').update(full + st.mtimeMs + st.size + (big ? 'l' : 's')).digest('hex');
      const out = path.join(CACHE, key + '.webp');
      if (!fs.existsSync(out)) {
        await sharp(full)
          .rotate()
          .resize(big ? 1600 : 360, big ? 1600 : 360, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: big ? 80 : 70 })
          .toFile(out);
      }
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.sendFile(out);
    } catch {
      res.status(404).end();
    }
  });

  // ---------- otpremanje (prevlačenjem) ----------
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, req.uploadDir),
      filename: (req, file, cb) => cb(null, crypto.randomBytes(10).toString('hex')),
    }),
    limits: { fileSize: (Number(ctx.MAX_FILE_MB) || 10240) * 1024 * 1024 },
  });

  app.post('/api/admin/storage/upload', requireAdmin, async (req, res) => {
    if (!diskOn()) return res.status(400).json({ error: 'Skladište nije podešeno.' });
    let dir;
    try {
      dir = resolveIn(clean(req.query.p, 400) || '/');
      const st = await stats(dir);
      if (!st || !st.isDirectory()) return res.status(400).json({ error: 'Fascikla ne postoji.' });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    req.uploadDir = dir;
    upload.array('files', 500)(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Fajl je prevelik.' : err.message });
      const added = [];
      for (const f of req.files || []) {
        let name = path.basename(String(f.originalname || 'fajl')).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').slice(0, 180) || 'fajl';
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
      res.json({ added });
    });
  });

  // ---------- fascikle, preimenovanje, premeštanje ----------
  app.post('/api/admin/storage/folder', requireAdmin, async (req, res) => {
    try {
      const name = clean(req.body?.name, 120).replace(/[\\/]/g, '');
      if (!name) return res.status(400).json({ error: 'Upišite naziv fascikle.' });
      const dir = resolveIn(path.posix.join(clean(req.body?.p, 400) || '/', name));
      await fsp.mkdir(dir, { recursive: false });
      res.json({ ok: true, path: toRel(dir) });
    } catch (e) {
      res.status(400).json({ error: e.code === 'EEXIST' ? 'Fascikla sa tim imenom već postoji.' : e.message });
    }
  });

  app.post('/api/admin/storage/rename', requireAdmin, async (req, res) => {
    try {
      const from = resolveIn(clean(req.body?.p, 400));
      const name = clean(req.body?.name, 180).replace(/[\\/]/g, '');
      if (!name) return res.status(400).json({ error: 'Upišite novo ime.' });
      const to = path.join(path.dirname(from), name);
      if (fs.existsSync(to)) return res.status(400).json({ error: 'To ime je već zauzeto.' });
      await fsp.rename(from, to);
      res.json({ ok: true, path: toRel(to) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/admin/storage/move', requireAdmin, async (req, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : [];
      const dest = resolveIn(clean(req.body?.to, 400) || '/');
      const st = await stats(dest);
      if (!st || !st.isDirectory()) return res.status(400).json({ error: 'Odredišna fascikla ne postoji.' });
      let moved = 0;
      for (const it of items) {
        const from = resolveIn(clean(it, 400));
        if (from === dest || dest.startsWith(from + path.sep)) continue; // ne u samu sebe
        let to = path.join(dest, path.basename(from));
        const ext = path.extname(to);
        const base = to.slice(0, to.length - ext.length);
        for (let i = 2; fs.existsSync(to); i++) to = `${base} (${i})${ext}`;
        await fsp.rename(from, to).catch(() => {});
        moved++;
      }
      res.json({ moved });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ---------- brisanje: ide u Kantu unutar skladišta, pa se odatle prazni ----------
  app.post('/api/admin/storage/delete', requireAdmin, async (req, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : [];
      const trash = path.join(root(), TRASH, new Date().toISOString().slice(0, 10));
      await fsp.mkdir(trash, { recursive: true });
      let n = 0;
      for (const it of items) {
        const from = resolveIn(clean(it, 400));
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
      res.json({ moved: n, trash: '/' + TRASH });
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
    if (!diskOn()) return res.status(400).json({ error: 'Skladište nije podešeno.' });
    const b = req.body || {};
    try {
      const sources = [];
      for (const p of (Array.isArray(b.items) ? b.items : []).slice(0, 500)) {
        const full = resolveIn(clean(p, 400));
        const st = await stats(full);
        if (!st) continue;
        if (st.isDirectory()) {
          // cela fascikla: svi fajlovi iz nje (bez podfascikli)
          const list = await fsp.readdir(full, { withFileTypes: true });
          for (const d of list) {
            if (d.isFile() && !SKIP_RE.test(d.name)) sources.push({ path: path.join(full, d.name), name: d.name });
          }
        } else {
          sources.push({ path: full, name: path.basename(full) });
        }
      }
      if (!sources.length) return res.status(400).json({ error: 'Izaberite fotografije koje šaljete.' });

      const t = await ctx.services.transfers.createFromFiles(req, {
        sources,
        client: { salutation: b.salutation, firstName: b.firstName, lastName: b.lastName, email: b.email },
        bookingId: clean(b.bookingId, 40) || null,
        message: b.message,
        sendEmail: b.sendEmail !== false,
      });
      res.json(t);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
};
