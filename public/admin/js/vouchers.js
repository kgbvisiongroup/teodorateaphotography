// Poklon vaučeri: izdavanje, slanje emailom, štampa, iskorišćen / istekao.
(function () {
  'use strict';
  const { $, $$, esc, fmt, api, toast, ask, modal } = App;
  let list = [];
  let filter = 'active';
  const ST = { active: ['Aktivan', 'ok'], used: ['Iskorišćen', 'up'], expired: ['Istekao', 'muted'] };

  // Isti izgled kao u emailu i na štampi
  const ICO = {
    mail: '<path d="M2 5h16v12H2z"/><path d="m2 6 8 6 8-6"/>',
    web: '<circle cx="10" cy="10" r="8"/><path d="M2 10h16M10 2c2.5 2.6 2.5 12.4 0 16M10 2C7.5 4.6 7.5 14.4 10 18"/>',
    phone: '<path d="M4 3h3.5l1.6 4-2.2 1.4a11 11 0 0 0 4.7 4.7L13 10.9l4 1.6V16c0 .6-.5 1.1-1.1 1C8.7 16.4 3.6 11.3 3 4.1 2.9 3.5 3.4 3 4 3z"/>',
    pin: '<path d="M10 18s6-5.2 6-9.5A6 6 0 0 0 4 8.5C4 12.8 10 18 10 18z"/><circle cx="10" cy="8.4" r="2.2"/>',
  };
  const ico = (k) => `<svg viewBox="0 0 20 20" aria-hidden="true">${ICO[k]}</svg>`;

  function card(v) {
    const c = App.meta?.contact || {};
    const locs = App.meta?.locations || [];
    const box = (label, value) => `<div class="vc-box"><small>${label}</small><b>${esc(value || '')}</b></div>`;
    const line = (k, t) => (t ? `<div class="vc-c">${ico(k)}<span>${esc(t)}</span></div>` : '');
    return `<div class="vcard">
<div class="vc-head"><span>Poklanjam ti najlepšu uspomenu</span><span>jer je to najvredniji poklon</span></div>
${v.value ? `<div class="vc-value">${esc(v.value)}</div>` : ''}
<div class="vc-boxes">${box('ZA', v.recipientName)}${box('OD', v.fromName)}${box('VAŽI DO', v.validUntil ? fmt.date(v.validUntil) : '')}</div>
<div class="vc-box vc-msgbox"><small>PORUKA</small><p>${esc(v.message || '')}</p></div>
<div class="vc-foot">
${line('mail', c.email)}${line('web', c.website)}${line('phone', c.phone)}
${locs.length ? `<div class="vc-c">${ico('pin')}<span>${locs.map(esc).join('<br>')}</span></div>` : ''}
</div>
<span class="vc-code">${esc(v.code || 'POK-…')}</span>
</div>`;
  }

  async function load() {
    list = await api('GET', '/api/admin/vouchers');
    render();
  }
  function render() {
    const counts = { active: 0, used: 0, expired: 0 };
    list.forEach((v) => counts[v.status]++);
    const shown = filter === 'all' ? list : list.filter((v) => v.status === filter);
    $('#vouchers').innerHTML = `<div class="panel">
<div class="toolbar"><div class="seg" id="vFilter">${[['active', 'Aktivni'], ['used', 'Iskorišćeni'], ['expired', 'Istekli'], ['all', 'Svi']]
      .map(([k, l]) => `<button data-f="${k}" class="${filter === k ? 'on' : ''}">${l}${k !== 'all' ? ` <span class="cnt">${counts[k]}</span>` : ''}</button>`)
      .join('')}</div></div>
${shown.length ? `<div class="v-grid">${shown
      .map(
        (v) => `<div class="v-item" data-id="${v.id}">
${card(v)}
<div class="v-meta">
  <div>${(() => {
    const [l, c] = ST[v.status];
    return `<span class="tag ${c}">${l}</span>`;
  })()} ${v.status === 'active' ? `<span class="small sub">još ${fmt.days(v.daysLeft)}</span>` : v.status === 'used' ? `<span class="small sub">${fmt.stamp(v.usedAt)}</span>` : ''}</div>
  <p class="small sub">${v.sent?.length ? `Poslat na ${esc(v.sent[v.sent.length - 1].to)} · ${fmt.stamp(v.sent[v.sent.length - 1].at)}` : 'Još nije poslat emailom'}${v.note ? `<br>Beleška: ${esc(v.note)}` : ''}</p>
  <div class="acts left">
    <button class="btn sm primary" data-send>Pošalji emailom</button>
    <button class="btn sm" data-print>Odštampaj</button>
    <button class="btn sm" data-used>${v.usedAt ? 'Vrati kao aktivan' : 'Iskorišćen'}</button>
    <button class="btn sm" data-edit>Izmeni</button>
    <button class="btn sm danger" data-del>Obriši</button>
  </div>
</div></div>`
      )
      .join('')}</div>` : `<div class="empty">${filter === 'active' ? 'Nema aktivnih vaučera.<br><button class="btn primary" id="addV2">Izdaj vaučer</button>' : 'Nema vaučera u ovoj grupi.'}</div>`}
</div>`;
    App.refreshBrand();
    $$('#vFilter button').forEach((b) => (b.onclick = () => ((filter = b.dataset.f), render())));
    $('#addV2')?.addEventListener('click', () => edit());
  }

  $('#vouchers').addEventListener('click', async (e) => {
    const it = e.target.closest('.v-item');
    if (!it) return;
    const v = list.find((x) => x.id === it.dataset.id);
    if (e.target.closest('[data-edit]')) edit(v);
    if (e.target.closest('[data-send]')) send(v);
    if (e.target.closest('[data-print]')) print(v);
    if (e.target.closest('[data-used]')) {
      await api('POST', `/api/admin/vouchers/${v.id}/used`, { used: !v.usedAt });
      toast(v.usedAt ? 'Vaučer je ponovo aktivan' : 'Označeno kao iskorišćen');
      load();
    }
    if (e.target.closest('[data-del]')) {
      if (!(await ask(`Obrisati vaučer ${v.code}?`, 'Brisanje se ne može poništiti.', 'Obriši', true))) return;
      await api('DELETE', '/api/admin/vouchers/' + v.id);
      load();
    }
  });

  function edit(v) {
    const isNew = !v;
    v = v || { recipientName: '', fromName: '', validUntil: App.addDays(App.today(), 182), message: '', value: '', email: '', note: '' };
    const y = new Date().getFullYear();
    const d = modal.open(
      `<form class="mform vform"><h3>${isNew ? 'Novi poklon vaučer' : 'Izmena vaučera ' + esc(v.code)}</h3>
<div class="v-edit">
<div>
  <label class="f">Za koga (ime i prezime)<input name="recipientName" value="${esc(v.recipientName)}" required></label>
  <label class="f">Od koga<input name="fromName" value="${esc(v.fromName)}" placeholder="npr. Tvoji Marko i Ana"></label>
  <div class="f"><span class="lbl">Važi do</span>${App.dateField('validUntil', v.validUntil, { years: `${y}:${y + 3}`, min: isNew ? App.today() : '' })}</div>
  <label class="f">Poklon <small>nije obavezno: paket ili iznos</small><input name="value" value="${esc(v.value)}" placeholder="npr. Newborn Mini paket ili 100 €"></label>
  <label class="f">Poruka<textarea name="message" rows="3" placeholder="npr. Za najlepše uspomene!">${esc(v.message)}</textarea></label>
  <label class="f">Email primaoca <small>nije obavezno</small><input name="email" type="email" value="${esc(v.email)}"></label>
  <label class="f">Beleška za vas <small>ne vidi je primalac</small><input name="note" value="${esc(v.note || '')}" placeholder="npr. plaćeno gotovinom"></label>
</div>
<div class="v-prev"><span class="lbl">Ovako izgleda</span><div id="vPrev">${card(v)}</div></div>
</div>
<p class="err"></p>
<div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">${isNew ? 'Izdaj vaučer' : 'Sačuvaj'}</button></div></form>`,
      async (f) => {
        const body = Object.fromEntries(['recipientName', 'fromName', 'validUntil', 'value', 'message', 'email', 'note'].map((k) => [k, f.elements[k].value]));
        const saved = await api(isNew ? 'POST' : 'PUT', '/api/admin/vouchers' + (isNew ? '' : '/' + v.id), body);
        toast(isNew ? `Vaučer ${saved.code} je izdat` : 'Sačuvano');
        filter = 'active';
        await load();
        if (isNew && saved.email) send(saved);
      }
    );
    const f = d.querySelector('form');
    const upd = () => {
      const cur = { ...v, ...Object.fromEntries(['recipientName', 'fromName', 'validUntil', 'value', 'message'].map((k) => [k, f.elements[k].value])) };
      $('#vPrev').innerHTML = card(cur);
      App.refreshBrand();
    };
    f.addEventListener('input', upd);
    f.addEventListener('change', upd);
    App.refreshBrand();
  }

  function send(v) {
    const s = `Zdravo,\n\n${v.fromName ? `${v.fromName} vam poklanja` : 'Dobili ste'} poklon vaučer za fotografisanje u našem studiju.\n\nZa zakazivanje termina javite nam se telefonom ili odgovorite na ovu poruku i navedite broj vaučera.`;
    modal.open(
      `<form class="mform"><h3>Pošalji vaučer emailom</h3>
<label class="f">Email<input name="to" type="email" value="${esc(v.email || '')}" required></label>
<label class="f">Tekst iznad vaučera<textarea name="text" rows="6">${esc(s)}</textarea></label>
<p class="small sub">Ispod teksta ide vaučer, a u dnu poruke vaši podaci: email, telefon, sajt i adrese.</p>
<p class="err"></p>
<div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Pošalji</button></div></form>`,
      async (f) => {
        await api('POST', `/api/admin/vouchers/${v.id}/send`, { to: f.to.value, text: f.text.value });
        toast(`Vaučer je poslat na ${f.to.value}`);
        load();
      }
    );
  }

  function print(v) {
    const w = window.open('', '_blank', 'width=760,height=620');
    // Kontakt podaci su sada deo samog vaučera, pa podnožje za štampu više nije potrebno.
    w.document.write(`<!doctype html><html><head><title>Poklon vaučer ${esc(v.code)}</title>
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Italiana&family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/brand/theme.css"><link rel="stylesheet" href="/admin/admin.css"></head>
<body class="print-card"><div>${card(v)}</div><script>setTimeout(()=>print(),700)<\/script></body></html>`);
    w.document.close();
  }

  App.view('vouchers', {
    title: 'Poklon vaučeri',
    sub: 'Izdajte vaučer, pošaljite ga emailom ili odštampajte, i označite kada je iskorišćen.',
    actions: '<button class="btn primary" id="addV">Novi vaučer</button>',
    load: async () => {
      await load();
      $('#addV').onclick = () => edit();
    },
  });
})();
