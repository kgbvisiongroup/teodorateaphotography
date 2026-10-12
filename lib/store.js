// Baza u JSON fajlu: jednostavna, bez dodatnih instalacija, lako se pravi rezervna kopija.
// Upis je atomski (privremeni fajl + preimenovanje) i grupisan, da brze izmene ne opterećuju disk.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_SETTINGS = {
  // Izgled i sadržaj sajta
  studioName: 'Teodora Photography Studio',
  accentColor: '#e79aa2',
  homeTitle: 'Vaše uspomene, spremne za preuzimanje',
  homeText: 'Fotografije vam stižu putem linka u email poruci. Link važi nekoliko dana – preuzmite ih na vreme i sačuvajte zauvek.',
  downloadLead: 'vaše fotografije su spremne za preuzimanje.',
  footerText: '',
  contactEmail: '',
  contactPhone: '',
  instagram: '',
  facebook: '',
  website: '',
  address: '',

  // Opšte
  siteUrl: '',
  retentionDays: 3,
  currency: 'EUR',
  locations: ['Beograd, Bulevar oslobođenja 299', 'Novi Sad, Povrtatska 63, Futog'],
  processingDays: 10,
  reminderHour: 9,
  cardPrefix: 'TPS',

  // Email nalog
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  fromName: 'Teodora Photography Studio',
  fromEmail: '',
  replyTo: '',

  // Poruka uz fotografije
  emailSubject: 'Vaše fotografije su spremne za preuzimanje',
  emailBody:
    '{obracanje} {ime} {prezime},\n\n' +
    'vaše slike su spremne za preuzimanje.\n\n' +
    '{poruka}\n\n' +
    'Link važi do {datum_isteka}, nakon toga se fotografije trajno brišu.\n\n' +
    'Srdačan pozdrav,\n{studio}',

  // Zakazivanje
  bookingConfirmEnabled: true,
  bookingConfirmSubject: 'Potvrda termina – {kategorija}',
  bookingConfirmBody:
    'Zdravo {klijent},\n\n' +
    'potvrđujemo vaš termin za fotografisanje ({kategorija}).\n\n' +
    'Datum: {datum}\nVreme: {vreme}\nLokacija: {lokacija}\nPaket: {paket}\nCena: {cena}\n\n' +
    'Ako želite nešto da promenite, samo odgovorite na ovu poruku.\n\n' +
    'Srdačan pozdrav,\n{studio}',
  bookingReminderEnabled: true,
  bookingReminderSubject: 'Podsetnik: sutra je fotografisanje',
  bookingReminderBody:
    'Zdravo {klijent},\n\n' +
    'podsećamo vas da je sutra fotografisanje ({kategorija}).\n\n' +
    'Datum: {datum}\nVreme: {vreme}\nLokacija: {lokacija}\n\n' +
    'Radujemo se!\n{studio}',
  processingReminders: true,

  // Obaveštenja za studio
  notifyOnDownload: false,
  notifyEmail: '',

  // Pošta (prijem preko IMAP-a; slanje ide preko SMTP naloga iznad)
  imapHost: '',
  imapPort: 993,
  imapSecure: true,
  imapUser: '',
  imapPass: '',
  imapSameLogin: true,
  mailSignature: '',

  // Javni sajt
  siteEnabled: true,
  langEnabled: true,
  albumEnabled: true,
  siteTagline: 'Fotografski studio',
  metaDescription: 'Fotografski studio – newborn, trudničko, cake smash, rođendani, krštenja i novogodišnja fotografisanja.',
  metaDescriptionEn: 'Photography studio in Belgrade and Novi Sad – newborn, maternity, cake smash, birthday and christening sessions.',
  requestNotify: true,
  requestReplySubject: 'Primili smo vaš upit – {studio}',
  requestReplyBody:
    'Zdravo {klijent},\n\n' +
    'hvala vam na upitu za {kategorija}. Javljamo se u najkraćem roku sa potvrdom termina.\n\n' +
    'Datum koji ste izabrali: {datum} u {vreme}\nLokacija: {lokacija}\n\n' +
    'Srdačan pozdrav,\n{studio}',
  // Engleska verzija odgovora na upit sa sajta
  requestReplySubjectEn: 'We received your request – {studio}',
  requestReplyBodyEn:
    'Hello {klijent},\n\n' +
    'thank you for your request for a {kategorija} session. I will get back to you shortly to confirm the time.\n\n' +
    'Date you chose: {datum} at {vreme}\nLocation: {lokacija}\n\n' +
    'Warm regards,\n{studio}',
};


// Stranice usluga: slider, opis, dugme za zakazivanje i najčešća pitanja
const servicePage = (slug, title, navTitle, en, text, faq, order) => ({
  id: 'u-' + slug,
  slug,
  title,
  nav: navTitle,
  parent: 'usluge',
  order,
  published: true,
  en: { title: en.title, nav: en.nav },
  sections: [
    {
      id: 's',
      type: 'slider',
      title,
      text,
      btn: 'Zakaži termin',
      href: '/zakazivanje',
      images: [],
      en: { title: en.title, text: en.text, btn: 'Book a session' },
    },
    {
      id: 'f',
      type: 'faq',
      title: 'Najčešća pitanja',
      cols: true,
      items: faq.map(([q, a]) => ({ q, a })),
      en: { title: 'Frequently asked questions', items: (en.faq || []).map(([q, a]) => ({ q, a })) },
    },
    {
      id: 'c',
      type: 'cta',
      title: 'Zakažite svoj termin na vreme',
      text: 'Termini se popunjavaju unapred – javite se i dogovaramo datum koji vam odgovara.',
      btn: 'Zakaži termin',
      href: '/zakazivanje',
      en: { title: 'Book your date in time', text: 'Dates fill up in advance – get in touch and we will agree on a date that suits you.', btn: 'Book a session' },
    },
  ],
});

const SERVICES = [
  servicePage(
    'newborn-fotografisanje',
    'Newborn fotografisanje',
    'NewBorn fotografisanje',
    {
      title: 'Newborn photography',
      nav: 'Newborn photography',
      text: 'Gentle photographs of the first days, in a warm studio and at your baby’s pace. Wraps, sets and props are all provided.',
      faq: [
        ['When is the best time to photograph a newborn?', 'Between the 5th and 15th day of life, when babies sleep deeply and curl up naturally. I photograph newborns with wrapping up to one month of age.'],
        ['How long does a session take?', 'Two to three hours, with breaks for feeding and cuddles – we never rush.'],
        ['What should we bring?', 'Milk or formula, a dummy if the baby uses one, and spare neutral clothes for you. Everything else is in the studio.'],
        ['When do we book?', 'Ideally during pregnancy, around the 7th month, so the date is reserved around your due date.'],
      ],
    },
    'Nežne fotografije prvih dana, u toplom studiju i tempom vaše bebe. Umotavanje, scenografije i rekviziti su obezbeđeni, a termin prilagođavam ritmu bebe – uz pauze za hranjenje i maženje.',
    [
      ['Kada je najbolje fotografisati novorođenu bebu?', 'Najbolji period je između 5. i 15. dana života. Tada beba najviše spava, ima prirodnu gipkost i lako zauzima nežne, ušuškane poze. Do mesec dana radim newborn fotografisanje sa umotavanjem.'],
      ['Kada je najbolje zakazati termin?', 'Idealno tokom trudnoće, oko 7. meseca, da termin bude rezervisan u nedeljama oko termina porođaja. Javite mi se čim saznate termin.'],
      ['Koliko traje fotografisanje?', 'Oko dva do tri sata, uz pauze za hranjenje, presvlačenje i maženje. Nikada ne žurimo – beba vodi tempo.'],
      ['Šta treba da ponesemo?', 'Hranu za bebu (malo više nego što mislite), dudu ako je beba koristi, rezervnu neutralnu garderobu za vas i dobro raspoloženje. Sve ostalo obezbeđujem ja.'],
      ['Oko čega ne treba da brinete?', 'Oko plača, kakica i prolivene hrane – sve je to deo posla. Studio je čist i zagrejan, a ja sam navikla na sve male nezgode.'],
    ],
    1
  ),
  servicePage(
    'fotografisanje-starijih-beba',
    'Fotografisanje starijih beba',
    'Fotografisanje starijih beba',
    {
      title: 'Older baby photography',
      nav: 'Older babies',
      text: 'Sitter sessions from 6 to 12 months – when the baby sits, smiles and discovers the world.',
      faq: [
        ['What age is this session for?', 'From about 6 months, when the baby sits on its own, up to the first birthday.'],
        ['How long does it take?', 'About 45 minutes to an hour, with breaks.'],
        ['Can parents be in the photos?', 'Of course – family photos are always welcome.'],
      ],
    },
    'Sitter sesija za bebe od 6 do 12 meseci – period kada beba samostalno sedi, smeje se i otkriva svet. Fotografije su vedre, razigrane i pune izraza lica koja se brzo menjaju.',
    [
      ['Za koji uzrast je ovo fotografisanje?', 'Od oko 6 meseci, kada beba samostalno sedi, pa sve do prvog rođendana.'],
      ['Koliko traje fotografisanje?', 'Oko 45 minuta do sat vremena, uz pauze kada je bebi potrebno.'],
      ['Da li roditelji mogu na fotografije?', 'Naravno, porodične fotografije su uvek dobrodošle – ponesite neutralnu garderobu.'],
      ['Šta da ponesemo?', 'Omiljenu igračku, užinu i rezervnu garderobu za bebu.'],
    ],
    2
  ),
  servicePage(
    'cake-smash-fotografisanje',
    'Cake Smash fotografisanje',
    'Cake Smash fotografisanje',
    {
      title: 'Cake smash photography',
      nav: 'Cake smash',
      text: 'The first birthday, cake and lots of laughter – a relaxed session with a set in the colours you choose.',
      faq: [
        ['When is the ideal time?', 'Usually for the first birthday, ideally 2–4 weeks before the date, so the photos are ready for the celebration.'],
        ['How long does it take?', 'Around 30–45 minutes, depending on the child’s mood.'],
        ['Do we bring the cake?', 'I can arrange the cake, or you can bring your own – tell me when booking.'],
      ],
    },
    'Prvi rođendan, torta i mnogo smeha. Fotografisanje je opušteno, bez žurbe, sa scenografijom u bojama koje zajedno izaberemo – a na kraju nas čeka i omiljeni deo: torta.',
    [
      ['Kada je idealno vreme za cake smash fotografisanje?', 'Najčešće povodom prvog rođendana, idealno 2–4 nedelje pre samog datuma. Tako imate uspomene spremne za proslavu i rođendanske čestitke.'],
      ['Koliko traje cake smash fotografisanje?', 'Oko 30–45 minuta, u skladu sa raspoloženjem deteta. Sve se odvija opušteno, bez žurbe i pritiska.'],
      ['Da li tortu donosite vi ili ja?', 'Mogu da obezbedim tortu u dogovorenim bojama, a možete je doneti i sami – dogovaramo se pri zakazivanju.'],
      ['Kako da obučemo dete?', 'Pripremam odevne kombinacije koje idu uz scenografiju, a možete poneti i svoje. Ponesite i rezervnu garderobu i peškir.'],
    ],
    3
  ),
  servicePage(
    'porodicno-fotografisanje',
    'Porodično fotografisanje',
    'Porodično Fotografisanje',
    {
      title: 'Family photography',
      nav: 'Family',
      text: 'Warm family portraits in the studio or outdoors – for everyone, from the youngest to the grandparents.',
      faq: [
        ['Where do we photograph?', 'In the studio or outdoors – we agree on the location when booking.'],
        ['How many people can be in the photos?', 'The whole family, grandparents included; just let me know how many of you there are.'],
        ['What should we wear?', 'Soft, neutral colours that go together, without large prints.'],
      ],
    },
    'Tople porodične fotografije u studiju ili u prirodi – za sve generacije, od najmlađih do baka i deka. Opušteno, uz igru i smeh, onako kako vaša porodica zaista izgleda.',
    [
      ['Gde se održava fotografisanje?', 'U studiju ili na lokaciji u prirodi – dogovaramo se pri zakazivanju, u skladu sa godišnjim dobom i vašim željama.'],
      ['Koliko osoba može na fotografije?', 'Cela porodica, uključujući bake i deke. Javite mi broj osoba pri zakazivanju da pripremim prostor.'],
      ['Šta da obučemo?', 'Preporučujem mekane, neutralne boje koje se međusobno slažu, bez velikih natpisa i jakih šara.'],
      ['Koliko traje fotografisanje?', 'Oko sat vremena, u zavisnosti od paketa i uzrasta dece.'],
    ],
    4
  ),
  servicePage(
    'novogodisnje-fotografisanje',
    'Novogodišnje fotografisanje',
    'Novogodišnje fotografisanje',
    {
      title: 'Christmas & New Year photography',
      nav: 'Christmas & New Year',
      text: 'Festive sets, lights and warm colours – mini sessions during December with a quick delivery before the holidays.',
      faq: [
        ['When do the festive sessions take place?', 'Through November and December; dates are published in advance and fill up quickly.'],
        ['How long does a mini session take?', 'About 20–30 minutes per family.'],
        ['When do we get the photos?', 'Before the holidays – edited photos arrive by email as a link.'],
      ],
    },
    'Praznične scenografije, lampice i tople boje. Novogodišnja fotografisanja su mini sesije tokom decembra, sa bržom obradom da fotografije stignu na vreme za čestitke i poklone.',
    [
      ['Kada se održavaju novogodišnja fotografisanja?', 'Tokom novembra i decembra. Termini se objavljuju unapred i popunjavaju se brzo, pa je dobro javiti se na vreme.'],
      ['Koliko traje mini sesija?', 'Oko 20–30 minuta po porodici, taman koliko je deci prijatno.'],
      ['Mogu li da biram scenografiju?', 'Da, scenografije se biraju pri zakazivanju – u panelu su sve dostupne postavke sa fotografijama.'],
      ['Kada dobijamo fotografije?', 'Pre praznika – obrađene fotografije stižu linkom na email.'],
    ],
    5
  ),
  servicePage(
    'uskrsnje-fotografisanje',
    'Uskršnje fotografisanje',
    'Uskršnje fotografisanje',
    {
      title: 'Easter photography',
      nav: 'Easter',
      text: 'Spring mini sessions with pastel sets, baskets and a few friendly bunnies.',
      faq: [
        ['When do Easter sessions take place?', 'In the weeks before Easter; the dates are announced on Instagram and here on the site.'],
        ['How long does it take?', 'About 20–30 minutes.'],
        ['Is it suitable for the smallest ones?', 'Yes – the sets are soft and safe, and we adjust to the child.'],
      ],
    },
    'Prolećne mini sesije sa pastelnim scenografijama, korpicama i pokojim zekom. Idealno za uspomene i čestitke, a deci najzabavnije.',
    [
      ['Kada se održavaju uskršnja fotografisanja?', 'U nedeljama pred Uskrs. Termine objavljujem na Instagramu i ovde na sajtu.'],
      ['Koliko traje fotografisanje?', 'Oko 20–30 minuta po detetu, odnosno porodici.'],
      ['Da li je pogodno i za najmanje?', 'Jeste – scenografije su mekane i bezbedne, a tempo prilagođavam detetu.'],
    ],
    6
  ),
  servicePage(
    'fotografisanje-krstenja',
    'Fotografisanje krštenja',
    'Fotografisanje krštenja',
    {
      title: 'Christening photography',
      nav: 'Christening',
      text: 'Quiet, discreet coverage of the ceremony in church and of the celebration afterwards.',
      faq: [
        ['Do you photograph in the church as well?', 'Yes, discreetly and in agreement with the priest, so the ceremony is not disturbed.'],
        ['Do you come to the restaurant too?', 'Yes, if the package includes it – we agree on the number of hours in advance.'],
        ['How soon do we get the photos?', 'Usually within 10 days, as a link by email.'],
      ],
    },
    'Tiho i nenametljivo pratim obred u crkvi i slavlje posle njega. Fotografije su prirodne, bez poziranja – onakve kakav je i sam dan.',
    [
      ['Da li fotografišete i u crkvi?', 'Da, diskretno i u dogovoru sa sveštenikom, tako da obred ne bude ometen.'],
      ['Dolazite li i u salu?', 'Dolazim ako je to deo paketa – broj sati dogovaramo unapred pri zakazivanju.'],
      ['Koliko brzo dobijamo fotografije?', 'Najčešće u roku od 10 dana, linkom na email.'],
      ['Šta ako obred kasni?', 'To je uobičajeno i računam na to; termin planiram sa rezervom.'],
    ],
    7
  ),
  servicePage(
    'prva-godina-zivota',
    'Paket „Prva godina života“',
    'Paket „Prva godina života“',
    {
      title: 'First year of life package',
      nav: 'First year package',
      text: 'Three or four sessions through the first year – newborn, sitter, first steps and the first birthday – at a package price.',
      faq: [
        ['What does the package include?', 'Newborn, a sitter session around 6 months, and a cake smash for the first birthday; a fourth session can be added.'],
        ['Can the dates be changed?', 'Yes, we agree on each date as the baby grows.'],
        ['How is it paid?', 'Per session or in full – whatever suits you better.'],
      ],
    },
    'Tri ili četiri fotografisanja kroz prvu godinu: newborn, sedenje oko šestog meseca, prvi koraci i prvi rođendan. Cela priča o prvoj godini na jednom mestu, po paket ceni.',
    [
      ['Šta paket obuhvata?', 'Newborn fotografisanje, sitter sesiju oko 6. meseca i cake smash za prvi rođendan. Po želji se dodaje i četvrto fotografisanje.'],
      ['Da li termini mogu da se pomeraju?', 'Mogu – svaki termin dogovaramo kako beba raste, bez obaveze da se sve zakaže unapred.'],
      ['Kako se plaća?', 'Po fotografisanju ili odjednom, kako vam odgovara.'],
    ],
    8
  ),
  servicePage(
    'fotografisanje-trudnica',
    'Fotografisanje trudnica',
    'Fotografisanje Trudnica',
    {
      title: 'Maternity photography',
      nav: 'Maternity',
      text: 'Gentle maternity portraits, usually between the 30th and 36th week, in the studio or outdoors.',
      faq: [
        ['When is the best time?', 'Between the 30th and 36th week, when the bump is beautifully round and you still feel comfortable.'],
        ['Do you provide dresses?', 'Yes, the studio has dresses and wraps in several sizes.'],
        ['Can my partner and children join?', 'Of course – family maternity photos are some of my favourites.'],
      ],
    },
    'Nežni portreti u iščekivanju bebe, najčešće između 30. i 36. nedelje. U studiju ili u prirodi, uz haljine i marame koje su vam na raspolaganju.',
    [
      ['Kada je najbolje vreme za trudničko fotografisanje?', 'Između 30. i 36. nedelje, kada je stomak lepo zaobljen, a vi se još uvek prijatno osećate.'],
      ['Da li obezbeđujete haljine?', 'Da, u studiju su haljine i marame u više veličina – javite mi veličinu pri zakazivanju.'],
      ['Mogu li suprug i deca na fotografije?', 'Naravno, porodične trudničke fotografije su mi među najdražim.'],
      ['Koliko traje fotografisanje?', 'Oko sat vremena, sa dve do tri kombinacije.'],
    ],
    9
  ),
  servicePage(
    'kuma-i-ja',
    'Uspomene „Kuma i ja“',
    'Uspomene „Kuma i ja“',
    {
      title: '“My godmother and me” memories',
      nav: 'Godmother and me',
      text: 'A small session for a godmother and child – a memory of a bond that lasts a lifetime.',
      faq: [
        ['Who is this session for?', 'For a godmother (or godfather) and the child, at any age.'],
        ['How long does it take?', 'About 30 minutes.'],
        ['Can it be a gift?', 'Yes – I issue gift vouchers that are sent by email or printed.'],
      ],
    },
    'Malo fotografisanje za kumu i dete – uspomena na vezu koja traje ceo život. Opušteno, uz igru i poneki zagrljaj.',
    [
      ['Za koga je ovo fotografisanje?', 'Za kumu (ili kuma) i dete, bilo kog uzrasta.'],
      ['Koliko traje?', 'Oko 30 minuta, taman da deca ostanu raspoložena.'],
      ['Može li da bude poklon?', 'Može – izdajem poklon vaučere koji stižu mejlom ili odštampani.'],
    ],
    10
  ),
];

const servicesPage = () => ({
  id: 'usluge',
  slug: 'usluge',
  title: 'Usluge',
  nav: 'Usluge',
  order: 1,
  published: true,
  en: { title: 'Services', nav: 'Services' },
  sections: [
    { id: 'h', type: 'head', title: 'Usluge', text: 'Izaberite vrstu fotografisanja i pogledajte detalje.', en: { title: 'Services', text: 'Choose a type of session and see the details.' } },
    { id: 'l', type: 'children', title: '', text: '', en: {} },
  ],
});

// Početni sajt: stranice i sekcije koje se posle menjaju u panelu
const starterSite = () => ({
  images: [],
  albums: [],
  pages: [
    {
      id: 'pocetna',
      slug: '',
      title: 'Početna',
      nav: 'Početna',
      en: { title: 'Home', nav: 'Home' },
      order: 0,
      published: true,
      seoTitle: '',
      seoDesc: '',
      sections: [
        {
          id: 'h1',
          type: 'hero',
          title: 'Uspomene koje traju',
          text: 'Nežne, tople fotografije najlepših trenutaka – od prvih dana bebe do porodičnih slavlja.',
          btn: 'Zakaži termin',
          href: '/zakazivanje',
          btn2: 'Pogledaj portfolio',
          href2: '/portfolio',
          en: {
            title: 'Memories that last',
            text: 'Gentle, warm photographs of your dearest moments – from a baby’s first days to family celebrations.',
            btn: 'Book a session',
            btn2: 'See the portfolio',
          },
          useBackgrounds: true,
          images: [],
        },
        {
          id: 'c1',
          type: 'cats',
          title: 'Šta fotografišem',
          text: 'Izaberite vrstu fotografisanja i pogledajte radove.',
          en: { title: 'What I photograph', text: 'Choose a type of session and see the work.' },
        },
        { id: 'a1', type: 'albums', title: 'Iz portfolija', text: '', limit: 6, category: '', en: { title: 'From the portfolio' } },
        {
          id: 'r1',
          type: 'rich',
          title: 'Dobrodošli u studio',
          text: 'Studio je opremljen scenografijama, rekvizitima i mekim svetlom, a svako fotografisanje prilagođavam vama i vašoj bebi – bez žurbe, u prijatnoj atmosferi.',
          image: '',
          side: 'right',
          en: {
            title: 'Welcome to the studio',
            text: 'The studio has sets, props and soft light, and every session is adjusted to you and your baby – unhurried, in a calm atmosphere.',
          },
        },
        { id: 'p1', type: 'packages', title: 'Paketi i cene', text: 'Cene su okvirne; za posebne želje javite se porukom.', category: '', en: { title: 'Packages and prices', text: 'Prices are a guide; for special wishes just send a message.' } },
        { id: 'q1', type: 'quotes', title: 'Utisci mama', items: [], en: { title: 'What mums say' } },
        { id: 't1', type: 'cta', title: 'Rezervišite svoj termin', text: 'Termini se popunjavaju unapred, posebno za newborn fotografisanja.', btn: 'Zakaži termin', href: '/zakazivanje', en: { title: 'Reserve your date', text: 'Dates fill up in advance, especially for newborn sessions.', btn: 'Book a session' } },
      ],
    },
    servicesPage(),
    ...SERVICES,
    {
      id: 'o-meni',
      slug: 'o-meni',
      title: 'O meni',
      nav: 'O meni',
      en: { title: 'About me', nav: 'About' },
      order: 11,
      published: true,
      sections: [
        { id: 'h', type: 'head', title: 'O meni', text: 'Nekoliko reči o tome kako radim.', en: { title: 'About me', text: 'A few words about how I work.' } },
        {
          id: 'r',
          type: 'rich',
          title: 'Drago mi je, Teodora',
          text: 'Fotografijom se bavim godinama, a najviše volim da radim sa bebama i porodicama. Svaki termin je opušten i prilagođen detetu – pauze, maženje i smeh su deo procesa.',
          image: '',
          side: 'left',
          en: {
            title: 'Nice to meet you, I’m Teodora',
            text: 'I have been photographing for years and I love working with babies and families most. Every session is relaxed and led by the child – breaks, cuddles and laughter are part of it.',
          },
        },
        { id: 'c', type: 'cta', title: 'Imate pitanje?', text: 'Javite se porukom, rado ću odgovoriti.', btn: 'Kontakt', href: '/kontakt', en: { title: 'Have a question?', text: 'Send a message and I will gladly answer.', btn: 'Contact' } },
      ],
    },
    {
      id: 'portfolio',
      slug: 'portfolio',
      title: 'Portfolio',
      nav: 'Portfolio',
      en: { title: 'Portfolio', nav: 'Portfolio' },
      order: 12,
      published: true,
      sections: [
        { id: 'h', type: 'head', title: 'Portfolio', text: 'Izbor fotografija iz studija i sa lokacija.', en: { title: 'Portfolio', text: 'A selection of photographs from the studio and on location.' } },
        { id: 'a', type: 'albums', title: '', text: '', limit: 0, category: '', filters: true },
      ],
    },
    {
      id: 'paketi',
      slug: 'paketi',
      title: 'Paketi i cene',
      nav: 'Paketi',
      en: { title: 'Packages and prices', nav: 'Packages' },
      order: 13,
      published: true,
      sections: [
        { id: 'h', type: 'head', title: 'Paketi i cene', text: 'Izaberite paket koji vam odgovara – sve cene su u evrima.', en: { title: 'Packages and prices', text: 'Choose the package that suits you – all prices are in euros.' } },
        { id: 'p', type: 'packages', title: '', text: '', category: '' },
        { id: 'f', type: 'faq', title: 'Česta pitanja', items: [
          { q: 'Koliko traje fotografisanje?', a: 'Newborn traje 2–3 sata, ostala fotografisanja po dogovoru i prema paketu.' },
          { q: 'Kada dobijam fotografije?', a: 'Obrađene fotografije stižu linkom na email, najčešće u roku od 10 dana.' },
          { q: 'Da li je potrebna kapara?', a: 'Termin se potvrđuje dogovorom; detalje šaljemo u potvrdi termina.' },
        ], en: { title: 'Frequently asked questions', items: [
          { q: 'How long does a session take?', a: 'Newborn sessions take 2–3 hours; other sessions depend on the package and agreement.' },
          { q: 'When do I get the photos?', a: 'Edited photos arrive as a link by email, usually within 10 days.' },
          { q: 'Is a deposit required?', a: 'The date is confirmed by agreement; details are in the confirmation email.' },
        ] } },
        { id: 'c', type: 'cta', title: 'Spremni ste?', text: 'Pošaljite upit i javljam se sa slobodnim terminima.', btn: 'Zakaži termin', href: '/zakazivanje', en: { title: 'Ready?', text: 'Send a request and I will reply with available dates.', btn: 'Book a session' } },
      ],
    },
    {
      id: 'zakazivanje',
      slug: 'zakazivanje',
      title: 'Zakazivanje',
      nav: '',
      en: { title: 'Booking', nav: '' },
      order: 14,
      published: true,
      sections: [
        { id: 'h', type: 'head', title: 'Zakazivanje termina', text: 'Popunite formular i javljam se sa potvrdom termina.', en: { title: 'Book a session', text: 'Fill in the form and I will reply with a confirmed time.' } },
        { id: 'b', type: 'booking' },
      ],
    },
    {
      id: 'kontakt',
      slug: 'kontakt',
      title: 'Kontakt',
      nav: 'Kontakt',
      en: { title: 'Contact', nav: 'Contact' },
      order: 15,
      published: true,
      sections: [
        { id: 'h', type: 'head', title: 'Kontakt', text: 'Tu sam za sva pitanja.', en: { title: 'Contact', text: 'I am here for all your questions.' } },
        { id: 'k', type: 'contact', title: '', text: '', form: true },
      ],
    },
    {
      id: 'preuzimanje',
      slug: 'preuzimanje',
      title: 'Preuzimanje fotografija',
      nav: '',
      en: { title: 'Photo download', nav: '' },
      order: 16,
      published: true,
      sections: [
        { id: 'd', type: 'download', title: 'Preuzimanje fotografija', text: 'Nalepite link koji ste dobili u email poruci i otvorite svoju galeriju.', en: { title: 'Photo download', text: 'Paste the link you received by email and open your gallery.' } },
      ],
    },
  ],
});

let file = null;
let data = null;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(password), salt, 64).toString('hex') };
}

function checkHash(user, password) {
  const test = crypto.scryptSync(String(password), user.salt, 64);
  const good = Buffer.from(user.hash, 'hex');
  return test.length === good.length && crypto.timingSafeEqual(test, good);
}

const DUMMY = hashPassword('x');
const findUser = (id) => data.users.find((u) => u.id === id);
const findLogin = (login) => {
  const l = String(login || '').trim().toLowerCase();
  if (!l) return null;
  return data.users.find((u) => u.active !== false && (u.username.toLowerCase() === l || (u.email && u.email.toLowerCase() === l))) || null;
};

// Prijava korisničkim imenom ili emailom; lozinka se uvek proverava, da odgovor traje isto
function verifyLogin(login, password) {
  const u = findLogin(login);
  const ok = checkHash(u || DUMMY, password);
  return u && ok ? u : null;
}

function init(dbFile, env = {}) {
  file = dbFile;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};

  // Kolekcije (nove se samo dodaju ovde – stari podaci ostaju netaknuti)
  data.transfers ||= [];
  data.transferHistory ||= [];
  data.bookings ||= [];
  data.packages ||= [];
  data.scenes ||= [];
  data.clients ||= {};
  data.backgrounds ||= [];
  data.vouchers ||= [];
  data.notifications ||= [];
  data.resetTokens ||= [];
  data.migrations ||= {};
  data.counters = { card: 0, voucher: 0, ...(data.counters || {}) };
  data.brand = { logo: null, icon: null, v: 1, ...(data.brand || {}) };
  data.site = { ...starterSite(), ...(data.site || {}) };
  data.requests ||= [];
  data.products ||= [
    { id: 'alb', name: 'Foto album 20×20', kind: 'album', sku: '', stock: 0, minStock: 2, price: 0, cost: 0, supplier: '', note: '', active: true, createdAt: Date.now() },
    { id: 'bok', name: 'Foto book 15×21', kind: 'book', sku: '', stock: 0, minStock: 2, price: 0, cost: 0, supplier: '', note: '', active: true, createdAt: Date.now() },
    { id: 'kut', name: 'Poklon kutija', kind: 'kutija', sku: '', stock: 0, minStock: 2, price: 0, cost: 0, supplier: '', note: '', active: true, createdAt: Date.now() },
  ];
  data.albumFormats ||= [
    { id: 'pan', name: 'IN Panorama', size: '15×21cm', w: 210, h: 150, spreads: 12, price: 32, extraSpreadPrice: 2, cover: 'Tvrdi povez', active: true, order: 0 },
    { id: 'por', name: 'IN Portret', size: '21×16cm', w: 160, h: 210, spreads: 12, price: 32, extraSpreadPrice: 2, cover: 'Tvrdi povez', active: true, order: 1 },
    { id: 'kva', name: 'IN Kvadrat', size: '21×21cm', w: 210, h: 210, spreads: 14, price: 42, extraSpreadPrice: 2.5, cover: 'Tvrdi povez', active: true, order: 2 },
    { id: 'kvm', name: 'IN Kvadrat M', size: '25×25cm', w: 250, h: 250, spreads: 14, price: 46, extraSpreadPrice: 3, cover: 'Tvrdi povez', active: true, order: 3 },
    { id: 'pxl', name: 'IN Panorama XL', size: '28×22cm', w: 280, h: 220, spreads: 14, price: 52, extraSpreadPrice: 3, cover: 'Tvrdi povez', active: true, order: 4 },
    { id: 'rxl', name: 'IN Portret XL', size: '22×28cm', w: 220, h: 280, spreads: 14, price: 52, extraSpreadPrice: 3, cover: 'Tvrdi povez', active: true, order: 5 },
  ];
  data.albumProjects ||= [];
  data.stockMoves ||= [];
  data.purchases ||= [];
  data.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  data.secret ||= crypto.randomBytes(32).toString('hex');

  // Korisnici portala (stara verzija je imala jedan nalog u data.admin)
  if (!data.users) {
    const old = data.admin;
    const pw = env.ADMIN_PASSWORD || 'admin123';
    const cred = old ? { salt: old.salt, hash: old.hash } : hashPassword(pw);
    data.users = [
      {
        id: crypto.randomBytes(6).toString('hex'),
        username: (old && old.username) || env.ADMIN_USERNAME || 'admin',
        name: 'Teodora',
        email: data.settings.notifyEmail || data.settings.contactEmail || '',
        role: 'admin',
        ...cred,
        isDefault: old ? !!old.isDefault : !env.ADMIN_PASSWORD,
        photo: null,
        active: true,
        createdAt: Date.now(),
      },
    ];
    delete data.admin;
    if (!old) console.log(env.ADMIN_PASSWORD ? 'Admin lozinka podešena iz ADMIN_PASSWORD.' : 'UPOZORENJE: početna lozinka je "admin123" – promenite je u Mom profilu.');
  }
  // Od verzije 6: stranice usluga i padajući meni „Usluge“
  if (!data.migrations.services) {
    const pages = data.site.pages || (data.site.pages = []);
    const has = (key) => pages.some((p) => p.id === key || p.slug === key);
    if (!has('usluge')) pages.push(servicesPage());
    for (const sp of SERVICES) if (!has(sp.slug)) pages.push(sp);
    const booking = pages.find((p) => p.slug === 'zakazivanje');
    if (booking) {
      booking.nav = '';
      if (booking.en) booking.en.nav = '';
    }
    pages.sort((a, b) => (a.order || 0) - (b.order || 0));
    data.migrations.services = true;
  }

  // Cene se od verzije 3 prikazuju u evrima
  if (!data.migrations.eur) {
    data.settings.currency = 'EUR';
    data.migrations.eur = true;
  }
  flush();
}

let timer = null;
function flush() {
  clearTimeout(timer);
  timer = null;
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}
// Grupisan upis: više izmena u istom trenutku = jedan upis na disk
function save() {
  if (!timer) timer = setTimeout(flush, 120);
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (timer) flush();
    process.exit(0);
  });
}
process.on('exit', () => timer && flush());

const newId = (n = 8) => crypto.randomBytes(n).toString('hex');

module.exports = {
  init,
  save,
  flush,
  newId,
  get data() {
    return data;
  },
  get settings() {
    return data.settings;
  },
  hashPassword,
  checkHash,
  verifyLogin,
  findUser,
  findLogin,
  setPassword(user, pw) {
    Object.assign(user, hashPassword(pw), { isDefault: false });
    save();
  },
  DEFAULT_SETTINGS,
};
