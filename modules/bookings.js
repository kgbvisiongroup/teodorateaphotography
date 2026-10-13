// Zakazivanja fotografisanja, paketi, scenografije, klijenti (loyalty kartice)
// i automatski emailovi: potvrda, podsetnik dan pre i podsetnici za rok obrade.
const path = require('path');
const fsp = require('fs').promises;
const { CATEGORIES, byKey } = require('../lib/categories');
const T = require('../lib/time');
const { formatMoney, currencySymbol } = require('../lib/util');

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const clean = (v, n = 200) => String(v ?? '').trim().slice(0, n);

module.exports = (ctx) => {
  const { app, store, mailer, requireAdmin, adminOnly, BRAND_DIR } = ctx;
  const data = () => store.data;
  const S = () => store.settings;

  // ---------- pomoćne ----------
  const money = (n) => formatMoney(n, S().currency);
  const clientKey = (b) => (b.email ? b.email.toLowerCase() : String(b.phone || '').replace(/\D/g, '')) || null;
  const clientName = (b) => b.parentName || `${b.firstName} ${b.lastName}`.trim();
  const findBooking = (id) => data().bookings.find((b) => b.id === id);
  const startOf = (b) => T.zoned(b.date, b.time);
  const deadlineOf = (b) => T.addDays(b.date, S().processingDays);

  function status(b, deliveries) {
    if (b.cancelled) return 'cancelled';
    if (startOf(b) > Date.now()) return 'upcoming';
    if (!b.editedAt) return T.zoned(deadlineOf(b), '23:59') < Date.now() ? 'overdue' : 'processing';
    if (deliveries.length) return deliveries.some((d) => d.downloads > 0) ? 'downloaded' : 'sent';
    return 'edited';
  }

  function view(b, req, light) {
    const cat = byKey[b.category];
    const deliveries = light ? [] : ctx.services.transfers?.forBooking(b.id, req) || [];
    const dl = T.addDays(b.date, S().processingDays);
    const key = clientKey(b);
    const loyal = key ? data().clients[key] : null;
    return {
      ...b,
      catName: cat?.name || b.category,
      color: cat?.color || '#ccc',
      start: startOf(b),
      deadlineDate: dl,
      daysLeft: T.daysBetween(T.todayStr(), dl),
      status: status(b, light ? (b.transferIds || []).map(() => ({ downloads: 0 })) : deliveries),
      age: b.birthDate ? T.ageText(b.birthDate, b.date) : '',
      clientName: clientName(b),
      clientKey: key,
      cardNo: loyal?.cardNo || null,
      deliveries,
    };
  }

  // Za slanje fotografija: kratki opis zakazivanja i povezivanje isporuke
  ctx.services.bookings = {
    exists: (id) => !!findBooking(id),
    label(id) {
      const b = id && findBooking(id);
      return b ? `${b.firstName} ${b.lastName} · ${byKey[b.category]?.name || ''} · ${T.dateLong(b.date)}` : null;
    },
    onDelivered(id, t) {
      const b = findBooking(id);
      if (!b) return;
      b.transferIds = [...new Set([...(b.transferIds || []), t.id])];
      if (!b.editedAt) {
        b.editedAt = Date.now(); // poslate fotografije su obrađene
        ctx.services.inventory?.consumeForBooking(b);
      }
      b.updatedAt = Date.now();
    },
    upcoming: (req, days) => {
      const to = T.addDays(T.todayStr(), days);
      return data().bookings.filter((b) => !b.cancelled && startOf(b) > Date.now() - 3 * 3600e3 && b.date <= to).sort((a, b) => startOf(a) - startOf(b)).map((b) => view(b, req, true));
    },
    needsEditing: (req) =>
      data().bookings.filter((b) => !b.cancelled && !b.editedAt && startOf(b) < Date.now()).sort((a, b) => a.date.localeCompare(b.date)).map((b) => view(b, req, true)),
    count: () => data().bookings.filter((b) => !b.cancelled).length,
  };

  // ---------- validacija po šemi kategorije ----------
  function normalize(cat, body) {
    const out = {};
    const errors = [];
    for (const f of cat.fields) {
      let v = body[f.k];
      switch (f.type) {
        case 'textarea':
          v = clean(v, 3000);
          break;
        case 'email':
          v = clean(v);
          if (v && !emailOk(v)) errors.push(`${f.label}: adresa nije ispravna.`);
          break;
        case 'date':
          v = clean(v, 10);
          if (v && !T.isDate(v)) errors.push(`${f.label}: datum nije ispravan.`);
          break;
        case 'time':
          v = clean(v, 5);
          if (v && !T.isTime(v)) errors.push(`${f.label}: vreme nije ispravno.`);
          break;
        case 'number':
        case 'hours': {
          if (v === '' || v == null) v = null;
          else {
            v = Number(String(v).replace(',', '.'));
            const lo = f.type === 'hours' ? 0 : f.min ?? -Infinity;
            const hi = f.type === 'hours' ? 24 : f.max ?? Infinity;
            if (!Number.isFinite(v) || v < lo || v > hi) errors.push(`${f.label}: unesite broj${Number.isFinite(lo) ? ` od ${lo}` : ''}${Number.isFinite(hi) ? ` do ${hi}` : ''}.`);
            if (f.type === 'hours') v = Math.round(v * 2) / 2;
          }
          break;
        }
        case 'checkbox':
          v = v === true || v === 'true' || v === 'on' || v === 1;
          break;
        case 'package': {
          v = clean(v, 40);
          const p = data().packages.find((x) => x.id === v && x.category === cat.key);
          if (v && !p) errors.push('Izabrani paket ne postoji.');
          break;
        }
        case 'scene': {
          v = clean(v, 40);
          if (v && !data().scenes.find((x) => x.id === v)) errors.push('Izabrana scenografija ne postoji.');
          break;
        }
        default:
          v = clean(v);
      }
      if (f.req && f.type !== 'checkbox' && (v === '' || v == null)) errors.push(`Polje „${f.label}“ je obavezno.`);
      out[f.k] = v;
    }
    if (out.birthDate && out.date && out.birthDate > out.date) errors.push('Datum rođenja je posle datuma fotografisanja.');
    return { out, errors };
  }

  function price(b, discountPct) {
    const p = data().packages.find((x) => x.id === b.packageId);
    const base = p ? p.price : b.packagePrice || 0;
    const hourPrice = p ? p.extraHourPrice || 0 : b.extraHourPrice || 0;
    const extra = (b.extraHours || 0) * hourPrice;
    const disc = Math.min(100, Math.max(0, Number(discountPct) || 0));
    // Izrada (album, book, kutija) se dodaje na cenu, kapara se oduzima od ukupnog
    const items = ctx.services.inventory ? ctx.services.inventory.describe(b.items) : [];
    const itemsTotal = items.reduce((sum, x) => sum + x.price * x.qty, 0);
    const total = Math.round((base + extra) * (1 - disc / 100) + itemsTotal);
    const deposit = Math.max(0, Math.round(Number(b.deposit) || 0));
    return {
      packageName: p ? p.name : b.packageName || '',
      packagePrice: base,
      extraHourPrice: hourPrice,
      extraTotal: extra,
      discountPct: disc,
      itemsTotal,
      itemsList: items,
      deposit,
      total,
      remaining: Math.max(0, total - deposit),
    };
  }

  // ---------- emailovi ----------
  function vars(b) {
    const cat = byKey[b.category];
    return {
      klijent: clientName(b),
      ime: b.firstName,
      prezime: b.lastName,
      kategorija: cat?.name || '',
      datum: T.dateLong(b.date, true),
      vreme: b.time,
      lokacija: b.location || '',
      paket: b.packageName || '',
      cena: money(b.total) + (b.discountPct ? ` (uz ${b.discountPct}% popusta)` : ''),
      kapara: money(b.deposit || 0),
      ostatak: money(b.remaining != null ? b.remaining : b.total),
      izrada: (b.itemsList || []).map((i) => `${i.name}${i.qty > 1 ? ' × ' + i.qty : ''}`).join(', ') || 'bez izrade',
      studio: S().studioName,
    };
  }
  const studioMeta = () => [S().studioName, S().contactPhone, S().contactEmail].filter(Boolean).join(' · ');

  async function sendKind(b, kind) {
    const s = S();
    const v = vars(b);
    if (kind === 'confirm' || kind === 'reminder') {
      const subj = kind === 'confirm' ? s.bookingConfirmSubject : s.bookingReminderSubject;
      const body = kind === 'confirm' ? s.bookingConfirmBody : s.bookingReminderBody;
      await mailer.sendSimple(s, { to: b.email, toName: v.klijent, subject: mailer.fill(subj, v), body: mailer.fill(body, v), meta: studioMeta() });
    } else {
      const days = Math.max(0, T.daysBetween(T.todayStr(), deadlineOf(b)));
      const when = days === 0 ? 'ističe danas' : `ističe za ${days} ${days === 1 ? 'dan' : 'dana'}`;
      const to = mailer.studioEmail(s);
      if (!to) throw new Error('Nema emaila za obaveštenja (Email → Obaveštenja).');
      const base = ctx.baseUrl();
      await mailer.sendSimple(s, {
        to,
        subject: `Obrada: ${b.firstName} ${b.lastName} – rok ${when}`,
        body:
          `Fotografije za ${b.firstName} ${b.lastName} (${v.kategorija}, fotografisano ${T.dateLong(b.date)}) još nisu označene kao obrađene.\n\n` +
          `Rok za obradu: ${T.dateLong(deadlineOf(b), true)}\n\n` +
          'Kada završiš, označi ih kao obrađene ili ih pošalji klijentu iz administracije.',
        cta: base ? { url: `${base}/admin/#booking/${b.id}`, text: 'Otvori zakazivanje' } : null,
      });
    }
    b.emails ||= {};
    b.emails[kind] = { at: Date.now() };
    const cat = byKey[b.category]?.name || '';
    if (kind === 'reminder')
      ctx.notify({ type: 'booking', title: `Sutra: ${b.firstName} ${b.lastName}`, text: `${cat} u ${b.time} · ${b.location}`, link: '#booking/' + b.id, key: 'tomorrow:' + b.id + ':' + b.date });
    if (kind === 'edit3' || kind === 'edit1')
      ctx.notify({ type: 'deadline', title: `Rok za obradu: ${b.firstName} ${b.lastName}`, text: `${cat} · rok ${T.dateLong(deadlineOf(b))}`, link: '#booking/' + b.id, key: kind + ':' + b.id });
  }

  async function trySend(b, kind) {
    const prev = b.emails?.[kind];
    if (prev?.at || (prev?.tries || 0) >= 3) return;
    try {
      await sendKind(b, kind);
    } catch (e) {
      b.emails ||= {};
      b.emails[kind] = { err: e.message, tries: (prev?.tries || 0) + 1, lastTry: Date.now() };
      const what = { confirm: 'Potvrda termina', reminder: 'Podsetnik dan pre', edit3: 'Podsetnik za obradu', edit1: 'Podsetnik za obradu' }[kind];
      ctx.notify({ type: 'error', title: `${what} nije poslat`, text: `${b.firstName} ${b.lastName}: ${e.message}`, link: '#booking/' + b.id, key: `err:${kind}:${b.id}` });
      console.error(`Email (${kind}) za ${b.firstName} ${b.lastName} nije poslat:`, e.message);
    }
    store.save();
  }

  // Periodično: podsetnik klijentu dan pre i podsetnici za obradu (3 dana i 1 dan pre roka)
  ctx.every(async () => {
    const s = S();
    const now = Date.now();
    const hour = `${T.pad(s.reminderHour)}:00`;
    for (const b of data().bookings) {
      if (b.cancelled) continue;
      const start = startOf(b);
      if (s.bookingReminderEnabled && !b.emails?.reminder?.at) {
        const at = T.zoned(T.addDays(b.date, -1), hour);
        if (now >= at && now < start && b.createdAt < at) await trySend(b, 'reminder');
      }
      if (s.processingReminders && !b.editedAt && start < now) {
        const dl = deadlineOf(b);
        const end = T.zoned(dl, '23:59');
        const at3 = T.zoned(T.addDays(dl, -3), hour);
        const at1 = T.zoned(T.addDays(dl, -1), hour);
        if (now >= at3 && now < at1 && b.createdAt < at3) await trySend(b, 'edit3');
        if (now >= at1 && now < end && b.createdAt < at1) await trySend(b, 'edit1');
      }
    }
  });

  // ---------- API: meta ----------
  app.get('/api/admin/meta', requireAdmin, (req, res) => {
    const uniq = (k) => [...new Set(data().bookings.slice(-300).map((b) => b[k]).filter(Boolean))].slice(-30);
    res.json({
      categories: CATEGORIES,
      currency: S().currency,
      currencySymbol: currencySymbol(S().currency),
      locations: S().locations,
      mailUser: S().imapSameLogin ? S().smtpUser : S().imapUser,
      studio: { name: S().studioName, lines: [S().contactPhone, S().contactEmail, S().website, ...(S().locations || [])].filter(Boolean) },
      contact: { phone: S().contactPhone, email: S().contactEmail, website: S().website, instagram: S().instagram },
      storage: ctx.services.storage?.info?.() || { any: false, disk: false, google: false },
      processingDays: S().processingDays,
      suggestions: { locations: uniq('location'), churches: uniq('church') },
      today: T.todayStr(),
    });
  });

  // ---------- API: zakazivanja ----------
  app.get('/api/admin/bookings', requireAdmin, (req, res) => {
    const list = data().bookings.map((b) => view(b, req, true)).sort((a, b) => a.start - b.start);
    res.json(list);
  });

  app.get('/api/admin/bookings/:id', requireAdmin, (req, res) => {
    const b = findBooking(req.params.id);
    if (!b) return res.status(404).json({ error: 'Zakazivanje ne postoji.' });
    res.json(view(b, req));
  });

  function saveBooking(req, res, existing) {
    const body = req.body || {};
    const cat = byKey[existing ? existing.category : body.category];
    if (!cat) {
      res.status(400).json({ error: 'Izaberite vrstu fotografisanja.' });
      return null;
    }
    const { out, errors } = normalize(cat, body);
    if (errors.length) {
      res.status(400).json({ error: errors[0], errors });
      return null;
    }
    const now = Date.now();
    const b = existing || { id: store.newId(6), category: cat.key, createdAt: now, emails: {}, transferIds: [] };
    // Promena termina: podsetnici idu ponovo za novi datum
    if (existing && (existing.date !== out.date || existing.time !== out.time)) {
      delete b.emails.reminder;
      delete b.emails.edit3;
      delete b.emails.edit1;
    }
    Object.assign(b, out);
    // Izrada i kapara nisu deo polja kategorije, pa ih preuzimamo posebno
    if (body.items !== undefined) {
      b.items = (Array.isArray(body.items) ? body.items : [])
        .map((it) => ({ productId: String(it.productId || '').slice(0, 40), qty: Math.max(1, Math.round(Number(it.qty) || 1)) }))
        .filter((it) => it.productId)
        .slice(0, 20);
    }
    if (body.deposit !== undefined) b.deposit = Math.max(0, Math.round(Number(body.deposit) || 0));
    const loyal = data().clients[clientKey(b)];
    const disc = body.discountPct !== undefined && body.discountPct !== '' ? body.discountPct : loyal?.discount || 0;
    Object.assign(b, price(b, disc));
    b.sceneName = out.sceneId ? data().scenes.find((x) => x.id === out.sceneId)?.name || '' : '';
    b.updatedAt = now;
    if (!existing) data().bookings.push(b);
    store.save();
    return b;
  }

  app.post('/api/admin/bookings', requireAdmin, async (req, res) => {
    const b = saveBooking(req, res);
    if (!b) return;
    let mail = null;
    if (req.body.sendConfirmation && S().bookingConfirmEnabled && b.email) {
      await trySend(b, 'confirm');
      mail = b.emails.confirm?.at ? 'sent' : b.emails.confirm?.err || 'failed';
    }
    res.json({ ...view(b, req), mail });
  });

  app.put('/api/admin/bookings/:id', requireAdmin, (req, res) => {
    const existing = findBooking(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Zakazivanje ne postoji.' });
    const b = saveBooking(req, res, existing);
    if (b) res.json(view(b, req));
  });

  app.post('/api/admin/bookings/:id/state', requireAdmin, (req, res) => {
    const b = findBooking(req.params.id);
    if (!b) return res.status(404).json({ error: 'Zakazivanje ne postoji.' });
    const { edited, cancelled } = req.body || {};
    if (edited !== undefined) {
      b.editedAt = edited ? b.editedAt || Date.now() : null;
      if (b.editedAt) ctx.services.inventory?.consumeForBooking(b, req.user?.id);
    }
    if (cancelled !== undefined) b.cancelled = !!cancelled;
    b.updatedAt = Date.now();
    store.save();
    res.json(view(b, req));
  });

  app.post('/api/admin/bookings/:id/confirm', requireAdmin, async (req, res) => {
    const b = findBooking(req.params.id);
    if (!b) return res.status(404).json({ error: 'Zakazivanje ne postoji.' });
    try {
      await sendKind(b, 'confirm');
      store.save();
      res.json(view(b, req));
    } catch (e) {
      res.status(502).json({ error: 'Email nije poslat: ' + e.message });
    }
  });

  app.delete('/api/admin/bookings/:id', requireAdmin, (req, res) => {
    const b = findBooking(req.params.id);
    if (!b) return res.status(404).json({ error: 'Zakazivanje ne postoji.' });
    data().bookings = data().bookings.filter((x) => x !== b);
    store.save();
    res.json({ ok: true });
  });

  // ---------- API: paketi ----------
  function packageFrom(body, p = {}) {
    const name = clean(body.name, 80);
    if (!name) return { error: 'Upišite naziv paketa.' };
    if (!byKey[body.category ?? p.category]) return { error: 'Izaberite kategoriju.' };
    // "25.000", "25 000", "25000" i "99,50" – sve se pravilno čita
    const num = (v) => {
      let t = String(v ?? '').replace(/[^\d.,]/g, '');
      const dec = t.match(/[.,](\d{1,2})$/);
      t = dec ? t.slice(0, -dec[0].length).replace(/[.,]/g, '') + '.' + dec[1] : t.replace(/[.,]/g, '');
      return Math.max(0, Math.round(Number(t) || 0));
    };
    return {
      ...p,
      category: body.category ?? p.category,
      name,
      price: num(body.price),
      extraHourPrice: num(body.extraHourPrice),
      description: clean(body.description, 600),
      active: body.active !== false,
    };
  }
  app.get('/api/admin/packages', requireAdmin, (req, res) => res.json(data().packages));
  app.post('/api/admin/packages', adminOnly, (req, res) => {
    const p = packageFrom(req.body || {});
    if (p.error) return res.status(400).json(p);
    p.id = store.newId(5);
    data().packages.push(p);
    store.save();
    res.json(p);
  });
  app.put('/api/admin/packages/:id', adminOnly, (req, res) => {
    const i = data().packages.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Paket ne postoji.' });
    const p = packageFrom(req.body || {}, data().packages[i]);
    if (p.error) return res.status(400).json(p);
    data().packages[i] = p;
    store.save();
    res.json(p);
  });
  app.delete('/api/admin/packages/:id', adminOnly, (req, res) => {
    data().packages = data().packages.filter((x) => x.id !== req.params.id); // zakazivanja čuvaju naziv i cenu
    store.save();
    res.json({ ok: true });
  });

  // ---------- API: scenografije (naziv, opis, fotografija) ----------
  app.get('/api/admin/scenes', requireAdmin, (req, res) => res.json(data().scenes));
  async function sceneWrite(req, res, existing) {
    if (!(await ctx.runImageUpload((u) => u.single('image'))(req, res))) return;
    const name = clean(req.body?.name, 80);
    if (!name) {
      if (req.file) await fsp.rm(req.file.path, { force: true });
      return res.status(400).json({ error: 'Upišite naziv scenografije.' });
    }
    const s = existing || { id: store.newId(5), active: true };
    s.name = name;
    s.description = clean(req.body?.description, 400);
    if (req.file) {
      const old = s.image;
      s.image = await ctx.saveImage(req.file.path, 'scene', { width: 900, height: 900 });
      if (old) await fsp.rm(path.join(BRAND_DIR, old), { force: true });
    }
    if (!existing) data().scenes.push(s);
    store.save();
    res.json(s);
  }
  app.post('/api/admin/scenes', adminOnly, (req, res) => sceneWrite(req, res));
  app.put('/api/admin/scenes/:id', adminOnly, (req, res) => {
    const s = data().scenes.find((x) => x.id === req.params.id);
    if (!s) return res.status(404).json({ error: 'Scenografija ne postoji.' });
    sceneWrite(req, res, s);
  });
  app.delete('/api/admin/scenes/:id', adminOnly, async (req, res) => {
    const s = data().scenes.find((x) => x.id === req.params.id);
    if (s?.image) await fsp.rm(path.join(BRAND_DIR, s.image), { force: true });
    data().scenes = data().scenes.filter((x) => x.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });
  app.get('/media/scene/:id', requireAdmin, (req, res) => {
    const s = data().scenes.find((x) => x.id === req.params.id);
    if (!s?.image) return res.status(404).end();
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.sendFile(path.join(BRAND_DIR, s.image));
  });

  // ---------- API: klijenti i loyalty ----------
  function clients() {
    const map = new Map();
    for (const b of [...data().bookings].sort((a, c) => a.date.localeCompare(c.date))) {
      const key = clientKey(b);
      if (!key) continue;
      const c = map.get(key) || { key, email: '', phone: '', names: new Set(), cats: new Set(), sessions: 0, cancelled: 0, spent: 0, first: b.date, last: b.date };
      c.name = clientName(b);
      c.email = b.email || c.email;
      c.phone = b.phone || c.phone;
      if (b.category !== 'trudnicko') c.names.add(`${b.firstName} ${b.lastName}`);
      if (b.cancelled) c.cancelled += 1;
      else {
        c.sessions += 1;
        c.spent += b.total || 0;
        c.cats.add(byKey[b.category]?.name || b.category);
        c.last = b.date;
      }
      map.set(key, c);
    }
    return [...map.values()].map((c) => {
      const l = data().clients[c.key] || {};
      return { ...c, names: [...c.names], cats: [...c.cats], cardNo: l.cardNo || null, discount: l.discount || 0, note: l.note || '', issuedAt: l.issuedAt || null };
    });
  }

  app.get('/api/admin/clients', requireAdmin, (req, res) => res.json(clients().sort((a, b) => b.last.localeCompare(a.last))));

  app.get('/api/admin/clients/lookup', requireAdmin, (req, res) => {
    const key = (clean(req.query.email).toLowerCase() || String(req.query.phone || '').replace(/\D/g, '')) || '';
    const c = key && clients().find((x) => x.key === key);
    res.json(c || null);
  });

  app.put('/api/admin/clients/:key', requireAdmin, (req, res) => {
    const key = req.params.key;
    if (!clients().find((c) => c.key === key)) return res.status(404).json({ error: 'Klijent ne postoji.' });
    const b = req.body || {};
    const l = (data().clients[key] ||= {});
    if (b.discount !== undefined) l.discount = Math.min(100, Math.max(0, Math.round(Number(b.discount) || 0)));
    if (b.note !== undefined) l.note = clean(b.note, 1000);
    if (b.issue && !l.cardNo) {
      data().counters.card += 1;
      l.cardNo = `${S().cardPrefix}-${String(data().counters.card).padStart(4, '0')}`;
      l.issuedAt = Date.now();
    }
    if (b.revoke) {
      l.cardNo = null;
      l.issuedAt = null;
    }
    store.save();
    res.json(clients().find((c) => c.key === key));
  });

  app.post('/api/admin/clients/:key/send-card', requireAdmin, async (req, res) => {
    const c = clients().find((x) => x.key === req.params.key);
    if (!c?.cardNo) return res.status(400).json({ error: 'Klijent još nema karticu.' });
    if (!c.email) return res.status(400).json({ error: 'Klijent nema email adresu.' });
    const s = S();
    try {
      await mailer.sendSimple(s, {
        to: c.email,
        toName: c.name,
        subject: `Vaša loyalty kartica – ${s.studioName}`,
        body: `Zdravo ${c.name},\n\nhvala vam što ste deo naše priče. Kao naš stalni klijent dobijate loyalty karticu sa popustom na sledeća fotografisanja.\n\nSrdačan pozdrav,\n${s.studioName}`,
        card: { kind: 'loyalty', name: c.name, number: c.cardNo, discount: c.discount },
        meta: studioMeta(),
      });
      res.json({ ok: true });
    } catch (e) {
      res.status(502).json({ error: 'Email nije poslat: ' + e.message });
    }
  });
};
