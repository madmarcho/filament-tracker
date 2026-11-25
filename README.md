# 🖨️ 3D Filament Tracker (Cloudflare Pages + Cloudflare D1)

Kompletna aplikacja webowa do zarządzania i śledzenia szpul filamentów do druku 3D, hostowana w 100% w ekosystemie **Cloudflare** (frontend na **Cloudflare Pages**, baza danych na serwerowej **Cloudflare D1 SQL** i API w **Pages Functions**).

Działa błyskawicznie na komputerze i w telefonie, bez konieczności wpisywania jakichkolwiek kluczy API czy haseł w przeglądarce.

---

## 📋 Główne pola szpuli:
1. **Producent** (np. *Devil Design, Sunlu, Fiberlogy, Rosa3D, Bambu Lab, Polymaker*)
2. **Materiał** (np. *PLA, PETG, TPU 95A, ASA, ABS, PC, PA-CF*)
3. **Wersja / Wariant** (np. *Matte, High Speed, Meta, Silk, Galaxy*)
4. **Kolor** (nazwa koloru + próbnik HEX z automatyczną wizualizacją na liście)
5. **Lokalizacja** (np. *Półka A, Pudełko próżniowe 2, Suszarka/AMS*)

### ✨ Funkcje:
- **Wskaźnik wagi:** Pasek postępu ile gramów filamentu zostało na szpuli.
- **Minikalkulator wagi:** Połóż szpulę na wadze kuchennej i wpisz wagę brutto – aplikacja sama odejmie wagę pustej szpuli (tarę) i zapisze stan.
- **Wyszukiwarka i filtry na żywo:** Filtrowanie po wielu producentach, materiałach, kolorach, lokalizacjach i statusie.
- **Dwa widoki:** Domyślna, czytelna lista (tabela) lub kafelki (Grid).
- **Kopia zapasowa i Eksport:**
  - **Excel (.xlsx)** – generowanie arkusza Excel z auto-dopasowaniem kolumn i pokolorowanymi komórkami w kolorze filamentu z inteligentnym doborem jasności czcionki (YIQ).
  - **Google Sheets / CSV** – pobieranie pliku CSV ze znacznikiem UTF-8 BOM lub kopiowanie sformatowanej tabeli HTML bezpośrednio do schowka (`Ctrl+V` w `sheets.new`).
  - **Backup bazy (.json)** – pełny zrzut wszystkich danych szpul i parametrów.
  - **Chmura (Google Drive / OneDrive)** – bezpośrednie udostępnianie kopii zapasowej do dysków w chmurze.
  - **Awaryjne przywracanie (Disaster Recovery)** – odzyskanie bazy z pliku kopii zapasowej (zastąpienie lub scalenie).

---

## 🚀 Wdrożenie na Cloudflare (Krok po kroku):

### Krok 1: Utworzenie bazy D1 w Cloudflare
1. Zaloguj się na [dash.cloudflare.com](https://dash.cloudflare.com).
2. W menu bocznym wybierz **Workers & Pages** &rarr; **D1 SQL Database**.
3. Kliknij **Create database**, wybierz **Dashboard**, wpisz nazwę (np. `filament-db`) i kliknij **Create**.
4. W szczegółach nowo utworzonej bazy przejdź do zakładki **Console**.
5. Wklej zawartość pliku `schema_d1.sql` i kliknij **Execute**.
   *(To utworzy tabelę `filaments` oraz indeks).*

### Krok 2: Wdrożenie na Cloudflare Pages z GitHuba
1. W panelu Cloudflare przejdź do **Workers & Pages** &rarr; kliknij **Create application** &rarr; zakładka **Pages** &rarr; **Connect to Git**.
2. Wybierz swoje repozytorium GitHub z projektem `filament-tracker`.
3. W ustawieniach wdrożenia:
   - **Project name:** `filament-tracker` (lub dowolna nazwa)
   - **Production branch:** `main` (lub `master`)
   - **Framework preset:** `None`
   - **Build command:** (zostaw puste)
   - **Build output directory:** (zostaw puste lub wpisz `/`)
4. Kliknij **Save and Deploy**. Strona zostanie opublikowana pod darmowym adresem (np. `https://filament-tracker.pages.dev`).

### Krok 3: Powiązanie bazy D1 z projektem Pages (Binding)
1. W panelu swojego projektu Pages przejdź do **Settings** &rarr; **Functions**.
2. Zjedź niżej do sekcji **D1 database bindings** i kliknij **Add binding**.
3. Ustaw parametry:
   - **Variable name:** `DB` *(dokładnie wielkimi literami)*
   - **D1 database:** wybierz wcześniej utworzoną bazę `filament-db`
4. Kliknij **Save**.
5. Przejdź do zakładki **Deployments** i przy ostatnim wdrożeniu kliknij **Retry deployment** (lub zrób nowy commit na GitHubie), aby powiązanie weszło w życie.

---

## 📦 Przeniesienie danych z Supabase:
1. W starej wersji aplikacji kliknij **„Kopia & Eksport”** &rarr; **„Pobierz plik kopii (.json)”**.
2. Otwórz nową wersję na Cloudflare Pages.
3. Kliknij **„Kopia & Eksport”** &rarr; w sekcji **Awaryjne przywracanie bazy** wybierz pobrany plik `.json` i kliknij **„Przywróć dane do bazy”**.
4. Gotowe! Wszystkie Twoje szpule są już bezpiecznie w Cloudflare D1.
