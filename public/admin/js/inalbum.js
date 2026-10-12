// Album: porudžbine albuma koje klijenti sami slažu na sajtu + formati i cene.
(function () {
  'use strict';
  const { $, $$, esc, fmt, api, toast, ask, modal } = App;
  const ST = { ordered: ['Poručeno', 'warn'], done: ['Završeno', 'ok'], draft: ['U izradi kod klijenta', 'muted'] };
  let tab = 'orders';
  let orders = [];
  let formats = [];
  let showDrafts = false;

  async function load() {
    [orders, formats] = await Promise.all([
      api('GET', '/api/admin/album-projects' + (showDrafts ? '?all=1' : '')),
      api('GET', '/api/admin/album-formats'),
    ]);
    render();
  }

  function render() {
    const open = orders.filter((o) => o.status === 'ordered').length;
    $('#inalbumBox').innerHTML = `<div class="tabs-row" role="tablist">
<button role="tab" data-tab="orders" class="${tab === 'orders' ? 'on' : ''}">Porudžbine<span>${open}</span></button>
${App.isAdmin() ? `<button role="tab" data-tab="formats" class="${tab === 'formats' ? 'on' : ''}">Formati i cene<span>${formats.length}</span></button>` : ''}
</div>
<div class="panel">${tab === 'formats' ? formatsView() : ordersView()}</div>`;
    $$('.tabs-row button').forEach((b) => (b.onclick = () => ((tab = b.dataset.tab), render())));

    if (tab === 'orders') {
      $('#toggleDrafts').onclick = () => {
        showDrafts = !showDrafts;
        load();
      };
      $$('[data-done]').forEach((b) => (b.onclick = async () => {
        await api('PUT', '/api/admin/album-projects/' + b.dataset.done, { status: 'done' });
        toast('Album je označen kao završen');
        load();
      }));
      $$('[data-reopen]').forEach((b) => (b.onclick = async () => {
        await api('PUT', '/api/admin/album-projects/' + b.dataset.reopen, { status: 'ordered' });
        load();
      }));
      $$('[data-del]').forEach((b) => (b.onclick = async () => {
        if (!(await ask('Obrisati album?', 'Brišu se i sve fotografije koje je klijent učitao. Ovo se ne može vratiti.', 'Obriši', true))) return;
        await api('DELETE', '/api/admin/album-projects/' + b.dataset.del);
        load();
      }));
    }
    if (tab === 'formats') {
      $('#addFmt').onclick = () => editFormat();
      $$('[data-fmt]').forEach((b) => (b.onclick = () => editFormat(formats.find((f) => f.id === b.dataset.fmt))));
      $$('[data-delf]').forEach((b) => (b.onclick = async () => {
        if (!(await ask('Obrisati format?', 'Albumi koji su već poručeni u ovom formatu ostaju zabeleženi.', 'Obriši', true))) return;
        await api('DELETE', '/api/admin/album-formats/' + b.dataset.delf);
        load();
      }));
    }
  }

  function ordersView() {
    return `<div class="panel-head"><div><h2>Poručeni albumi</h2><p class="sub small">Klijenti slažu album na sajtu (stranica <b>/album</b>), a kada pošalju porudžbinu, stiže vam obaveštenje i email.</p></div>
<button class="btn" id="toggleDrafts">${showDrafts ? 'Sakrij nedovršene' : 'Prikaži i nedovršene'}</button></div>
${orders.length
      ? `<div class="st-list">${orders
          .map((o) => {
            const [lbl, cls] = ST[o.status] || ST.ordered;
            const c = o.customer || {};
            return `<div class="st-row">
<div class="st-main"><b>${esc(c.name || 'Bez imena (nedovršen)')}</b><small>${esc(o.format)}${o.size ? ' · ' + esc(o.size) : ''} · ${o.spreads} duplih listova · ${o.photos} fotografija${c.phone ? ' · ' + esc(c.phone) : ''}${c.email ? ' · ' + esc(c.email) : ''}</small>${c.note ? `<small class="muted">„${esc(c.note)}"</small>` : ''}</div>
<div class="st-num"><b>${fmt.money(o.price)}</b><small>${o.orderedAt ? fmt.stamp(o.orderedAt) : 'započet ' + fmt.stamp(o.createdAt)}</small></div>
<span class="tag ${cls}">${lbl}</span>
<div class="acts"><a class="btn sm primary" href="/album/${esc(o.token)}" target="_blank" rel="noopener">Otvori album</a>
${o.status === 'ordered' ? `<button class="btn sm" data-done="${o.id}">Završeno</button>` : o.status === 'done' ? `<button class="btn sm" data-reopen="${o.id}">Vrati u obradu</button>` : ''}
${App.isAdmin() ? `<button class="btn sm danger" data-del="${o.id}">Obriši</button>` : ''}</div>
</div>`;
          })
          .join('')}</div>`
      : '<div class="empty">Još nema poručenih albuma.</div>'}`;
  }

  function formatsView() {
    return `<div class="panel-head"><div><h2>Formati albuma</h2><p class="sub small">Ovo klijent vidi kao ponudu na početku. Cena važi za osnovni broj duplih listova; svaki dodatni list naplaćuje se posebno.</p></div><button class="btn primary" id="addFmt">Novi format</button></div>
${formats.length
      ? `<div class="st-list">${formats
          .map(
            (f) => `<div class="st-row${f.active === false ? ' off' : ''}">
<div class="st-main"><b>${esc(f.name)}</b><small>${esc(f.size)} · ${esc(f.cover || '')} · ${f.spreads} duplih listova u ceni</small></div>
<div class="st-num"><b>${fmt.money(f.price)}</b><small>osnovna cena</small></div>
<div class="st-num"><b>${f.extraSpreadPrice ? fmt.money(f.extraSpreadPrice) : '—'}</b><small>dodatni list</small></div>
<span class="tag ${f.active === false ? 'muted' : 'ok'}">${f.active === false ? 'Skriveno' : 'Na sajtu'}</span>
<div class="acts"><button class="btn sm" data-fmt="${f.id}">Izmeni</button><button class="btn sm danger" data-delf="${f.id}">Obriši</button></div>
</div>`
          )
          .join('')}</div>`
      : '<div class="empty">Nema formata – dodajte prvi.</div>'}`;
  }

  function editFormat(f) {
    const isNew = !f;
    f = f || { name: '', size: '', w: 210, h: 210, spreads: 12, price: 0, extraSpreadPrice: 0, cover: 'Tvrdi povez', active: true };
    modal.open(
      `<form class="mform"><h3>${isNew ? 'Novi format albuma' : 'Format: ' + esc(f.name)}</h3>
<div class="row2"><label class="f">Naziv<input name="name" value="${esc(f.name)}" placeholder="npr. Kvadrat" required></label>
<label class="f">Oznaka veličine<input name="size" value="${esc(f.size)}" placeholder="npr. 21×21cm" required></label></div>
<div class="row2"><label class="f">Širina jedne strane (mm)<input name="w" inputmode="numeric" value="${f.w}" required></label>
<label class="f">Visina strane (mm)<input name="h" inputmode="numeric" value="${f.h}" required></label></div>
<div class="row2"><label class="f">Duplih listova u osnovnoj ceni<input name="spreads" inputmode="numeric" value="${f.spreads}" required></label>
<label class="f">Povez<input name="cover" value="${esc(f.cover || '')}" placeholder="npr. Tvrdi povez"></label></div>
<div class="row2"><label class="f">Osnovna cena<input name="price" inputmode="numeric" value="${f.price}" required></label>
<label class="f">Cena dodatnog duplog lista<input name="extraSpreadPrice" inputmode="numeric" value="${f.extraSpreadPrice || 0}"></label></div>
<label class="chk"><input type="checkbox" name="active" ${f.active !== false ? 'checked' : ''}><span>Prikaži ovaj format na sajtu</span></label>
<p class="err"></p>
<div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Sačuvaj</button></div></form>`,
      async (form) => {
        const body = {
          name: form.name.value,
          size: form.size.value,
          w: form.w.value,
          h: form.h.value,
          spreads: form.spreads.value,
          cover: form.cover.value,
          price: form.price.value,
          extraSpreadPrice: form.extraSpreadPrice.value,
          active: form.active.checked,
        };
        await api(isNew ? 'POST' : 'PUT', '/api/admin/album-formats' + (isNew ? '' : '/' + f.id), body);
        toast('Format je sačuvan');
        tab = 'formats';
        load();
      }
    );
  }

  App.view('albums', { title: 'Album', sub: 'Albumi koje klijenti sami slažu na sajtu, formati i cene.', load });
})();
