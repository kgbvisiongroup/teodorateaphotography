// Kategorije fotografisanja i polja koja svaka traži.
// Admin interfejs crta formular iz ove šeme, a server po njoj proverava podatke.
// Novo polje ili kategorija dodaje se samo ovde.

const child = (first = 'Ime deteta', last = 'Prezime deteta') => [
  { k: 'firstName', label: first, type: 'text', req: true, half: true },
  { k: 'lastName', label: last, type: 'text', req: true, half: true },
  { k: 'birthDate', label: 'Datum rođenja deteta', type: 'date', req: true, age: true, half: true },
  { k: 'parentName', label: 'Ime i prezime roditelja', type: 'text', hint: 'za obraćanje u porukama', half: true },
];
const contact = [
  { k: 'email', label: 'Email', type: 'email', req: true, half: true },
  { k: 'phone', label: 'Telefon', type: 'tel', req: true, half: true },
];
const when = [
  { k: 'date', label: 'Datum fotografisanja', type: 'date', req: true, half: true },
  { k: 'time', label: 'Vreme', type: 'time', req: true, half: true },
  { k: 'location', label: 'Lokacija', type: 'location', req: true },
];
const pkg = { k: 'packageId', label: 'Paket', type: 'package', req: true };
const extraHours = { k: 'extraHours', label: 'Dodatna satnica', type: 'hours', hint: 'broj dodatnih sati' };
const notes = { k: 'notes', label: 'Napomena', type: 'textarea' };

const CATEGORIES = [
  {
    key: 'newborn',
    name: 'Newborn',
    nameEn: 'Newborn',
    color: '#8fb8cf',
    blurb: 'Bebe u prvim nedeljama',
    blurbEn: 'Babies in their first weeks',
    fields: [...child(), ...contact, ...when, pkg, { k: 'colors', label: 'Boje', type: 'colors' }, notes],
  },
  {
    key: 'novogodisnje',
    name: 'Novogodišnje',
    nameEn: 'Christmas & New Year',
    color: '#c9a66b',
    blurb: 'Praznično fotografisanje',
    blurbEn: 'Festive sessions',
    fields: [...child(), ...contact, ...when, pkg, { k: 'sceneId', label: 'Scenografija', type: 'scene', req: true }, notes],
  },
  {
    key: 'rodjendan',
    name: 'Rođendan',
    nameEn: 'Birthday',
    color: '#e79aa2',
    blurb: 'Proslave i rođendanski portreti',
    blurbEn: 'Parties and birthday portraits',
    fields: [...child(), ...contact, ...when, pkg, extraHours, notes],
  },
  {
    key: 'krstenje',
    name: 'Krštenje',
    nameEn: 'Christening',
    color: '#a7a1cf',
    blurb: 'Crkva i proslava',
    blurbEn: 'Church and celebration',
    fields: [
      ...child(), ...contact, ...when, pkg,
      { k: 'church', label: 'Crkva', type: 'text', list: 'churches' },
      { k: 'hall', label: 'Odlazak u salu', type: 'checkbox' },
      extraHours, notes,
    ],
  },
  {
    key: 'trudnicko',
    name: 'Trudničko',
    nameEn: 'Maternity',
    color: '#9fc0a0',
    blurb: 'Iščekivanje bebe',
    blurbEn: 'Waiting for the baby',
    fields: [
      { k: 'firstName', label: 'Ime trudnice', type: 'text', req: true, half: true },
      { k: 'lastName', label: 'Prezime trudnice', type: 'text', req: true, half: true },
      ...contact, ...when,
      { k: 'pregnancyWeek', label: 'Nedelja trudnoće', type: 'number', min: 1, max: 42, half: true },
      pkg, notes,
    ],
  },
  {
    key: 'cakesmash',
    name: 'Cake Smash',
    nameEn: 'Cake Smash',
    color: '#e9a882',
    blurb: 'Prvi rođendan i torta',
    blurbEn: 'First birthday and cake',
    fields: [
      ...child(), ...contact, ...when, pkg,
      { k: 'cake', label: 'Sa tortom', type: 'checkbox', def: true, hint: 'isključi ako je bez torte' },
      { k: 'colors', label: 'Okvirne boje', type: 'colors' },
      notes,
    ],
  },
];

const byKey = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

module.exports = { CATEGORIES, byKey };
