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
2. **Apple Developer nalog** – 99 $ godišnje, da bi aplikacija ostala na telefonu i išla na iPad
   preko TestFlight-a. (Sa običnim Apple ID-jem aplikacija radi, ali ističe posle 7 dana.)
3. Server dostupan sa interneta – adresu upisujete pri prijavi u aplikaciji

## Otvaranje na Mac-u (bez ijedne komande)

Projekat je već napravljen — `TeodoraStudio.xcodeproj` stoji u ovoj fascikli.

1. Na Mac-u instalirajte **Xcode** iz App Store-a (besplatan, velik je, preuzima se dugo).
2. Preuzmite kod: na GitHub-u, dugme **Code → Download ZIP**, pa raspakujte.
3. U fascikli `ios` dvaput kliknite **TeodoraStudio.xcodeproj** — otvara se Xcode.
4. Levo kliknite na **TeodoraStudio** (plava ikonica) → kartica **Signing & Capabilities** →
   polje *Team* → izaberite svoj Apple nalog.
5. Povežite iPhone kablom, izaberite ga u vrhu prozora i pritisnite **▶** (Run).

Aplikacija se instalira na telefon. Pri prvom pokretanju telefon traži da joj verujete:
*Podešavanja → Opšte → VPN i upravljanje uređajem → vaš nalog → Veruj*.

> Ko voli komandnu liniju: projekat se može i ponovo napraviti iz `project.yml`
> (`brew install xcodegen && cd ios && xcodegen generate`), ali to nije potrebno.

## Za iPad i za instalaciju bez kabla (TestFlight)

U Xcode-u: **Product → Archive** → *Distribute App* → **TestFlight & App Store**. Posle par minuta
aplikacija je u TestFlight-u, pa je instalirate na iPad (i na svaki drugi uređaj) iz TestFlight
aplikacije, bez kabla i bez objavljivanja u App Store-u.

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
