// Ponude: pravljenje i slanje ponude klijentu, praćenje odgovora i zakazivanje iz prihvaćene ponude.
(function () {
  'use strict';
  const { $, $$, esc, fmt, api, toast, ask, modal } = App;
  const ST = {
    draft: ['Nacrt', ''],
    sent: ['Poslato', 'warn'],
    accepted: ['Prihvaćeno', 'ok'],
    declined: ['Odbijeno', 'err'],
    expired: ['Isteklo', ''],
    booked: ['Zakazano', 'ok'],
  };
  let list = [];
  let filter = 'open';
  let search = '';

  async function load(params) {
    if (params?.get('f')) filter = params.get('f');
    [list] = await Promise.all([api('GET', '/api/admin/offers'), App.load('packages', true)]);
    render();
    const nb = $('#newOffer');
    if (nb) nb.onclick = () => edit();
  }

  const shown = () => {
    const s = search.trim().toLowerCase();
    return list.filter((o) => {
      if (filter === 'open' && !['draft', 'sent', 'accepted'].includes(o.status)) return false;
      if (filter === 'accepted' && !['accepted', 'booked'].includes(o.status)) return false;
      if (filter === 'closed' && !['declined', 'expired', 'booked'].includes(o.status)) return false;
      if (!s) return true;
      return [o.clientName, o.email, o.phone, o.code].join(' ').toLowerCase().includes(s);
    });
  };

  function render() {
    const open = list.filter((o) => o.status === 'accepted').length;
    $('#offersBox').innerHTML = `<div class="panel">
<div class="toolbar">
  <div class="seg" id="ofFilter" role="tablist">
    <button data-f="open" class="${filter === 'open' ? 'on' : ''}">U toku</button>
    <button data-f="accepted" class="${filter === 'accepted' ? 'on' : ''}">Prihvaćene${open ? ` (${open})` : ''}</button>
    <button data-f="closed" class="${filter === 'closed' ? 'on' : ''}">Završene</button>
    <button data-f="all" class="${filter === 'all' ? 'on' : ''}">Sve</button>
  </div>
  <input type="search" id="ofSearch" placeholder="Pretraga po imenu, emailu, broju" aria-label="Pretraga" value="${esc(search)}">
</div>
${rows()}
</div>`;
    $$('#ofFilter button').forEach((b) => (b.onclick = () => ((filter = b.dataset.f), render())));
    const s = $('#ofSearch');
    s.oninput = () => {
      search = s.value;
      const pos = s.selectionStart;
      render();
      const n = $('#ofSearch');
      n.focus();
      n.setSelectionRange(pos, pos);
    };
    bind();
  }

  function rows() {
    const l = shown();
    if (!l.length) return '<div class="empty">Nema ponuda u ovom pregledu.</div>';
    return `<div class="st-list">${l
      .map((o) => {
        const [lbl, cls] = ST[o.status] || ST.draft;
        const p = o.price;
        const bits = [o.code, o.categoryName, p.packageName, o.email, o.phone].filter(Boolean);
        return `<div class="st-row">
<div class="st-main"><b>${esc(o.clientName)}</b><small>${bits.map(esc).join(' · ')}</small>
<small>${o.date ? `Predlog termina: ${fmt.date(o.date)}${o.time ? ' u ' + o.time : ''} · ` : ''}važi do ${fmt.date(o.validUntil)}${o.sentAt ? ` · poslato ${fmt.stamp(o.sentAt)}` : ''}${o.answeredAt ? ` · odgovor ${fmt.stamp(o.answeredAt)}` : ''}</small>
${o.clientNote ? `<small>Poruka klijenta: „${esc(o.clientNote)}"</small>` : ''}</div>
<div class="st-num"><b>${fmt.money(p.total)}</b><small>${p.deposit ? `kapara ${fmt.money(p.deposit)}` : 'bez kapare'}</small></div>
<span class="tag ${cls}">${lbl}</span>
<div class="acts">
${o.status === 'accepted' ? `<a class="btn sm primary" href="${bookLink(o)}">Zakaži termin</a>` : ''}
${['draft', 'sent', 'expired'].includes(o.status) ? `<button class="btn sm ${o.status === 'draft' ? 'primary' : ''}" data-send="${o.id}">${o.status === 'draft' ? 'Pošalji' : 'Pošalji ponovo'}</button>` : ''}
<a class="btn sm" href="/ponuda/${esc(o.token)}" target="_blank" rel="noopener">Pogledaj</a>
<button class="btn sm" data-edit="${o.id}">Izmeni</button>
<button class="btn sm danger" data-del="${o.id}">Obriši</button>
</div></div>`;
      })
      .join('')}</div>`;
  }

  function bind() {
    $$('[data-edit]').forEach((b) => (b.onclick = () => edit(list.find((o) => o.id === b.dataset.edit))));
    $$('[data-send]').forEach((b) => (b.onclick = () => send(list.find((o) => o.id === b.dataset.send))));
    $$('[data-del]').forEach((b) => (b.onclick = async () => {
      const o = list.find((x) => x.id === b.dataset.del);
      if (!(await ask('Obrisati ponudu?', `${o.code} – ${o.clientName}. Link koji je klijent dobio prestaje da radi.`, 'Obriši', true))) return;
      await api('DELETE', '/api/admin/offers/' + o.id);
      load();
    }));
    $$('[href^="#book"]').forEach((a) => (a.onclick = () => {
      const o = list.find((x) => bookLink(x) === a.getAttribute('href'));
      if (o) api('POST', `/api/admin/offers/${o.id}/state`, { status: 'booked' }).catch(() => {});
    }));
  }

  // Prihvaćena ponuda otvara čarobnjak za zakazivanje sa već popunjenim podacima
  function bookLink(o) {
    const q = new URLSearchParams();
    if (o.category) q.set('cat', o.category);
    if (o.date) q.set('date', o.date);
    if (o.time) q.set('time', o.time);
    if (o.email) q.set('email', o.email);
    if (o.phone) q.set('phone', o.phone);
    if (o.location) q.set('location', o.location);
    if (o.packageId) q.set('packageId', o.packageId);
    if (o.price.deposit) q.set('deposit', o.price.deposit);
    // Kod trudničkog se fotografiše sama klijentkinja, kod ostalih je to roditelj.
    if (o.category === 'trudnicko') {
      const parts = (o.clientName || '').trim().split(/\s+/);
      q.set('firstName', parts[0] || '');
      q.set('lastName', parts.slice(1).join(' '));
    } else {
      q.set('parentName', o.clientName || '');
    }
    q.set('note', `Po ponudi ${o.code}`);
    return '#book?' + q.toString();
  }

  // ---------- obrazac ----------
  function itemRow(it = { name: '', qty: 1, price: '' }) {
    return `<div class="of-item">
<input name="itName" value="${esc(it.name)}" placeholder="npr. Foto album 20×20">
<input name="itQty" value="${esc(it.qty || 1)}" inputmode="numeric" aria-label="Količina">
<input name="itPrice" value="${esc(it.price)}" inputmode="numeric" aria-label="Cena">
<button type="button" class="btn sm danger" data-rm>×</button>
</div>`;
  }

  function edit(o) {
    const isNew = !o;
    const y = new Date().getFullYear();
    o = o || {
      clientName: '',
      email: '',
      phone: '',
      category: '',
      packageId: '',
      items: [],
      discountPct: 0,
      deposit: '',
      date: '',
      time: '',
      location: '',
      intro: '',
      note: '',
      validUntil: App.addDays(App.today(), 7),
    };
    const cats = App.meta?.categories || [];
    const packs = (App.cache.packages || []).filter((p) => p.active !== false);
    const locs = App.meta?.locations || [];

    const d = modal.open(
      `<form class="mform of-form"><h3>${isNew ? 'Nova ponuda' : 'Ponuda ' + esc(o.code)}</h3>
<div class="row2">
  <label class="f">Ime i prezime klijenta<input name="clientName" value="${esc(o.clientName)}" required></label>
  <label class="f">Email<input name="email" type="email" value="${esc(o.email)}" required></label>
</div>
<div class="row2">
  <label class="f">Telefon<input name="phone" value="${esc(o.phone)}"></label>
  <label class="f">Vrsta fotografisanja<select name="category"><option value="">—</option>${cats
    .map((c) => `<option value="${esc(c.key)}" ${c.key === o.category ? 'selected' : ''}>${esc(c.name)}</option>`)
    .join('')}</select></label>
</div>
<label class="f">Paket<select name="packageId"><option value="">Bez paketa</option>${packs
        .map((p) => `<option value="${esc(p.id)}" data-price="${p.price}" ${p.id === o.packageId ? 'selected' : ''}>${esc(p.name)} (${esc(App.cat(p.category)?.name || '')}) – ${fmt.money(p.price)}</option>`)
        .join('')}</select></label>

<div class="f"><span class="lbl">Dodatne stavke <small>album, book, kutija, dodatni sat…</small></span>
  <div id="ofItems">${(o.items || []).map(itemRow).join('')}</div>
  <button type="button" class="btn sm" id="ofAdd">+ dodaj stavku</button>
</div>

<div class="row3">
  <label class="f">Popust (%)<input name="discountPct" value="${esc(o.discountPct || '')}" inputmode="numeric"></label>
  <label class="f">Kapara<input name="deposit" value="${esc(o.deposit || '')}" inputmode="numeric"></label>
  <div class="f"><span class="lbl">Ponuda važi do</span>${App.dateField('validUntil', o.validUntil, { years: `${y}:${y + 2}`, min: App.today() })}</div>
</div>

<div class="row3">
  <div class="f"><span class="lbl">Predlog datuma <small>nije obavezno</small></span>${App.dateField('date', o.date, { years: `${y}:${y + 2}` })}</div>
  <div class="f"><span class="lbl">Vreme</span>${App.timeField('time', o.time, { label: 'Vreme' })}</div>
  <label class="f">Lokacija<select name="location"><option value="">—</option>${locs
        .map((l) => `<option ${l === o.location ? 'selected' : ''}>${esc(l)}</option>`)
        .join('')}</select></label>
</div>

<label class="f">Poruka klijentu <small>vidi se na vrhu ponude</small><textarea name="intro" rows="3" placeholder="npr. Hvala na interesovanju! Evo predloga za newborn fotografisanje…">${esc(o.intro || '')}</textarea></label>
<label class="f">Beleška za vas <small>klijent je ne vidi</small><input name="note" value="${esc(o.note || '')}"></label>

<div class="of-total" id="ofTotal"></div>
<p class="err"></p>
<div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">${isNew ? 'Sačuvaj ponudu' : 'Sačuvaj'}</button></div></form>`,
      async (f) => {
        const saved = await api(isNew ? 'POST' : 'PUT', '/api/admin/offers' + (isNew ? '' : '/' + o.id), body(f));
        toast(isNew ? `Ponuda ${saved.code} je sačuvana` : 'Sačuvano');
        await load();
        // obrazac se prvo zatvori, pa se tek onda otvara prozor za slanje (isti dijalog)
        if (isNew) setTimeout(() => send(saved), 80);
      }
    );

    const f = d.querySelector('form');
    const items = f.querySelector('#ofItems');
    f.querySelector('#ofAdd').onclick = () => {
      items.insertAdjacentHTML('beforeend', itemRow());
      total();
    };
    items.addEventListener('click', (e) => {
      if (e.target.closest('[data-rm]')) {
        e.target.closest('.of-item').remove();
        total();
      }
    });
    const total = () => {
      const b = body(f);
      const pack = packs.find((p) => p.id === b.packageId);
      const base = pack ? pack.price : 0;
      const extras = b.items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
      const sum = Math.round((base + extras) * (1 - (Number(b.discountPct) || 0) / 100));
      const dep = Math.max(0, Math.round(Number(b.deposit) || 0));
      $('#ofTotal').innerHTML = `<div class="row"><span>Ukupno</span><b>${fmt.money(sum)}</b></div>
${dep ? `<div class="row"><span>Kapara</span><b>−${fmt.money(dep)}</b></div><div class="row rest"><span>Ostatak za uplatu</span><b>${fmt.money(Math.max(0, sum - dep))}</b></div>` : ''}`;
    };
    f.addEventListener('input', total);
    f.addEventListener('change', total);
    total();
  }

  function body(f) {
    const get = (n) => (f.elements[n] ? f.elements[n].value : '');
    const names = [...f.querySelectorAll('[name=itName]')].map((x) => x.value);
    const qtys = [...f.querySelectorAll('[name=itQty]')].map((x) => x.value);
    const prices = [...f.querySelectorAll('[name=itPrice]')].map((x) => x.value);
    return {
      clientName: get('clientName'),
      email: get('email'),
      phone: get('phone'),
      category: get('category'),
      packageId: get('packageId'),
      items: names.map((n, i) => ({ name: n, qty: qtys[i], price: prices[i] })).filter((i) => i.name.trim()),
      discountPct: get('discountPct'),
      deposit: get('deposit'),
      date: get('date'),
      time: get('time'),
      location: get('location'),
      intro: get('intro'),
      note: get('note'),
      validUntil: get('validUntil'),
    };
  }

  // ---------- slanje ----------
  function send(o) {
    modal.open(
      `<form class="mform"><h3>Slanje ponude ${esc(o.code)}</h3>
<p class="sub small">Klijent dobija email sa dugmetom koje otvara ponudu. Na njoj bira <b>Prihvatam</b> ili <b>Ne, hvala</b>, a vama odmah stiže obaveštenje.</p>
<label class="f">Email adresa<input name="to" type="email" value="${esc(o.email)}" required></label>
<p class="sub small">Tekst poruke menjate u <i>Email → Ponuda</i>.</p>
<p class="err"></p>
<div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Pošalji ponudu</button></div></form>`,
      async (f) => {
        await api('POST', `/api/admin/offers/${o.id}/send`, { to: f.to.value });
        toast('Ponuda je poslata');
        load();
      }
    );
  }

  App.view('offers', {
    title: 'Ponude',
    sub: 'Pošaljite ponudu klijentu; kada je prihvati, iz nje pravite zakazivanje.',
    actions: '<button class="btn primary" id="newOffer">Nova ponuda</button>',
    load,
  });
})();
