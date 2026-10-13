# Teodora Photography Studio – slanje fotografija klijentima

Aplikacija po uzoru na WeTransfer, u nežno roze i belom stilu, sa njenim logom i administracijom kao pravim CMS-om.

**Javni sajt (CMS)**
- **Stranice** – Početna, O meni, Portfolio, Paketi i cene, Zakazivanje, Kontakt i Preuzimanje fotografija; sve se uređuje u panelu (*Stranice sajta*): naslovi, tekstovi, slike, redosled, nove stranice i SEO.
- **Sekcije** – stranica se slaže od gotovih delova: naslovna sa sliderom, vrste fotografisanja, albumi iz portfolija, tekst + slika, paketi i cene, utisci, galerija, česta pitanja, poziv na zakazivanje, kontakt sa formom, forma za zakazivanje i polje za preuzimanje fotografija.
- **Usluge** – stranica *Usluge* sa karticama i padajućim menijem u vrhu sajta, a ispod nje stranica za svaku uslugu: NewBorn, starije bebe, Cake Smash, porodično, novogodišnje, uskršnje, krštenje, paket „Prva godina života“, trudničko i „Kuma i ja“. Svaka stranica ima slider sa fotografijama, naziv, opis, dugme *Zakaži termin* i najčešća pitanja u dve kolone. Nove usluge dodajete kao novu stranicu i izaberete da stoji u meniju ispod „Usluge“.
- **Portfolio** – albumi sa fotografijama (vrsta fotografisanja, naslovna, redosled, sakrij/prikaži) i zajednička biblioteka fotografija; galerija se otvara preko celog ekrana.
- **Upiti sa sajta** – forma za zakazivanje i kontakt forma šalju upit u panel (*Upiti sa sajta*), uz obaveštenje, email vama i automatski odgovor posetiocu. Dugme „Zakaži termin“ otvara čarobnjak sa već popunjenim podacima.
- **Engleska verzija** – prekidač **SR / EN** u gornjem desnom uglu. Sve stranice postoje i na `/en`, a engleski tekst se upisuje uz svaku sekciju (prazno = prikazuje se srpski). Forme, dugmad, kalendar i automatski odgovor na upit su prevedeni.
- **SEO** – poseban naslov i opis po stranici (i na engleskom), kanonski link, `hreflang` za srpski i engleski, Open Graph i Twitter oznake sa slikom za deljenje, strukturirani podaci (studio sa adresama i kontaktom, galerije, putanja stranice i česta pitanja koja Google ume da prikaže u rezultatima), `sitemap.xml` sa obe jezičke verzije i `robots.txt`.
- **IN album** – stranica `/album` na kojoj klijent sam slaže svoj album: bira format (IN Panorama, IN Portret, IN Kvadrat, IN Kvadrat M, IN Panorama XL, IN Portret XL), učitava svoje fotografije, prevlači ih na duple strane, bira raspored, pozadinu, okvire, stikere i tekst, pomera i uvećava slike u okviru, dodaje duple listove (cena se sama uvećava), pogleda ceo album i pošalje porudžbinu. Rad se sam čuva, pa album može da se nastavi preko istog linka. Vama stiže obaveštenje i email, klijentu potvrda.
- Sve u istom nežno roze stilu i boji iz *Izgled*, prilagođeno telefonu.

**Za klijente**
- **Početna strana** kao na WeTransfer-u: vaše fotografije preko celog ekrana se polako smenjuju, a levo je bela kartica sa pozdravom, poljem za link i kontakt podacima.
- **Stranica za preuzimanje**: u pozadini su klijentove fotografije, a u kartici *„Draga Dragana Perić, vaše fotografije su spremne za preuzimanje.“*, lista fajlova, dugme **Preuzmi sve** i **Pogledaj galeriju** (prikaz preko celog ekrana, listanje strelicama ili prevlačenjem na telefonu).
- Email sa logom i dugmetom **Preuzmi fotografije**.
- Posle 3 dana (podesivo) link prestaje da radi, a fotografije se **trajno brišu**.

**Administracija (`/admin`)** – prijava korisničkim imenom i lozinkom (početno `admin` / `admin123`)

*Fotografisanja*
- **Kontrolna tabla** – fotografisanja u narednih 14 dana, šta čeka obradu (i šta kasni), poslednja slanja, upozorenja.
- **Kalendar** – mesečni prikaz i raspored po danima, boja po vrsti fotografisanja, rokovi za obradu; klik na dan otvara novo zakazivanje.
- **Zakazivanja** – čarobnjak u 3 koraka: vrsta (Newborn, Novogodišnje, Rođendan, Krštenje, Trudničko, Cake Smash) → podaci za tu vrstu → pregled. Starost deteta se računa sama, paketi se biraju sa cenom, dodatna satnica i loyalty popust ulaze u ukupnu cenu. Filteri *Predstoji / Obrada / Završeno*.
- **Obrada** – rok za obradu (podrazumevano 10 dana od fotografisanja). Dok nije označeno „obrađeno“, stiže vam email 3 dana i 1 dan pre isteka roka. Slanje fotografija vezano za zakazivanje automatski ga označava kao obrađeno.
- **Emailovi klijentima** – potvrda termina pri zakazivanju i podsetnik dan pre fotografisanja (tekstovi se menjaju u *Email*).
- **Klijenti i loyalty** – lista klijenata iz zakazivanja (broj fotografisanja, ukupno, deca), loyalty kartica sa brojem i popustom, štampa i slanje kartice emailom; popust se sam primenjuje na nova zakazivanja.
- **Magacin** – artikli (album, book, kutija i šta god dodate): stanje, minimalno stanje uz upozorenje, cena klijentu i nabavna cena, dobavljač. Porudžbine kod dobavljača se beleže i jednim klikom „Primljeno" ulaze na stanje, a *Promet* pokazuje svaku promenu stanja.
- **Izrada i kapara pri zakazivanju** – uz paket se bira da li klijent želi album, book ili kutiju (vidi se i trenutno stanje), a iznos se dodaje na cenu. Kapara se upisuje i oduzima od ukupnog, pa *Ukratko* pokazuje ukupno, kaparu i ostatak za uplatu. Kada označite da je fotografisanje obrađeno (ili pošaljete fotografije), izabrani artikli se sami skidaju sa stanja.
- **IN album (panel)** – *Porudžbine*: ko je poručio, format, broj duplih listova i fotografija, cena, poruka klijenta, dugme *Otvori album* (vidite tačno kako ga je složio) i *Završeno*; *Formati i cene*: nazivi, dimenzije, broj duplih listova u ceni, osnovna cena i cena dodatnog lista, prikaz/sakrivanje formata na sajtu. IN album se uključuje i isključuje u *Sadržaj i kontakt*.
- **Skladište fotografija** – sve fotografije na jednom mestu: **Google Drive** (panel pravi i koristi samo svoju fasciklu; povezuje se kodom preko `google.com/device`, bez domena i sertifikata) i/ili **vaš disk** (lokalni ili Samba folder montiran na server). Pregled sa sličicama, pretraga, nova fascikla, otpremanje prevlačenjem, preuzimanje i brisanje (u *_kanta*, odnosno Google kantu). Iz skladišta se fotografije šalju klijentu: povežete pošiljku sa zakazivanjem, podaci klijenta se sami popune, fotografije se kopiraju (originali ostaju), a termin se odmah vodi kao obrađen. Stavka se u meniju pojavljuje tek kada se skladište podesi u *Podešavanjima*.
- **Paketi i scenografije** – paketi po vrsti fotografisanja (cena, cena dodatnog sata, opis, aktivan/sakriven) i scenografije sa fotografijom.

*Slanje fotografija*
- **Novo slanje** – JPG i ZIP zajedno, prevlačenjem bilo gde na ekran; opciono povezivanje sa zakazivanjem (popunjava ime i email).
- **Poslato** – kada je i šta preuzeto (istorija preuzimanja), status emaila, produženje i brisanje; **Arhiva** isteklih slanja sa vremenima preuzimanja (čuva se godinu dana).

*Pošta i vaučeri*
- **Pošta** – sanduče povezano sa vašim mail nalogom preko IMAP-a: primanje i slanje, folderi (pravljenje, preimenovanje, brisanje), premeštanje poruka, Spam i Kanta, pretraga, prilozi, odgovor / odgovor svima / prosleđivanje i potpis. Sve izmene se vide i na telefonu i u Gmail-u/Outlook-u, jer se rade na samom serveru. Slike iz interneta su skrivene dok ih ne odobrite, a skripte se uklanjaju iz poruka.
- **Poklon vaučeri** – vaučer sa imenom i prezimenom, od koga je, vrednošću (paket ili iznos), porukom i rokom važenja. Izgleda isto u aplikaciji, u emailu i na štampi, a u dnu poruke su vaši podaci (telefon, email, sajt, Instagram i adrese). Oznake *Aktivan / Iskorišćen / Istekao* i obaveštenje 7 dana pre isteka.

*Sajt i sistem*
- **Izgled** (logo, ikonica, boja, pozadine), **Sadržaj i kontakt**, **Email** (SMTP nalog za slanje, IMAP nalog za Poštu, tri šablona poruka sa pregledom, obaveštenja), **Podešavanja** (rok obrade, sat slanja podsetnika, **valuta**, **lokacije**, oznaka kartica, trajanje linkova).
- **Korisnici portala** – više osoba sa svojim korisničkim imenom: *Administrator* (sve) i *Saradnik* (sve osim podešavanja, izgleda sajta i korisnika). Pozivnica stiže emailom, a korisnik sam postavlja lozinku.
- **Moj profil** – vaša slika u krugu (gore desno i kod korisnika), ime, email, korisničko ime i promena lozinke. Zaboravljenu lozinku šaljemo kao link na email.
- **Obaveštenja** – zvonce gore desno: nova pošta, prvo preuzimanje fotografija, rokovi za obradu, vaučeri pred istek i greške pri slanju emaila.
- **Lokacije i valuta** – lokacije se unose u *Podešavanja* (npr. Beograd, Bulevar oslobođenja 299 i Novi Sad, Povrtatska 63, Futog) i biraju se pri zakazivanju; svi iznosi su u evrima (valuta je podesiva).
- **Vreme u 24h formatu** – svuda u aplikaciji, uz lep izbor datuma (kalendar) i vremena (termini na 15 minuta).

---

## 1. Šta je potrebno

- Server sa **Node.js 20 ili novijim** (VPS kod bilo kog provajdera, npr. Hetzner, DigitalOcean, ili domaći hosting koji podržava Node.js aplikacije).
- Dovoljno prostora na disku za fotografije koje su trenutno aktivne (brišu se posle 3 dana).
- Email nalog za slanje (Gmail, ili email sa vašeg domena).

> Obični „shared“ hosting samo za PHP/WordPress **nije dovoljan** – potreban je hosting koji pokreće Node.js.

## 2. Pokretanje

```bash
npm install
cp .env.example .env      # pa u .env upišite ADMIN_PASSWORD
npm start
```

Aplikacija radi na `http://localhost:3000`, admin panel je na `http://localhost:3000/admin`.

Prijava: korisničko ime **admin**, lozinka iz `ADMIN_PASSWORD` (ako je ne podesite, početna lozinka je **admin123** – odmah je promenite u *Moj profil*, gde možete promeniti i korisničko ime).

### Docker (opciono)

```bash
docker build -t teodora-transfer .
docker run -d --name teodora -p 3000:3000 -v teodora-data:/app/data -e ADMIN_PASSWORD=vasa-lozinka --restart unless-stopped teodora-transfer
```

### Da radi stalno (bez Dockera)

```bash
npm install -g pm2
pm2 start server.js --name teodora
pm2 save && pm2 startup
```

## 3. Domen i HTTPS (preporučeno)

Postavite npr. `preuzimanje.teodoratea.rs` ispred aplikacije preko Nginx-a ili Caddy-ja.

**Caddy** (najlakše, sam pravi HTTPS sertifikat):
```
preuzimanje.teodoratea.rs {
    request_body {
        max_size 20GB
    }
    reverse_proxy localhost:3000
}
```

**Nginx** – obavezno povećajte dozvoljenu veličinu uploada:
```
client_max_body_size 20G;
proxy_request_buffering off;
proxy_read_timeout 3600s;
```

Zatim u admin panelu → Podešavanja → **Adresa sajta** upišite `https://preuzimanje.teodoratea.rs`.

## 4. Podešavanje emaila

Admin panel → **Podešavanja → Email (SMTP)**.

**Gmail:**
1. Na Google nalogu uključite verifikaciju u 2 koraka.
2. Napravite **App password**: myaccount.google.com → Bezbednost → Lozinke za aplikacije.
3. U panelu kliknite **Popuni za Gmail**, upišite Gmail adresu i tu lozinku od 16 znakova.
4. Kliknite **Pošalji test email**.

**Email sa sopstvenog domena** (npr. info@teodoratea.rs): SMTP podatke (server, port 465 ili 587, korisnik, lozinka) daje vaš hosting provajder.

Za slanje velikog broja mailova i bolju isporučivost (da ne idu u spam) možete koristiti i Brevo, Mailgun ili Amazon SES – svi daju SMTP podatke koje samo upišete u panel.

## 5. Gde se čuvaju podaci

Sve je u fascikli `data/` (može se promeniti preko `DATA_DIR`):
- `data/db.json` – podešavanja i lista aktivnih slanja
- `data/uploads/` – fotografije klijenata (brišu se automatski kad link istekne)
- `data/brand/` – logo, ikonica i pozadinske fotografije koje dodate kroz admin
- `data/site/` – fotografije sajta i portfolija
- `data/albums/` – fotografije koje klijenti učitaju u IN album (jedna fascikla po albumu)

Originalni logo je u `public/assets/` i koristi se dok ga ne zamenite u adminu (dugme „Vrati originalni“ ga vraća).

**Rezervna kopija:** dovoljno je povremeno kopirati fasciklu `data/`.

Provera isteklih linkova radi svakih 10 minuta i pri svakom pokretanju.

## 6. Podešavanja u `.env`

| Promenljiva | Značenje | Podrazumevano |
|---|---|---|
| `PORT` | port aplikacije | 3000 |
| `ADMIN_USERNAME` | početno korisničko ime (samo pri prvom pokretanju) | admin |
| `ADMIN_PASSWORD` | početna lozinka (samo pri prvom pokretanju) | admin123 |
| `DATA_DIR` | gde se čuvaju podaci i fotografije | ./data |
| `MAX_FILE_MB` | najveći dozvoljen pojedinačni fajl | 10240 (10 GB) |

## Struktura (i kako se dodaje novi deo, npr. CMS za sajt)

```
server.js              pokretanje; lista modula (MODULES)
lib/                   zajedničko: baza (store), prijava (auth), email (mailer), datumi (time),
                       kategorije fotografisanja i njihova polja (categories.js), javne stranice (pages)
modules/brand.js       logo, ikonica, boja, pozadine
modules/settings.js    podešavanja
modules/transfers.js   slanje fotografija, preuzimanja, arhiva, automatsko brisanje
modules/bookings.js    zakazivanja, paketi, scenografije, klijenti/loyalty, podsetnici
modules/inventory.js   magacin: artikli, stanje, porudžbine kod dobavljača
modules/albums.js      IN album: formati, projekti klijenata i porudžbine
modules/web.js         javni sajt i CMS (stranice, portfolio, upiti)
modules/dashboard.js   kontrolna tabla
modules/public.js      javne stranice sajta (ovde ide budući CMS)
public/admin/js/       ekrani administracije, po jedan fajl po delu (core.js = navigacija i zajedničko)
public/album/          uređivač albuma koji klijent koristi na sajtu (index.html, app.css, app.js)
```

- **Novo polje ili nova vrsta fotografisanja:** samo izmena u `lib/categories.js` – formular, provera i prikaz se prave sami.
- **Novi deo sistema:** novi fajl u `modules/` (dodaje se u listu `MODULES` u `server.js`) i novi ekran u `public/admin/js/` registrovan sa `App.view(...)`, plus stavka u meniju u `index.html`.
- Podaci su u jednom fajlu `data/db.json`; nove kolekcije se samo dodaju u `lib/store.js`, postojeći podaci ostaju netaknuti.
