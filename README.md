# Tilen Letonja – beleženje hrane in teže

Spletna aplikacija (PWA) za iPhone: beleženje hrane, štetje kalorij in makrohranil ter spremljanje teže z oceno porabe.
Brez strežnika in brez prijave – vsi podatki so shranjeni samo na telefonu (IndexedDB). Deluje tudi brez povezave.

## Stanje

- [x] **Faza 1:** knjižnica živil (s priljubljenimi), zaslon Danes, dnevni cilji, tema, izvoz/uvoz JSON, izvoz CSV
- [x] **Faza 2:** zgodovina po tednih s povzetki, oznaka »nepopoln dan«, toleranca, zgodovina ciljev
- [x] **Faza 3:** teža z grafom in trendom, tedenska tabela, ocena porabe (TDEE) z indikatorjem zanesljivosti, priporočen vnos

## Struktura

```
index.html, manifest.webmanifest, sw.js   aplikacija, namestitev, delovanje brez povezave
css/app.css                               videz (temni/svetli način, varni robovi iPhona)
js/app.js                                 zagon, zavihki, posodobitve
js/db.js, js/stanje.js                    shramba (IndexedDB)
js/ui/                                    zasloni in gradniki
js/logic/                                 čista logika izračunov (brez DOM) – pokrita s testi
tests/                                    testi (node --test)
icons/, tools/ikone.py                    ikone in skripta, ki jih ustvari
```

## Testi

Potreben je samo Node.js 18+ (brez dodatnih paketov):

```
npm test
```

## Lokalni zagon

```
python3 -m http.server 8080
```

in odpri `http://localhost:8080`.

## Objava na GitHub Pages (brezplačno)

1. Repozitorij mora biti **javen** (GitHub → *Settings* → *General* → *Danger Zone* → *Change visibility*).
   Tvoji podatki niso v repozitoriju – javna je samo koda.
2. *Settings* → *Pages* → *Build and deployment* → *Source: Deploy from a branch*.
3. Izberi vejo (`main`, ko je sprememba združena) in mapo `/ (root)` → *Save*.
4. Po 1–2 minutah bo aplikacija na naslovu `https://<uporabnik>.github.io/moj-prvi-projekt/`.

## Namestitev na iPhone

1. Naslov odpri v **Safariju** (ne v Chromu ali drugem brskalniku).
2. Tapni gumb **Deli** (kvadrat s puščico).
3. Izberi **Dodaj na začetni zaslon** in potrdi z **Dodaj**.
4. Aplikacijo odpiraj vedno z ikone »Tilen« – Safari in nameščena aplikacija imata **ločeno shrambo**.

## Pomembno o podatkih

- Če ikono odstraniš z začetnega zaslona, iOS izbriše tudi podatke. Redno delaj **varnostno kopijo**
  (*Nastavitve → Izvozi varnostno kopijo*) in jo shrani v Datoteke ali iCloud Drive. Aplikacija te opomni po 14 dneh.
- Na nov telefon podatke preneseš z *Uvozi varnostno kopijo*.

## Posodobitve

Ob vsaki objavi povečaj različico v `sw.js` (`VERSION`) in `js/verzija.js` (`APP_VERSION`).
Ob naslednjem odprtju aplikacija ponudi gumb **Posodobi**.
