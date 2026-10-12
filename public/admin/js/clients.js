// Klijenti (iz zakazivanja) i loyalty kartice sa popustom.
(function () {
  'use strict';
  const { $, esc, fmt, api, toast, ask, drawer } = App;
  let list = [];

  async function load(params) {
    list = await api('GET', '/api/admin/clients');
    render();
    const open = params?.get('open');
    if (open) openClient(open);
  }

  function render() {
    const q = $('#clSearch').value.trim().toLowerCase();
    const cardsOnly = $('#clCards').checked;
    const shown = list.filter((c) => (!cardsOnly || c.cardNo) && (!q || `${c.name} ${c.email} ${c.phone} ${c.names.join(' ')} ${c.cardNo || ''}`.toLowerCase().includes(q)));
    if (!list.length) {
      $('#clList').innerHTML = '<div class="empty">Klijenti se pojavljuju ovde čim zakažete prvo fotografisanje.<br><a class="btn primary" href="#book">Novo zakazivanje</a></div>';
      return;
    }
    $('#clList').innerHTML = shown.length
      ? `<div class="cl-head"><span>Klijent</span><span>Fotografisanja</span><span>Ukupno</span><span>Loyalty</span></div>` +
        shown
          .map(
            (c) => `<div class="cl" data-key="${esc(c.key)}" tabindex="0" role="button">
<div class="who"><span class="ava">${esc(fmt.initials(...c.name.split(' ')))}</span><div><b>${esc(c.name)}</b><span class="em">${esc(c.email || c.phone)}</span>${c.names.length ? `<span class="em">Deca: ${esc(c.names.join(', '))}</span>` : ''}</div></div>
<div class="cell2"><b>${c.sessions}</b><small>poslednje ${esc(fmt.dateShort(c.last))}</small></div>
<div class="cell2"><b>${fmt.money(c.spent)}</b><small>${esc(c.cats.join(', '))}</small></div>
<div class="cell2">${c.cardNo ? `<span class="tag ok">${esc(c.cardNo)} · ${c.discount}%</span>` : '<span class="tag">bez kartice</span>'}</div>
</div>`
          )
          .join('')
      : '<div class="empty">Nema rezultata.</div>';
  }
  $('#clSearch').addEventListener('input', render);
  $('#clCards').addEventListener('change', render);
  $('#clList').addEventListener('click', (e) => {
    const row = e.target.closest('.cl');
    if (row) openClient(row.dataset.key);
  });
  $('#clList').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('cl')) openClient(e.target.dataset.key);
  });

  function cardHtml(c) {
    return `<div class="lcard">
<img data-logo src="/brand/logo" alt="">
<span class="lc-label">Loyalty kartica</span>
<b class="lc-name">${esc(c.name)}</b>
<div class="lc-row"><div><small>Broj kartice</small><span>${esc(c.cardNo)}</span></div><div><small>Popust</small><span>${c.discount}%</span></div></div>
</div>`;
  }

  async function openClient(key) {
    if (!list.length) list = await api('GET', '/api/admin/clients');
    const c = list.find((x) => x.key === key);
    if (!c) return toast('Klijent nije pronađen.');
    const bookings = (await api('GET', '/api/admin/bookings')).filter((b) => b.clientKey === key).reverse();
    const d = drawer.open(`<div class="dr-head"><div class="dr-ico ava">${esc(fmt.initials(...c.name.split(' ')))}</div><div><h2>${esc(c.name)}</h2><p>${c.sessions} ${c.sessions === 1 ? 'fotografisanje' : 'fotografisanja'} · ${fmt.money(c.spent)}</p></div><button class="x" data-close aria-label="Zatvori">×</button></div>
<section class="dr-sec"><h3>Kontakt</h3><dl class="kv">
  ${c.email ? `<dt>Email</dt><dd><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></dd>` : ''}
  ${c.phone ? `<dt>Telefon</dt><dd><a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a></dd>` : ''}
  ${c.names.length ? `<dt>Deca</dt><dd>${esc(c.names.join(', '))}</dd>` : ''}
  <dt>Klijent od</dt><dd>${esc(fmt.date(c.first))}</dd>
</dl></section>
<section class="dr-sec"><h3>Loyalty kartica</h3>
  ${c.cardNo ? cardHtml(c) : '<p class="small sub">Klijent još nema karticu. Popust se automatski primenjuje na nova zakazivanja.</p>'}
  <form id="loyForm" class="loy-form">
    <label class="f">Popust (%)<input name="discount" type="number" min="0" max="100" value="${c.discount || ''}" placeholder="npr. 10"></label>
    <label class="f wide">Beleška<textarea name="note" rows="2" placeholder="npr. preporučila nas je prijateljica">${esc(c.note || '')}</textarea></label>
    <div class="btn-row left">
      <button class="btn primary">${c.cardNo ? 'Sačuvaj' : 'Izdaj karticu'}</button>
      ${c.cardNo ? `<button type="button" class="btn" id="lcPrint">Odštampaj</button>${c.email ? '<button type="button" class="btn" id="lcSend">Pošalji emailom</button>' : ''}<button type="button" class="btn danger" id="lcRevoke">Ukini karticu</button>` : ''}
    </div>
  </form>
</section>
<section class="dr-sec"><h3>Fotografisanja</h3><div id="clBk">${bookings.map((b) => App.bookingRow(b, { compact: true, noAction: true })).join('')}</div>
<a class="btn" href="#book">Novo zakazivanje</a></section>`);
    App.refreshBrand();
    App.bindBookingRows($('#clBk', d));
    $('#loyForm', d).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const updated = await api('PUT', '/api/admin/clients/' + encodeURIComponent(key), { discount: f.discount.value, note: f.note.value, issue: true });
      toast(c.cardNo ? 'Sačuvano' : `Kartica ${updated.cardNo} je izdata`);
      list = await api('GET', '/api/admin/clients');
      render();
      openClient(key);
    });
    $('#lcPrint', d)?.addEventListener('click', () => {
      const w = window.open('', '_blank', 'width=520,height=420');
      w.document.write(`<!doctype html><html><head><title>Loyalty kartica</title><link rel="stylesheet" href="/brand/theme.css"><link rel="stylesheet" href="/admin/admin.css"></head><body class="print-card">${cardHtml(c)}<script>setTimeout(()=>print(),400)<\/script></body></html>`);
      w.document.close();
    });
    $('#lcSend', d)?.addEventListener('click', async () => {
      try {
        await api('POST', `/api/admin/clients/${encodeURIComponent(key)}/send-card`);
        toast('Kartica je poslata emailom');
      } catch (e) {
        toast(e.message);
      }
    });
    $('#lcRevoke', d)?.addEventListener('click', async () => {
      if (!(await ask('Ukinuti karticu?', 'Popust ostaje upisan, ali kartica više neće važiti.', 'Ukini', true))) return;
      await api('PUT', '/api/admin/clients/' + encodeURIComponent(key), { revoke: true });
      list = await api('GET', '/api/admin/clients');
      render();
      openClient(key);
    });
  }

  App.view('clients', {
    title: 'Klijenti i loyalty',
    sub: 'Svi klijenti iz zakazivanja. Popust sa kartice se sam primenjuje na nova zakazivanja.',
    load,
  });
})();
