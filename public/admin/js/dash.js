// Kontrolna tabla: šta je danas važno.
(function () {
  'use strict';
  const { $, esc, fmt, api } = App;

  async function load() {
    const s = await api('GET', '/api/admin/stats');
    $('#stUpcoming').textContent = s.upcoming.length;
    $('#stEditing').textContent = s.editing.length;
    $('#stOverdue').textContent = s.overdue ? `${s.overdue} kasni sa rokom` : s.editing.length ? 'sve u roku' : '';
    $('#stOverdue').className = s.overdue ? 't-err' : '';
    $('#stActive').textContent = s.active;
    $('#stWaiting').textContent = s.waiting ? `${s.waiting} još nije preuzeto` : '';
    $('#stStorage').textContent = fmt.size(s.storage);
    $('#navCount').textContent = s.active || '';
    $('#navEdit').textContent = s.editing.length || '';
    $('#navReq').textContent = s.newRequests || '';
    $('#navStock').textContent = s.lowStock || '';
    $('#navAlb').textContent = s.newAlbums || '';
    $('#navOffers').textContent = s.acceptedOffers || '';

    const al = [];
    if (s.lowStock) al.push([`<b>${s.lowStock} ${s.lowStock === 1 ? 'artikal u magacinu je' : 'artikla u magacinu su'} pri kraju.</b> Poručite na vreme.`, '#stock', 'Otvori magacin']);
    if (s.acceptedOffers) al.push([`<b>${s.acceptedOffers} ${s.acceptedOffers === 1 ? 'prihvaćena ponuda čeka' : 'prihvaćenih ponuda čeka'} zakazivanje.</b>`, '#offers?f=accepted', 'Otvori ponude']);
    if (s.newAlbums) al.push([`<b>${s.newAlbums} ${s.newAlbums === 1 ? 'nov album' : 'novih albuma'}</b> ${s.newAlbums === 1 ? 'je poručen' : 'je poručeno'} sa sajta.`, '#albums', 'Pogledaj albume']);
    if (s.newRequests) al.push([`<b>${s.newRequests} ${s.newRequests === 1 ? 'nov upit' : 'novih upita'} sa sajta</b> čeka odgovor.`, '#requests', 'Pogledaj upite']);
    if (s.overdue) al.push([`<b>Rok za obradu je istekao za ${s.overdue} ${s.overdue === 1 ? 'fotografisanje' : 'fotografisanja'}.</b>`, '#bookings?f=edit', 'Pogledaj']);
    if (!s.smtpReady && s.isAdmin) al.push(['<b>Email još nije podešen.</b> Klijenti neće dobijati potvrde, podsetnike ni linkove.', '#email', 'Podesi email']);
    if (s.defaultPassword) al.push(['<b>Koristite početnu lozinku.</b> Promenite je radi sigurnosti.', '#profile?pw=1', 'Promeni lozinku']);
    if (!s.hasPackages && s.isAdmin) al.push(['Dodajte pakete sa cenama da biste mogli da zakazujete.', '#catalog', 'Dodaj pakete']);
    if (!s.hasBackgrounds && s.isAdmin) al.push(['Početna strana još nema vaše fotografije u pozadini.', '#look', 'Dodaj fotografije']);
    if (s.expiringSoon) al.push([`<b>${s.expiringSoon}</b> ${s.expiringSoon === 1 ? 'link ističe' : 'linka ističu'} za manje od 24 sata, a fotografije još nisu preuzete.`, '#list', 'Pogledaj']);
    $('#alerts').innerHTML = al.map(([t, h, l]) => `<div class="alert"><span>${t}</span><a class="link" href="${h}">${l}</a></div>`).join('');

    $('#dashUpcoming').innerHTML = s.upcoming.length
      ? s.upcoming.slice(0, 8).map((b) => App.bookingRow(b, { compact: true })).join('') + (s.upcoming.length > 8 ? `<a class="link more-link" href="#calendar">i još ${s.upcoming.length - 8} u kalendaru</a>` : '')
      : '<div class="empty small">Nema fotografisanja u naredne dve nedelje.<br><a class="btn primary" href="#book">Zakaži</a></div>';
    $('#dashEditing').innerHTML = s.editing.length
      ? s.editing.slice(0, 8).map((b) => App.bookingRow(b, { compact: true })).join('')
      : '<div class="empty small">Sve fotografije su obrađene.</div>';
    $('#recent').innerHTML = s.recent.length
      ? s.recent.map(App.transferRow).join('')
      : '<div class="empty small">Još niste slali fotografije.<br><a class="btn primary" href="#new">Novo slanje</a></div>';
  }

  App.bindBookingRows($('#dashUpcoming'));
  App.bindBookingRows($('#dashEditing'));

  App.view('dash', {
    title: 'Kontrolna tabla',
    sub: 'Šta predstoji, šta čeka obradu i šta je poslato.',
    actions: '<a class="btn" href="#new">Pošalji fotografije</a><a class="btn primary" href="#book">Novo zakazivanje</a>',
    load,
  });
})();
