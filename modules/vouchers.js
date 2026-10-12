// Poklon vaučeri: izdavanje, slanje emailom (izgleda kao kartica), štampa, iskorišćen / istekao.
const T = require('../lib/time');

module.exports = (ctx) => {
  const { app, store, mailer, requireAdmin } = ctx;
  const list = () => store.data.vouchers;
  const S = () => store.settings;
  const clean = (v, n = 200) => String(v ?? '').trim().slice(0, n);
  const emailOk = (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  function status(v) {
    if (v.usedAt) return 'used';
    if (v.validUntil < T.todayStr()) return 'expired';
    return 'active';
  }
  const view = (v) => ({ ...v, status: status(v), daysLeft: T.daysBetween(T.todayStr(), v.validUntil) });

  function fromBody(b, v = {}) {
    const out = {
      recipientName: clean(b.recipientName, 120),
      fromName: clean(b.fromName, 120),
      validUntil: clean(b.validUntil, 10),
      message: clean(b.message, 1200),
      value: clean(b.value, 120),
      email: clean(b.email, 200),
      buyerEmail: clean(b.buyerEmail, 200),
      note: clean(b.note, 600),
    };
    if (!out.recipientName) return { error: 'Upišite ime i prezime osobe koja dobija vaučer.' };
    if (!T.isDate(out.validUntil)) return { error: 'Izaberite do kada vaučer važi.' };
    if (!emailOk(out.email) || !emailOk(out.buyerEmail)) return { error: 'Email adresa nije ispravna.' };
    return { ...v, ...out };
  }

  // Broj vaučera: POK-2026-0007 (lako se čita i diktira preko telefona)
  function nextCode() {
    store.data.counters.voucher += 1;
    return `POK-${T.todayStr().slice(0, 4)}-${String(store.data.counters.voucher).padStart(4, '0')}`;
  }

  app.get('/api/admin/vouchers', requireAdmin, (req, res) => res.json(list().map(view)));

  app.post('/api/admin/vouchers', requireAdmin, (req, res) => {
    const v = fromBody(req.body || {});
    if (v.error) return res.status(400).json(v);
    Object.assign(v, { id: store.newId(5), code: nextCode(), createdAt: Date.now(), createdBy: req.user.name || req.user.username, usedAt: null, sent: [] });
    list().unshift(v);
    store.save();
    res.json(view(v));
  });

  app.put('/api/admin/vouchers/:id', requireAdmin, (req, res) => {
    const i = list().findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Vaučer ne postoji.' });
    const v = fromBody(req.body || {}, list()[i]);
    if (v.error) return res.status(400).json(v);
    list()[i] = v;
    store.save();
    res.json(view(v));
  });

  app.post('/api/admin/vouchers/:id/used', requireAdmin, (req, res) => {
    const v = list().find((x) => x.id === req.params.id);
    if (!v) return res.status(404).json({ error: 'Vaučer ne postoji.' });
    v.usedAt = req.body?.used ? Date.now() : null;
    v.usedNote = req.body?.used ? clean(req.body.note, 300) : '';
    store.save();
    res.json(view(v));
  });

  app.post('/api/admin/vouchers/:id/send', requireAdmin, async (req, res) => {
    const v = list().find((x) => x.id === req.params.id);
    if (!v) return res.status(404).json({ error: 'Vaučer ne postoji.' });
    const to = clean(req.body?.to, 200);
    if (!to || !emailOk(to)) return res.status(400).json({ error: 'Upišite ispravnu email adresu.' });
    const s = S();
    const intro = clean(req.body?.text, 2000);
    try {
      await mailer.sendSimple(s, {
        to,
        subject: `Poklon vaučer za ${v.recipientName} – ${s.studioName}`,
        body:
          intro ||
          `Zdravo,\n\n${v.fromName ? `${v.fromName} vam poklanja` : 'Dobili ste'} poklon vaučer za fotografisanje u studiju ${s.studioName}.\n\nZa zakazivanje termina javite nam se telefonom ili odgovorite na ovu poruku i navedite broj vaučera.`,
        card: { kind: 'voucher', name: v.recipientName, from: v.fromName, value: v.value, message: v.message, validUntil: T.dateLong(v.validUntil), code: v.code },
      });
      (v.sent ||= []).push({ to, at: Date.now() });
      store.save();
      res.json(view(v));
    } catch (e) {
      res.status(502).json({ error: 'Email nije poslat: ' + e.message });
    }
  });

  app.delete('/api/admin/vouchers/:id', requireAdmin, (req, res) => {
    store.data.vouchers = list().filter((x) => x.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  // Obaveštenje 7 dana pre isteka neiskorišćenog vaučera
  ctx.every(() => {
    for (const v of list()) {
      if (v.usedAt) continue;
      const d = T.daysBetween(T.todayStr(), v.validUntil);
      if (d >= 0 && d <= 7)
        ctx.notify({ type: 'voucher', title: `Vaučer ističe: ${v.recipientName}`, text: `${v.code} važi do ${T.dateLong(v.validUntil)}`, link: '#vouchers', key: 'vexp:' + v.id });
    }
  });
};
