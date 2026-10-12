// Ponude: pravljenje ponude u panelu, slanje klijentu emailom, prihvatanje ili
// odbijanje na sajtu i pretvaranje prihvaćene ponude u zakazivanje.
const crypto = require('crypto');
const T = require('../lib/time');
const { esc, formatMoney, fill } = require('../lib/util');
const { byKey } = require('../lib/categories');

module.exports = (ctx) => {
  const { app, store, mailer, requireAdmin, notify } = ctx;
  const list = () => store.data.offers;
  const S = () => store.settings;
  const clean = (v, n = 200) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
  const text = (v, n = 2000) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
  const num = (v, d = 0) => (v === '' || v == null || isNaN(Number(v)) ? d : Number(v));
  const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // ---------- stanje i cena ----------
  function status(o) {
    if (o.status === 'draft' || o.status === 'accepted' || o.status === 'declined' || o.status === 'booked') return o.status;
    if (o.validUntil && o.validUntil < T.todayStr()) return 'expired';
    return o.status; // 'sent'
  }

  function price(o) {
    const p = store.data.packages.find((x) => x.id === o.packageId);
    const base = p ? p.price : num(o.packagePrice);
    const extras = (o.items || []).map((i) => ({ name: i.name, qty: Math.max(1, Math.round(num(i.qty, 1))), price: num(i.price) }));
    const extrasTotal = extras.reduce((sum, i) => sum + i.price * i.qty, 0);
    const disc = Math.min(100, Math.max(0, num(o.discountPct)));
    const total = Math.round((base + extrasTotal) * (1 - disc / 100));
    const deposit = Math.max(0, Math.round(num(o.deposit)));
    return {
      packageName: p ? p.name : clean(o.packageName, 120),
      packagePrice: base,
      extras,
      extrasTotal,
      discountPct: disc,
      total,
      deposit,
      remaining: Math.max(0, total - deposit),
    };
  }

  const view = (o) => ({ ...o, status: status(o), price: price(o), categoryName: byKey[o.category]?.name || '' });

  // Broj ponude: PON-2026-0007
  function nextCode() {
    store.data.counters.offer = (store.data.counters.offer || 0) + 1;
    return `PON-${T.todayStr().slice(0, 4)}-${String(store.data.counters.offer).padStart(4, '0')}`;
  }

  function fromBody(b, o = {}) {
    const out = {
      clientName: clean(b.clientName, 120),
      email: clean(b.email, 200),
      phone: clean(b.phone, 60),
      category: byKey[clean(b.category, 40)] ? clean(b.category, 40) : '',
      packageId: clean(b.packageId, 40),
      packageName: clean(b.packageName, 120),
      packagePrice: num(b.packagePrice),
      items: Array.isArray(b.items)
        ? b.items
            .map((i) => ({ name: clean(i.name, 120), qty: Math.max(1, Math.round(num(i.qty, 1))), price: num(i.price) }))
            .filter((i) => i.name)
            .slice(0, 20)
        : o.items || [],
      discountPct: Math.min(100, Math.max(0, num(b.discountPct))),
      deposit: Math.max(0, num(b.deposit)),
      date: T.isDate(b.date) ? b.date : '',
      time: T.isTime(b.time) ? b.time : '',
      location: clean(b.location, 160),
      intro: text(b.intro, 3000),
      note: text(b.note, 1500),
      validUntil: T.isDate(b.validUntil) ? b.validUntil : '',
    };
    if (!out.clientName) return { error: 'Upišite ime i prezime klijenta.' };
    if (!emailOk(out.email)) return { error: 'Upišite ispravnu email adresu klijenta.' };
    if (!out.validUntil) out.validUntil = T.addDays(T.todayStr(), Math.max(1, Number(S().offerValidDays) || 7));
    return { ...o, ...out };
  }

  // ---------- panel ----------
  app.get('/api/admin/offers', requireAdmin, (req, res) => res.json(list().map(view)));

  app.post('/api/admin/offers', requireAdmin, (req, res) => {
    const o = fromBody(req.body || {});
    if (o.error) return res.status(400).json(o);
    Object.assign(o, {
      id: store.newId(5),
      code: nextCode(),
      token: crypto.randomBytes(9).toString('base64url'),
      status: 'draft',
      createdAt: Date.now(),
      createdBy: req.user.name || req.user.username,
      sent: [],
    });
    list().unshift(o);
    store.save();
    res.json(view(o));
  });

  app.put('/api/admin/offers/:id', requireAdmin, (req, res) => {
    const i = list().findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Ponuda ne postoji.' });
    const o = fromBody(req.body || {}, list()[i]);
    if (o.error) return res.status(400).json(o);
    list()[i] = o;
    store.save();
    res.json(view(o));
  });

  app.delete('/api/admin/offers/:id', requireAdmin, (req, res) => {
    store.data.offers = list().filter((x) => x.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  // Slanje ponude klijentu
  app.post('/api/admin/offers/:id/send', requireAdmin, async (req, res) => {
    const o = list().find((x) => x.id === req.params.id);
    if (!o) return res.status(404).json({ error: 'Ponuda ne postoji.' });
    const s = S();
    const to = clean(req.body?.to, 200) || o.email;
    if (!emailOk(to)) return res.status(400).json({ error: 'Upišite ispravnu email adresu.' });
    const p = price(o);
    const vars = {
      ime: o.clientName,
      studio: s.studioName,
      kategorija: byKey[o.category]?.name || 'fotografisanje',
      paket: p.packageName,
      iznos: formatMoney(p.total, s.currency),
      kapara: p.deposit ? formatMoney(p.deposit, s.currency) : '',
      vazi_do: T.dateLong(o.validUntil),
      broj: o.code,
    };
    try {
      await mailer.sendSimple(s, {
        to,
        toName: o.clientName,
        subject: fill(s.offerSubject, vars),
        body: mailer.cleanText(fill(s.offerBody, vars)),
        cta: { label: 'Pogledaj ponudu', url: `${ctx.baseUrl(req)}/ponuda/${o.token}` },
      });
      (o.sent ||= []).push({ to, at: Date.now() });
      o.sentAt = Date.now();
      if (o.status === 'draft') o.status = 'sent';
      store.save();
      res.json(view(o));
    } catch (e) {
      res.status(502).json({ error: 'Email nije poslat: ' + e.message });
    }
  });

  // Ručna promena stanja iz panela (npr. kada je zakazano iz ponude)
  app.post('/api/admin/offers/:id/state', requireAdmin, (req, res) => {
    const o = list().find((x) => x.id === req.params.id);
    if (!o) return res.status(404).json({ error: 'Ponuda ne postoji.' });
    const st = clean(req.body?.status, 20);
    if (!['draft', 'sent', 'accepted', 'declined', 'booked'].includes(st)) return res.status(400).json({ error: 'Nepoznato stanje.' });
    o.status = st;
    if (st === 'booked') o.bookedAt = Date.now();
    store.save();
    res.json(view(o));
  });

  // ---------- javno: ponuda na sajtu ----------
  const byToken = (t) => list().find((x) => x.token === t);

  app.get('/ponuda/:token', (req, res) => {
    const o = byToken(req.params.token);
    if (!o || o.status === 'draft') return res.status(404).type('html').send(ctx.renderMessage('Ponuda nije pronađena', 'Proverite link iz poruke ili nam se javite.', req));
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(offerPage(o, req));
  });

  app.post('/api/offer/:token/:answer', async (req, res) => {
    const o = byToken(req.params.token);
    const answer = req.params.answer;
    if (!o || o.status === 'draft') return res.status(404).json({ error: 'Ponuda nije pronađena.' });
    if (!['accept', 'decline'].includes(answer)) return res.status(400).json({ error: 'Nepoznat odgovor.' });
    if (status(o) === 'expired') return res.status(400).json({ error: 'Ponuda je istekla. Javite nam se za novu.' });
    if (['accepted', 'declined', 'booked'].includes(o.status)) return res.json({ ok: true, status: o.status });

    o.status = answer === 'accept' ? 'accepted' : 'declined';
    o.answeredAt = Date.now();
    o.clientNote = text(req.body?.note, 1000);
    store.save();

    const s = S();
    const p = price(o);
    notify({
      type: 'offer',
      title: answer === 'accept' ? `Ponuda prihvaćena: ${o.clientName}` : `Ponuda odbijena: ${o.clientName}`,
      text: `${o.code} · ${p.packageName || byKey[o.category]?.name || ''} · ${formatMoney(p.total, s.currency)}`,
      link: '#offers',
      key: 'offer:' + o.id,
    });
    const to = s.notifyEmail || s.contactEmail || s.fromEmail;
    if (to && s.smtpHost) {
      mailer
        .sendSimple(s, {
          to,
          subject: `${answer === 'accept' ? 'Prihvaćena' : 'Odbijena'} ponuda ${o.code} – ${o.clientName}`,
          body: [
            `Klijent: ${o.clientName}, ${o.email}${o.phone ? ', ' + o.phone : ''}`,
            `Ponuda: ${o.code}${p.packageName ? ' · ' + p.packageName : ''}`,
            `Iznos: ${formatMoney(p.total, s.currency)}${p.deposit ? ` (kapara ${formatMoney(p.deposit, s.currency)})` : ''}`,
            o.clientNote ? `\nPoruka klijenta: ${o.clientNote}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          cta: { label: 'Otvori panel', url: `${ctx.baseUrl(req)}/admin#offers` },
        })
        .catch((e) => console.error('Ponuda – email studiju nije poslat:', e.message));
    }
    if (answer === 'accept' && s.smtpHost) {
      mailer
        .sendSimple(s, {
          to: o.email,
          toName: o.clientName,
          subject: `Hvala na potvrdi – ${s.studioName}`,
          body:
            `Zdravo ${o.clientName},\n\n` +
            `hvala što ste prihvatili ponudu ${o.code}. Javljamo se u najkraćem roku da dogovorimo tačan termin fotografisanja.\n\n` +
            (p.deposit ? `Kapara: ${formatMoney(p.deposit, s.currency)}\nOstatak na dan fotografisanja: ${formatMoney(p.remaining, s.currency)}\n\n` : '') +
            `Srdačan pozdrav,\n${s.studioName}`,
        })
        .catch((e) => console.error('Ponuda – potvrda klijentu nije poslata:', e.message));
    }
    res.json({ ok: true, status: o.status });
  });

  // ---------- izgled javne stranice ----------
  function offerPage(o, req) {
    const s = S();
    const p = price(o);
    const st = status(o);
    const v = store.data.brand.v;
    const money = (n) => formatMoney(n, s.currency);
    const row = (label, value, cls = '') => `<div class="row ${cls}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
    const done =
      st === 'accepted' || st === 'booked'
        ? ['Ponuda je prihvaćena', 'Hvala vam! Javljamo se u najkraćem roku da dogovorimo tačan termin.']
        : st === 'declined'
          ? ['Ponuda je odbijena', 'Hvala na odgovoru. Ako se predomislite, slobodno nam se javite.']
          : st === 'expired'
            ? ['Ponuda je istekla', `Važila je do ${T.dateLong(o.validUntil)}. Javite nam se i poslaćemo novu.`]
            : null;

    return `<!doctype html>
<html lang="sr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Ponuda ${esc(o.code)} – ${esc(s.studioName)}</title>
<link rel="icon" href="/brand/icon">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Italiana&family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/brand/theme.css">
<style>
*{box-sizing:border-box}body{margin:0;background:var(--wash);color:#4a3236;font-family:'Jost',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:640px;margin:0 auto;padding:28px 18px 60px}
.logo{display:block;text-align:center;margin-bottom:26px}.logo img{height:64px;width:auto;display:inline-block}
.card{background:#fff;border-radius:22px;padding:clamp(22px,5vw,38px);box-shadow:0 18px 50px rgba(74,50,54,.1)}
h1{font-family:'Italiana',Georgia,serif;font-weight:400;font-size:clamp(28px,6vw,38px);margin:0 0 6px;text-align:center}
.sub{text-align:center;color:#9c8486;font-size:14px;margin:0 0 26px}
h2{font-family:'Italiana',Georgia,serif;font-weight:400;font-size:20px;margin:28px 0 10px}
.intro{white-space:pre-wrap;line-height:1.65;margin:0 0 6px}
.row{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid var(--blush-line)}
.row span{color:#9c8486}.row b{font-weight:500;text-align:right}
.row.total{border-bottom:0;padding-top:16px;font-size:19px}.row.total b{color:var(--accent-deep);font-weight:600}
.row.rest b{color:var(--accent-strong)}
.note{background:var(--wash);border-radius:14px;padding:14px 16px;font-size:14px;color:#6f5a5c;margin-top:18px}
.acts{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}
.btn{flex:1;min-width:180px;border:0;border-radius:999px;padding:15px 24px;font:500 16px 'Jost',sans-serif;cursor:pointer;background:var(--accent-strong);color:#fff;transition:background .2s}
.btn:hover{background:var(--accent-deep)}
.btn.ghost{background:#fff;color:#6f5a5c;box-shadow:inset 0 0 0 1.5px var(--blush-line)}
.btn.ghost:hover{background:var(--wash)}
.btn[disabled]{opacity:.6;cursor:default}
.done{text-align:center;padding:10px 0}.done h1{margin-bottom:10px}
.err{color:#c0392b;font-size:14px;margin:12px 0 0;text-align:center;min-height:18px}
.foot{text-align:center;color:#9c8486;font-size:13px;line-height:1.8;margin-top:26px}
.foot a{color:inherit}
</style></head>
<body><div class="wrap">
<a class="logo" href="/"><img src="/brand/logo?v=${v}" alt="${esc(s.studioName)}"></a>
<div class="card">
${
  done
    ? `<div class="done"><h1>${esc(done[0])}</h1><p class="sub">${esc(done[1])}</p></div>`
    : `<h1>Ponuda za fotografisanje</h1>
<p class="sub">${esc(o.code)} · važi do ${esc(T.dateLong(o.validUntil))}</p>
${o.intro ? `<p class="intro">${esc(o.intro)}</p>` : ''}
<h2>Ponuda</h2>
${row('Za', o.clientName)}
${o.category ? row('Vrsta fotografisanja', byKey[o.category].name) : ''}
${p.packageName ? row('Paket', `${p.packageName} · ${money(p.packagePrice)}`) : ''}
${p.extras.map((i) => row(i.qty > 1 ? `${i.name} × ${i.qty}` : i.name, money(i.price * i.qty))).join('')}
${p.discountPct ? row('Popust', `−${p.discountPct}%`) : ''}
${o.date ? row('Predlog termina', `${T.dateLong(o.date)}${o.time ? ' u ' + o.time : ''}`) : ''}
${o.location ? row('Lokacija', o.location) : ''}
${row('Ukupno', money(p.total), 'total')}
${p.deposit ? row('Kapara', money(p.deposit)) + row('Ostatak na dan fotografisanja', money(p.remaining), 'rest') : ''}
<div class="acts">
  <button class="btn" id="yes">Prihvatam ponudu</button>
  <button class="btn ghost" id="no">Ne, hvala</button>
</div>
<p class="err" id="err"></p>
<div class="note">Prihvatanjem ponude termin još nije konačan – javljamo se da zajedno dogovorimo tačan datum i vreme.</div>`
}
</div>
<div class="foot">
<b>${esc(s.studioName)}</b><br>
${[s.contactPhone ? `<a href="tel:${esc(s.contactPhone.replace(/[^\d+]/g, ''))}">${esc(s.contactPhone)}</a>` : '', s.contactEmail ? `<a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a>` : ''].filter(Boolean).join(' · ')}
${(s.locations || []).map((l) => `<br>${esc(l)}`).join('')}
</div>
</div>
${
  done
    ? ''
    : `<script>
(function(){
 var busy=false;
 function send(answer,btn){
  if(busy)return;busy=true;
  document.getElementById('yes').disabled=true;document.getElementById('no').disabled=true;
  btn.textContent='Šaljem…';
  fetch('/api/offer/${o.token}/'+answer,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})
   .then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'Greška');return j})})
   .then(function(){location.reload()})
   .catch(function(e){busy=false;document.getElementById('err').textContent=e.message;
     document.getElementById('yes').disabled=false;document.getElementById('no').disabled=false;
     document.getElementById('yes').textContent='Prihvatam ponudu';document.getElementById('no').textContent='Ne, hvala';});
 }
 document.getElementById('yes').addEventListener('click',function(){send('accept',this)});
 document.getElementById('no').addEventListener('click',function(){send('decline',this)});
})();
</script>`
}
</body></html>`;
  }

  // Obaveštenje kada ponuda ističe, a klijent se nije izjasnio
  ctx.every(() => {
    for (const o of list()) {
      if (o.status !== 'sent' || !o.validUntil) continue;
      const d = T.daysBetween(T.todayStr(), o.validUntil);
      if (d >= 0 && d <= 2)
        ctx.notify({
          type: 'offer',
          title: `Ponuda ističe: ${o.clientName}`,
          text: `${o.code} važi do ${T.dateLong(o.validUntil)}`,
          link: '#offers',
          key: 'oexp:' + o.id,
        });
    }
  });
};
