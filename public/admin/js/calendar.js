// Kalendar: mesečni pregled i raspored po danima, sa rokovima za obradu.
(function () {
  'use strict';
  const { $, $$, esc, fmt, api } = App;
  const st = { month: null, mode: null, deadlines: true, data: [] };

  async function load(params) {
    const m = params.get('m');
    st.month = /^\d{4}-\d{2}$/.test(m || '') ? m : st.month || App.today().slice(0, 7);
    if (!st.mode) st.mode = matchMedia('(max-width: 760px)').matches ? 'agenda' : 'month';
    st.data = await api('GET', '/api/admin/bookings');
    render();
  }

  function shift(n) {
    const [y, m] = st.month.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    st.month = `${d.getFullYear()}-${App.two(d.getMonth() + 1)}`;
    history.replaceState(null, '', '#calendar?m=' + st.month);
    render();
  }

  function render() {
    const [y, m] = st.month.split('-').map(Number);
    const head = `<div class="cal-head">
  <div class="cal-nav"><button class="btn icon" id="calPrev" aria-label="Prethodni mesec">‹</button><h2>${App.MONTHS_NOM[m - 1]} ${y}</h2><button class="btn icon" id="calNext" aria-label="Sledeći mesec">›</button><button class="btn sm" id="calToday">Danas</button></div>
  <div class="cal-tools">
    <label class="check inline"><input type="checkbox" id="calDl" ${st.deadlines ? 'checked' : ''}><span>Rokovi obrade</span></label>
    <div class="seg" id="calMode"><button data-m="month" class="${st.mode === 'month' ? 'on' : ''}">Mesec</button><button data-m="agenda" class="${st.mode === 'agenda' ? 'on' : ''}">Raspored</button></div>
  </div>
</div>`;
    const legend = `<div class="legend">${App.meta.categories.map((c) => `<span style="--c:${c.color}"><i></i>${esc(c.name)}</span>`).join('')}<span class="lg-dl"><i></i>Rok za obradu</span></div>`;
    $('#cal').innerHTML = `<div class="panel cal">${head}${st.mode === 'month' ? month(y, m) : agenda(y, m)}${legend}</div>`;
    $('#calPrev').onclick = () => shift(-1);
    $('#calNext').onclick = () => shift(1);
    $('#calToday').onclick = () => {
      st.month = App.today().slice(0, 7);
      history.replaceState(null, '', '#calendar');
      render();
      $('.cday.today, .ag-day.today')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    $('#calDl').onchange = (e) => {
      st.deadlines = e.target.checked;
      render();
    };
    $$('#calMode button').forEach((b) => (b.onclick = () => {
      st.mode = b.dataset.m;
      render();
    }));
  }

  const live = () => st.data.filter((b) => !b.cancelled);
  const byDay = () => {
    const map = {};
    for (const b of live()) (map[b.date] ||= []).push(b);
    Object.values(map).forEach((l) => l.sort((a, b) => a.time.localeCompare(b.time)));
    return map;
  };
  const deadlinesByDay = () => {
    const map = {};
    if (!st.deadlines) return map;
    for (const b of live()) if (b.status === 'processing' || b.status === 'overdue') (map[b.deadlineDate] ||= []).push(b);
    return map;
  };

  function month(y, m) {
    const first = new Date(y, m - 1, 1);
    const startOffset = (first.getDay() + 6) % 7; // ponedeljak prvi
    const start = App.addDays(App.toStr(first), -startOffset);
    const days = byDay();
    const dls = deadlinesByDay();
    const today = App.today();
    let html = '<div class="grid7 wd">' + ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'].map((d) => `<span>${d}</span>`).join('') + '</div><div class="grid7 month">';
    const weeks = Math.ceil((startOffset + new Date(y, m, 0).getDate()) / 7);
    for (let i = 0; i < weeks * 7; i++) {
      const ds = App.addDays(start, i);
      const d = App.parse(ds);
      const ev = days[ds] || [];
      const dl = dls[ds] || [];
      const out = d.getMonth() !== m - 1;
      const shown = ev.slice(0, 3);
      html += `<div class="cday${out ? ' out' : ''}${ds === today ? ' today' : ''}${ds < today ? ' past' : ''}" data-date="${ds}" tabindex="0" aria-label="${esc(fmt.date(ds, true))}${ev.length ? ', ' + ev.length + ' fotografisanja' : ''}">
<span class="dn">${d.getDate()}</span>
${shown.map((b) => `<button class="ev" data-id="${b.id}" style="--c:${b.color}" title="${esc(b.time + ' ' + b.firstName + ' ' + b.lastName + ' – ' + b.catName)}"><i>${esc(b.time)}</i>${esc(b.firstName)} ${esc(b.lastName)}</button>`).join('')}
${ev.length > 3 ? `<button class="more-ev" data-day="${ds}">još ${ev.length - 3}</button>` : ''}
${dl.map((b) => `<button class="ev dl" data-id="${b.id}" title="Rok za obradu">Rok: ${esc(b.firstName)} ${esc(b.lastName)}</button>`).join('')}
</div>`;
    }
    html += '</div>';
    setTimeout(bindMonth, 0);
    return html;
  }

  function bindMonth() {
    const g = $('.grid7.month');
    if (!g) return;
    g.addEventListener('click', (e) => {
      const ev = e.target.closest('.ev');
      if (ev) return (location.hash = '#booking/' + ev.dataset.id);
      const more = e.target.closest('.more-ev');
      if (more) {
        st.mode = 'agenda';
        render();
        $(`.ag-day[data-date="${more.dataset.day}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return;
      }
      const cell = e.target.closest('.cday');
      if (cell) location.hash = '#book?date=' + cell.dataset.date;
    });
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('cday')) location.hash = '#book?date=' + e.target.dataset.date;
    });
  }

  function agenda(y, m) {
    const from = `${y}-${App.two(m)}-01`;
    const to = App.toStr(new Date(y, m, 0));
    const days = byDay();
    const dls = deadlinesByDay();
    const today = App.today();
    const keys = [...new Set([...Object.keys(days), ...Object.keys(dls)])].filter((d) => d >= from && d <= to).sort();
    setTimeout(() => {
      const a = $('.agenda');
      if (a) App.bindBookingRows(a);
    }, 0);
    if (!keys.length) return `<div class="empty">U ovom mesecu nema zakazanih fotografisanja.<br><a class="btn primary" href="#book">Zakaži fotografisanje</a></div>`;
    return `<div class="agenda">${keys
      .map(
        (d) => `<div class="ag-day${d === today ? ' today' : ''}" data-date="${d}"><h3>${esc(fmt.date(d, true))}${d === today ? ' <span class="tag up">danas</span>' : ''}</h3>
${(days[d] || []).map((b) => App.bookingRow(b, { compact: true })).join('')}
${(dls[d] || []).map((b) => `<div class="bk dl-row" data-id="${b.id}" tabindex="0" role="button"><div class="bk-date"><b>Rok</b></div><div class="bk-main"><b>Obrada: ${esc(b.firstName)} ${esc(b.lastName)}</b><span>${esc(b.catName)} · fotografisano ${esc(fmt.dateShort(b.date))}</span></div><div class="bk-status">${App.statusPill(b.status)}</div></div>`).join('')}
</div>`
      )
      .join('')}</div>`;
  }

  App.view('calendar', {
    title: 'Kalendar',
    sub: 'Kliknite na dan da zakažete, ili na termin da vidite detalje.',
    actions: '<a class="btn primary" href="#book">Novo zakazivanje</a>',
    load,
  });
})();
