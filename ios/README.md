# Teodora – aplikacija za iPhone i iPad

Prava iOS aplikacija (SwiftUI) koja se prijavljuje na **vaš server** i radi nad **istom bazom** kao
panel u pregledaču. Nije sajt u omotaču: ekrani su napravljeni za telefon, a podaci se čitaju i
upisuju preko istih adresa (`/api/admin/...`) koje koristi i panel.

## Šta aplikacija ima

| Kartica | Sadržaj |
|---|---|
| **Danas** | šta predstoji narednih 14 dana, šta čeka obradu, upozorenja (prihvaćene ponude, novi upiti, poručeni albumi, istekli rokovi, artikli pri kraju) i brojke |
| **Zakazivanja** | spisak sa filterima i pretragom, mesečni kalendar, detalji termina: pozovi / pošalji email jednim dodirom, cena sa kaparom, označavanje obrade |
| **Ponude** | nova ponuda (klijent, vrsta, paket, popust, kapara, rok), slanje emailom, praćenje ko je prihvatio, otvaranje ponude onako kako je klijent vidi |
| **Upiti** | upiti sa sajta (poziv, email, „rešeno") i obaveštenja iz panela |
| **Više** | poklon vaučeri, porudžbine albuma, magacin, nalog i odjava; za pošту, CMS i slanje fotografija otvara se ceo panel unutar aplikacije (ista prijava) |

Prijava traje 90 dana i sama se produžava, pa aplikacija ne traži lozinku pri svakom otvaranju.

## Šta vam treba

1. **Mac sa Xcode-om** (besplatan, iz App Store-a)
2. **Apple Developer nalog** – 99 $ godišnje. Obavezan ako nemate kabl, jer je TestFlight
   jedini bežični način da aplikacija dođe na telefon i tablet.
3. Server dostupan sa interneta – adresu upisujete pri prijavi u aplikaciji

## Otvaranje na Mac-u (bez ijedne komande)

Projekat je već napravljen — `TeodoraStudio.xcodeproj` stoji u ovoj fascikli.

1. Na Mac-u instalirajte **Xcode** iz App Store-a (besplatan, velik je, preuzima se dugo).
2. Preuzmite kod: na GitHub-u, dugme **Code → Download ZIP**, pa raspakujte.
3. U fascikli `ios` dvaput kliknite **TeodoraStudio.xcodeproj** — otvara se Xcode.
4. Levo kliknite na **TeodoraStudio** (plava ikonica) → kartica **Signing & Capabilities** →
   polje *Team* → izaberite svoj Apple nalog.
5. Pritisnite **▶** (Run) da je isprobate na Mac-u (iPhone simulator), a za instalaciju na
   svoj telefon i tablet idite na odeljak **Bez kabla: TestFlight** ispod.

Ako imate kabl: povežite iPhone, izaberite ga u vrhu prozora i pritisnite **▶**. Prvi put telefon
traži da joj verujete: *Podešavanja → Opšte → VPN i upravljanje uređajem → vaš nalog → Veruj*.

> Ko voli komandnu liniju: projekat se može i ponovo napraviti iz `project.yml`
> (`brew install xcodegen && cd ios && xcodegen generate`), ali to nije potrebno.

## Bez kabla: instalacija preko TestFlight-a (iPhone i iPad)

AirDrop ne može da instalira aplikaciju – iOS to ne dozvoljava ni iz jednog fajla. Bežični put je
TestFlight i ide ovako:

1. **Upišite se u Apple Developer Program** na `developer.apple.com/programs` (99 $ godišnje,
   kao pojedinac; potvrda obično stigne za dan).
2. U **App Store Connect** (`appstoreconnect.apple.com`) → *Apps* → **+** → *New App*:
   - Platforms: iOS, Name: **Teodora**, Language: Serbian
   - Bundle ID: `rs.teodorateaphotography.studio` (isti kao u projektu)
   - SKU: bilo šta, npr. `teodora-1`
3. U Xcode-u: gore pored imena aplikacije izaberite **Any iOS Device**, pa
   **Product → Archive**. Kada se završi, u prozoru *Organizer* kliknite
   **Distribute App → TestFlight & App Store → Upload**.
4. Posle 10–30 minuta obrade, u App Store Connect-u otvorite **TestFlight → Internal Testing**,
   napravite grupu i dodajte sebe (vaš Apple ID). Interno testiranje ne čeka Apple-ovu proveru.
5. Na iPhone-u i iPad-u instalirajte **TestFlight** iz App Store-a, prijavite se istim Apple
   ID-jem i instalirajte **Teodora**.

Svaka naredna verzija se šalje istim putem (Archive → Upload), a na telefonu stiže obaveštenje.
Build u TestFlight-u važi 90 dana; novim slanjem se rok obnavlja.

> Ako kasnije dođete do kabla: prvo povezivanje telefona i Mac-a kablom otključava i
> bežično pokretanje (Xcode → *Window → Devices and Simulators* → *Connect via network*).

## Prijava u aplikaciji

- **Adresa servera**: `panel.teodorateaphotography.com` (ili trenutna adresa servera)
- **Korisničko ime i lozinka**: isti kao za panel

## HTTPS (preporučeno, ali nije obavezno odmah)

iPhone rado radi sa `https://`. Dok server radi na običnom `http://`, u `Info.plist` stoji
`NSAllowsArbitraryLoads` da bi veza prolazila. Kada server dobije domen i sertifikat
(Caddy ga izvadi sam), taj deo u `Info.plist` obrišite.

Na serveru, uz Caddy:

```
panel.teodorateaphotography.com {
    request_body { max_size 20GB }
    reverse_proxy localhost:3000
}
```

pa u DNS-u napravite `A` zapis `panel` ka IP adresi servera. Caddy sam preuzima sertifikat.

## Struktura

```
ios/
  project.yml                  definicija projekta za xcodegen
  TeodoraStudio/
    App.swift                  pokretanje, stanje prijave, boje i formati
    API.swift                  veza sa serverom i modeli podataka
    RootView.swift             prijava i glavne kartice
    DashboardView.swift        Danas
    BookingsView.swift         zakazivanja, kalendar, detalji
    OffersView.swift           ponude i nova ponuda
    RequestsView.swift         upiti sa sajta i obaveštenja
    MoreView.swift             vaučeri, albumi, magacin, panel u aplikaciji
    Info.plist, Assets.xcassets
```

Aplikacija ne čuva podatke na telefonu — sve stoji na vašem serveru, kao i do sada.
