// Slanje fotografija (kao WeTransfer): upload JPG i ZIP fajlova, link za klijenta,
// evidencija preuzimanja, automatsko brisanje posle isteka i arhiva poslatog.
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const multer = require('multer');
const archiver = require('archiver');

const IMAGE_RE = /\.(jpe?g)$/i;
const ALLOWED_RE = /\.(jpe?g|zip)$/i;
const isImage = (f) => IMAGE_RE.test(f.name || f.stored || '');
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

module.exports = (ctx) => {
  const { app, store, mailer, pages, sharp, requireAdmin, UPLOAD_DIR, DAY, MAX_FILE_MB } = ctx;
  const data = () => store.data;

  const newToken = () => crypto.randomBytes(18).toString('base64url');
  const transferDir = (t) => path.join(UPLOAD_DIR, t.id);
  const isExpired = (t) => t.expiresAt <= Date.now();
  const findById = (id) => data().transfers.find((t) => t.id === id);
  const findByToken = (tok) => data().transfers.find((t) => t.token === tok);
  const linkFor = (req, t) => `${ctx.baseUrl(req)}/d/${t.token}`;

  function cleanName(name) {
    let n = String(name || 'fajl');
    // Neki pregledači šalju UTF-8 ime kao latin1 – vrati ispravna slova (č, ć, š...)
    if (/[À-ÿ]/.test(n)) {
      const fixed = Buffer.from(n, 'latin1').toString('utf8');
      if (!fixed.includes('�')) n = fixed;
    }
    return path.basename(n).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').slice(0, 180) || 'fajl';
  }

  const typeOf = (files) => {
    const imgs = files.filter(isImage).length;
    return imgs === files.length ? 'images' : imgs === 0 ? 'zip' : 'mixed';
  };

  function summary(t) {
    const log = t.downloadLog || [];
    return {
      id: t.id,
      bookingId: t.bookingId || null,
      salutation: t.salutation,
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      message: t.message,
      type: t.type,
      fileCount: t.files ? t.files.length : t.fileCount,
      imageCount: t.files ? t.files.filter(isImage).length : t.imageCount || 0,
      totalSize: t.totalSize,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
      downloads: t.downloads || 0,
      firstDownloadAt: t.firstDownloadAt || null,
      lastDownloadAt: log.length ? log[log.length - 1].at : t.firstDownloadAt || null,
      downloadLog: log.slice(-50).reverse(),
      emailSentAt: t.emailSentAt || null,
      emailError: t.emailError || null,
    };
  }
  const publicTransfer = (req, t) => ({ ...summary(t), link: linkFor(req, t), active: true, booking: ctx.services.bookings?.label(t.bookingId) || null });

  // Za zakazivanja: sve isporuke vezane za jedno zakazivanje (aktivne i istekle)
  ctx.services.transfers = {
    forBooking(bookingId, req) {
      const live = data().transfers.filter((t) => t.bookingId === bookingId && !isExpired(t)).map((t) => ({ ...summary(t), active: true, link: req ? linkFor(req, t) : null }));
      const old = data().transferHistory.filter((h) => h.bookingId === bookingId).map((h) => ({ ...h, active: false }));
      return [...live, ...old].sort((a, b) => b.createdAt - a.createdAt);
    },
    stats() {
      const live = data().transfers.filter((t) => !isExpired(t));
      return {
        active: live.length,
        storage: live.reduce((a, t) => a + t.totalSize, 0),
        downloads: live.reduce((a, t) => a + (t.downloads || 0), 0),
        waiting: live.filter((t) => !t.downloads).length,
        expiringSoon: live.filter((t) => t.expiresAt - Date.now() < DAY && !t.downloads).length,
      };
    },
    recent: (req, n) => data().transfers.filter((t) => !isExpired(t)).slice(0, n).map((t) => publicTransfer(req, t)),

    /** Pošiljka od fajlova koji već postoje na disku (koristi je Skladište fotografija).
     *  Originali se ne diraju – fajlovi se kopiraju u pošiljku, koja se sama briše kad istekne. */
    async createFromFiles(req, { sources, client, bookingId, message, sendEmail }) {
      if (!sources?.length) throw new Error('Nije izabran nijedan fajl.');
      if (!client?.firstName || !client?.lastName) throw new Error('Unesite ime i prezime klijenta.');
      if (!emailOk(client.email || '')) throw new Error('Email adresa nije ispravna.');

      const id = crypto.randomBytes(8).toString('hex');
      const dir = path.join(UPLOAD_DIR, id);
      await fsp.mkdir(dir, { recursive: true });
      const used = new Set();
      const files = [];
      try {
        for (const src of sources) {
          const st = await fsp.stat(src.path);
          if (!st.isFile()) continue;
          let name = cleanName(src.name || path.basename(src.path));
          const ext = path.extname(name);
          const base = name.slice(0, name.length - ext.length);
          for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} (${i})${ext}`;
          used.add(name.toLowerCase());
          const fid = crypto.randomBytes(8).toString('hex');
          const stored = fid + ext.toLowerCase();
          await fsp.copyFile(src.path, path.join(dir, stored));
          files.push({ id: fid, stored, name, size: st.size });
        }
      } catch (e) {
        await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
        throw e;
      }
      if (!files.length) {
        await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
        throw new Error('Izabrani fajlovi nisu pronađeni.');
      }

      const now = Date.now();
      const t = {
        id,
        token: newToken(),
        bookingId: bookingId && ctx.services.bookings?.exists(bookingId) ? bookingId : null,
        salutation: String(client.salutation || '').trim().slice(0, 30),
        firstName: String(client.firstName).trim().slice(0, 80),
        lastName: String(client.lastName).trim().slice(0, 80),
        email: String(client.email).trim().slice(0, 200),
        message: String(message || '').trim().slice(0, 2000),
        type: typeOf(files),
        files,
        totalSize: files.reduce((a, f) => a + f.size, 0),
        createdAt: now,
        expiresAt: now + Math.max(1, Number(store.settings.retentionDays) || 3) * DAY,
        downloads: 0,
        downloadLog: [],
        fromStorage: true,
      };
      data().transfers.unshift(t);
      // Vezano za zakazivanje: termin se odmah vodi kao obrađen (i skida se sa spiska za obradu)
      if (t.bookingId) ctx.services.bookings.onDelivered(t.bookingId, t);
      store.save();

      if (sendEmail) {
        try {
          await mailer.sendTransfer(t, store.settings, linkFor(req, t));
          t.emailSentAt = Date.now();
        } catch (e) {
          t.emailError = e.message;
          ctx.notify({ type: 'error', title: 'Email sa linkom nije poslat', text: `${t.firstName} ${t.lastName}: ${e.message}`, link: '#list', key: 'terr:' + t.id });
        }
        store.save();
      }
      pregenerate(t);
      return publicTransfer(req, t);
    },
  };

  // ---------- sličice (prave se unapred, odmah posle slanja) ----------
  const thumbJobs = new Map();
  function thumbPath(t, f, big) {
    return path.join(transferDir(t), 'thumbs', f.id + (big ? '-l' : '') + '.webp');
  }
  function makeThumb(t, f, big) {
    const out = thumbPath(t, f, big);
    if (fs.existsSync(out)) return Promise.resolve(out);
    if (thumbJobs.has(out)) return thumbJobs.get(out);
    const px = big ? 2200 : 900;
    const job = (async () => {
      await fsp.mkdir(path.dirname(out), { recursive: true });
      await sharp(path.join(transferDir(t), f.stored), { failOn: 'none' })
        .rotate()
        .resize({ width: px, height: px, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: big ? 80 : 74, effort: 3 })
        .toFile(out + '.tmp');
      await fsp.rename(out + '.tmp', out);
      return out;
    })().finally(() => thumbJobs.delete(out));
    thumbJobs.set(out, job);
    return job;
  }
  // Red čekanja: jedna po jedna, da server ostane brz dok se sličice prave
  let queue = Promise.resolve();
  function pregenerate(t) {
    if (!sharp) return;
    const imgs = t.files.filter(isImage);
    queue = queue.then(async () => {
      for (const [i, f] of imgs.entries()) {
        if (!findById(t.id)) return; // obrisano u međuvremenu
        await makeThumb(t, f, false).catch(() => {});
        if (i < 10) await makeThumb(t, f, true).catch(() => {});
      }
    });
  }

  // ---------- upload ----------
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, req.transfer.dir),
      filename: (req, file, cb) => {
        req.transfer.n += 1;
        cb(null, String(req.transfer.n).padStart(4, '0') + path.extname(file.originalname).toLowerCase());
      },
    }),
    defParamCharset: 'utf8',
    limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 3000, fieldSize: 64 * 1024 },
    fileFilter: (req, file, cb) => {
      if (ALLOWED_RE.test(file.originalname)) return cb(null, true);
      const err = new Error(`"${cleanName(file.originalname)}" nije JPG ni ZIP fajl.`);
      err.status = 400;
      cb(err);
    },
  });

  app.get('/api/admin/transfers', requireAdmin, (req, res) => {
    if (req.query.scope === 'history') return res.json(data().transferHistory.map((h) => ({ ...h, active: false, booking: ctx.services.bookings?.label(h.bookingId) || null })));
    res.json(data().transfers.filter((t) => !isExpired(t)).map((t) => publicTransfer(req, t)));
  });

  app.post(
    '/api/admin/transfers',
    requireAdmin,
    (req, res, next) => {
      const id = crypto.randomBytes(8).toString('hex');
      req.transfer = { id, dir: path.join(UPLOAD_DIR, id), n: 0 };
      fs.mkdirSync(req.transfer.dir, { recursive: true });
      // Ako veza pukne usred slanja, ne ostavljaj polovične fajlove.
      req.on('aborted', () => fsp.rm(req.transfer.dir, { recursive: true, force: true }).catch(() => {}));
      next();
    },
    (req, res) => {
      upload.array('files')(req, res, async (err) => {
        const fail = async (status, msg) => {
          await fsp.rm(req.transfer.dir, { recursive: true, force: true }).catch(() => {});
          res.status(status).json({ error: msg });
        };
        if (err) return fail(400, err.code === 'LIMIT_FILE_SIZE' ? `Fajl je veći od dozvoljenih ${MAX_FILE_MB} MB.` : err.message || 'Greška pri slanju.');
        const b = req.body || {};
        const firstName = String(b.firstName || '').trim().slice(0, 80);
        const lastName = String(b.lastName || '').trim().slice(0, 80);
        const email = String(b.email || '').trim().slice(0, 200);
        if (!firstName || !lastName) return fail(400, 'Unesite ime i prezime.');
        if (!emailOk(email)) return fail(400, 'Email adresa nije ispravna.');
        if (!req.files || !req.files.length) return fail(400, 'Dodajte bar jedan fajl.');
        const bookingId = b.bookingId && ctx.services.bookings?.exists(b.bookingId) ? b.bookingId : null;

        const used = new Set();
        const files = req.files.map((f) => {
          let name = cleanName(f.originalname);
          const ext = path.extname(name);
          const base = name.slice(0, name.length - ext.length);
          for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} (${i})${ext}`;
          used.add(name.toLowerCase());
          return { id: path.basename(f.filename, path.extname(f.filename)), stored: f.filename, name, size: f.size };
        });

        const now = Date.now();
        const t = {
          id: req.transfer.id,
          token: newToken(),
          bookingId,
          salutation: String(b.salutation || '').trim().slice(0, 30),
          firstName,
          lastName,
          email,
          message: String(b.message || '').trim().slice(0, 2000),
          type: typeOf(files),
          files,
          totalSize: files.reduce((a, f) => a + f.size, 0),
          createdAt: now,
          expiresAt: now + Math.max(1, Number(store.settings.retentionDays) || 3) * DAY,
          downloads: 0,
          downloadLog: [],
        };
        data().transfers.unshift(t);
        if (bookingId) ctx.services.bookings.onDelivered(bookingId, t);
        store.save();

        if (['true', 'on', '1'].includes(b.sendEmail)) {
          try {
            await mailer.sendTransfer(t, store.settings, linkFor(req, t));
            t.emailSentAt = Date.now();
          } catch (e) {
            t.emailError = e.message;
            ctx.notify({ type: 'error', title: 'Email sa linkom nije poslat', text: `${t.firstName} ${t.lastName}: ${e.message}`, link: '#list', key: 'terr:' + t.id });
          }
          store.save();
        }
        res.json(publicTransfer(req, t));
        pregenerate(t);
      });
    }
  );

  app.post('/api/admin/transfers/:id/resend', requireAdmin, async (req, res) => {
    const t = findById(req.params.id);
    if (!t || isExpired(t)) return res.status(404).json({ error: 'Pošiljka ne postoji.' });
    try {
      await mailer.sendTransfer(t, store.settings, linkFor(req, t));
      t.emailSentAt = Date.now();
      t.emailError = null;
      store.save();
      res.json(publicTransfer(req, t));
    } catch (e) {
      t.emailError = e.message;
      store.save();
      res.status(502).json({ error: 'Email nije poslat: ' + e.message });
    }
  });

  app.post('/api/admin/transfers/:id/extend', requireAdmin, (req, res) => {
    const t = findById(req.params.id);
    if (!t || isExpired(t)) return res.status(404).json({ error: 'Pošiljka ne postoji.' });
    const days = Math.min(30, Math.max(1, Number(req.body?.days) || Number(store.settings.retentionDays) || 3));
    t.expiresAt += days * DAY;
    store.save();
    res.json(publicTransfer(req, t));
  });

  app.delete('/api/admin/transfers/:id', requireAdmin, async (req, res) => {
    const t = findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Pošiljka ne postoji.' });
    await retire(t, 'obrisano');
    res.json({ ok: true });
  });

  // ---------- stranica za klijenta ----------
  function getLive(req, res) {
    const t = findByToken(req.params.token);
    if (!t || isExpired(t)) {
      res.status(410).type('html').send(pages.expired(ctx.site()));
      return null;
    }
    return t;
  }

  function countDownload(t, kind, fileName) {
    const now = Date.now();
    t.downloads = (t.downloads || 0) + 1;
    t.downloadLog ||= [];
    t.downloadLog.push(fileName ? { at: now, kind, file: fileName } : { at: now, kind });
    if (t.downloadLog.length > 300) t.downloadLog.splice(0, t.downloadLog.length - 300);
    const first = !t.firstDownloadAt;
    if (first) t.firstDownloadAt = now;
    store.save();
    const s = store.settings;
    if (first)
      ctx.notify({ type: 'download', title: `${t.firstName} ${t.lastName} je preuzeo/la fotografije`, text: `${t.files.length} fajl(ova) · ${kind === 'all' ? 'sve odjednom' : fileName}`, link: '#list', key: 'dl:' + t.id });
    if (first && s.notifyOnDownload && mailer.studioEmail(s)) {
      mailer.sendDownloadNotice(t, s).catch((e) => console.error('Obaveštenje o preuzimanju nije poslato:', e.message));
    }
  }

  app.get('/d/:token', (req, res) => {
    const t = getLive(req, res);
    if (!t) return;
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(pages.download(t, ctx.site()));
  });

  app.get('/d/:token/f/:fileId', (req, res) => {
    const t = getLive(req, res);
    if (!t) return;
    const f = t.files.find((x) => x.id === req.params.fileId);
    if (!f) return res.status(404).send('Fajl ne postoji.');
    const p = path.join(transferDir(t), f.stored);
    if (req.query.inline && isImage(f)) {
      res.setHeader('Cache-Control', 'private, max-age=86400');
      return res.sendFile(p);
    }
    countDownload(t, 'file', f.name);
    res.download(p, f.name);
  });

  app.get('/d/:token/t/:fileId', async (req, res) => {
    const t = getLive(req, res);
    if (!t) return;
    const f = t.files.find((x) => x.id === req.params.fileId);
    if (!f || !isImage(f)) return res.status(404).end();
    res.setHeader('Cache-Control', 'private, max-age=604800');
    if (!sharp) return res.sendFile(path.join(transferDir(t), f.stored));
    try {
      res.sendFile(await makeThumb(t, f, req.query.s === 'l'));
    } catch {
      res.sendFile(path.join(transferDir(t), f.stored));
    }
  });

  app.get('/d/:token/all', (req, res) => {
    const t = getLive(req, res);
    if (!t) return;
    if (t.files.length === 1) return res.redirect(`/d/${t.token}/f/${t.files[0].id}`);
    countDownload(t, 'all');
    const zipName = `${store.settings.studioName} - ${t.firstName} ${t.lastName}.zip`.replace(/[\\/:*?"<>|]/g, '');
    res.attachment(zipName);
    const archive = archiver('zip', { store: true }); // JPG i ZIP su već kompresovani – brže bez dodatnog pakovanja
    archive.on('error', (e) => res.destroy(e));
    archive.pipe(res);
    for (const f of t.files) archive.file(path.join(transferDir(t), f.stored), { name: f.name });
    archive.finalize();
  });

  // ---------- istek i arhiva ----------
  async function retire(t, reason) {
    await fsp.rm(transferDir(t), { recursive: true, force: true });
    const s = summary(t);
    delete s.message;
    s.downloadLog = s.downloadLog.slice(0, 30);
    s.endedAt = Date.now();
    s.endReason = reason; // 'isteklo' | 'obrisano'
    data().transferHistory.unshift(s);
    data().transfers = data().transfers.filter((x) => x.id !== t.id);
    store.save();
  }

  ctx.every(async () => {
    for (const t of [...data().transfers]) {
      if (isExpired(t)) {
        await retire(t, 'isteklo').catch((e) => console.error('Brisanje nije uspelo:', e.message));
        console.log(`Obrisano (isteklo): ${t.firstName} ${t.lastName}`);
      }
    }
    // Arhiva se čuva godinu dana
    const yearAgo = Date.now() - 365 * DAY;
    const before = data().transferHistory.length;
    data().transferHistory = data().transferHistory.filter((h) => h.createdAt > yearAgo);
    if (data().transferHistory.length !== before) store.save();
    // Fascikle bez zapisa (npr. prekinuto slanje) starije od 6 sati
    const known = new Set(data().transfers.map((t) => t.id));
    for (const d of await fsp.readdir(UPLOAD_DIR).catch(() => [])) {
      if (known.has(d)) continue;
      const p = path.join(UPLOAD_DIR, d);
      const st = await fsp.stat(p).catch(() => null);
      if (st && Date.now() - st.mtimeMs > 6 * 60 * 60 * 1000) await fsp.rm(p, { recursive: true, force: true }).catch(() => {});
    }
  });
};
