// Upiti sa sajta: zahtevi za termin i poruke iz forme za kontakt.
(function () {
  'use strict';
  const { $, $$, esc, fmt, api, toast, ask } = App;
  let list = [];
  let filter = 'new';
  const ST = { new: ['Novo', 'warn'], done: ['Rešeno', 'ok'], archived: ['Arhivirano', 'muted'] };

  async function load() {
    list = await api('GET', '/api/admin/requests');
    render();
  }

  function bookLink(r) {
    const q = new URLSearchParams();
    if (r.category) q.set('cat', r.category);
    if (r.date) q.set('date', r.date);
    if (r.time) q.set('time', r.time);
    if (r.email) q.set('email', r.email);
    if (r.phone) q.set('phone', r.phone);
    if (r.location) q.set('location', r.location);
    if (r.packageId) q.set('packageId', r.packageId);
    // Kod trudničkog se fotografiše sama osoba koja piše, pa joj ime ide u ime/prezime;
    // kod ostalih vrsta to je roditelj, a ime deteta se upisuje ručno.
    if (r.category === 'trudnicko') {
      const parts = (r.name || '').trim().split(/\s+/);
      q.set('firstName', parts[0] || '');
      q.set('lastName', parts.slice(1).join(' '));
    } else {
      q.set('parentName', r.name || '');
    }
    if (r.message) q.set('note', r.message);
    return '#book?' + q.toString();
  }

  function card(r) {
    const [lbl, cls] = ST[r.status] || ST.new;
    const rows = [
      r.kind === 'booking' && r.date ? ['Termin', `${fmt.date(r.date)}${r.time ? ' u ' + r.time : ''}`] : null,
      r.location ? ['Lokacija', r.location] : null,
      r.packageName ? ['Paket', r.packageName] : null,
    ].filter(Boolean);
    return `<div class="req${r.status !== 'new' ? ' off' : ''}" data-id="${r.id}">
<div class="req-head">
  <div><b>${esc(r.name)}</b><span class="small sub">${esc(r.kind === 'booking' ? 'Upit za termin · ' + (r.categoryName || '') : 'Poruka sa sajta')} · ${fmt.stamp(r.at)}</span></div>
  <span class="tag ${cls}">${lbl}</span>
</div>
<div class="req-contact"><a href="mailto:${esc(r.email)}">${esc(r.email)}</a>${r.phone ? ` · <a href="tel:${esc(r.phone.replace(/[^\d+]/g, ''))}">${esc(r.phone)}</a>` : ''}</div>
${rows.length ? `<div class="req-rows">${rows.map(([k, v]) => `<div><small>${k}</small><span>${esc(v)}</span></div>`).join('')}</div>` : ''}
${r.message ? `<p class="req-msg">${esc(r.message)}</p>` : ''}
${r.note ? `<p class="small sub">Beleška: ${esc(r.note)}</p>` : ''}
<div class="acts left">
  ${r.kind === 'booking' ? `<button class="btn sm primary" data-book>Zakaži termin</button>` : ''}
  <button class="btn sm" data-reply>Odgovori emailom</button>
  <button class="btn sm" data-status="${r.status === 'done' ? 'new' : 'done'}">${r.status === 'done' ? 'Vrati u nove' : 'Označi kao rešeno'}</button>
  <button class="btn sm" data-status="archived">Arhiviraj</button>
  <button class="btn sm" data-note>Beleška</button>
  <button class="btn sm danger" data-del>Obriši</button>
</div></div>`;
  }

  function render() {
    const counts = { new: 0, done: 0, archived: 0 };
    list.forEach((r) => counts[r.status] !== undefined && counts[r.status]++);
    const shown = filter === 'all' ? list : list.filter((r) => r.status === filter);
    $('#navReq').textContent = counts.new || '';
    $('#requests').innerHTML = `<div class="panel">
<div class="toolbar"><div class="seg" id="reqFilter">${[['new', 'Novi'], ['done', 'Rešeni'], ['archived', 'Arhiva'], ['all', 'Svi']]
      .map(([k, l]) => `<button data-f="${k}" class="${filter === k ? 'on' : ''}">${l}${k !== 'all' ? ` <span class="cnt">${counts[k]}</span>` : ''}</button>`)
      .join('')}</div></div>
${shown.length ? `<div class="req-list">${shown.map(card).join('')}</div>` : `<div class="empty">${filter === 'new' ? 'Nema novih upita sa sajta.' : 'Nema upita u ovoj grupi.'}</div>`}</div>`;
    $$('#reqFilter button').forEach((b) => (b.onclick = () => ((filter = b.dataset.f), render())));
  }

  $('#requests').addEventListener('click', async (e) => {
    const el = e.target.closest('.req');
    if (!el) return;
    const r = list.find((x) => x.id === el.dataset.id);
    if (e.target.closest('[data-book]')) {
      await api('PUT', '/api/admin/requests/' + r.id, { status: 'done' });
      location.hash = bookLink(r).slice(1);
      return;
    }
    if (e.target.closest('[data-reply]')) {
      if (App.composeMail) App.composeMail({ to: `${r.name} <${r.email}>`, subject: r.kind === 'booking' ? 'Vaš upit za termin' : 'Vaša poruka', body: '' });
      else location.href = `mailto:${r.email}`;
      return;
    }
    const st = e.target.closest('[data-status]');
    if (st) {
      await api('PUT', '/api/admin/requests/' + r.id, { status: st.dataset.status });
      toast('Sačuvano');
      return load();
    }
    if (e.target.closest('[data-note]')) {
      App.modal.open(
        `<form class="mform"><h3>Beleška uz upit</h3><label class="f">Vidite je samo vi<textarea name="note" rows="3">${esc(r.note || '')}</textarea></label>
<p class="err"></p><div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Sačuvaj</button></div></form>`,
        async (f) => {
          await api('PUT', '/api/admin/requests/' + r.id, { note: f.note.value });
          load();
        }
      );
      return;
    }
    if (e.target.closest('[data-del]')) {
      if (!(await ask('Obrisati upit?', 'Brisanje se ne može poništiti.', 'Obriši', true))) return;
      await api('DELETE', '/api/admin/requests/' + r.id);
      load();
    }
  });

  App.view('requests', { title: 'Upiti sa sajta', sub: 'Zahtevi za termin i poruke poslate preko sajta.', load });
})();
