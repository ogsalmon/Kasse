# Supabase Security Setup

## 1) Barkeeper-Konten anlegen

Jeder Barkeeper bekommt einen eigenen Supabase-User. Da Supabase intern E-Mail-Adressen verlangt, nutzen wir eine interne Fake-Domain – das ist rein technisch und für Barkeeper unsichtbar.

1. In Supabase: **Authentication → Users → Add user**
2. E-Mail-Format: `benutzername@drinq.local` (z. B. `max@drinq.local`)
3. Passwort: beliebig stark, wird im QR gespeichert
4. Optional: unter **User Metadata** `display_name` setzen (z. B. `Max`) – dieser Name erscheint in der App

Beispiele:
| Barkeeper | E-Mail in Supabase | Benutzername im QR-URL-Parameter |
|-----------|--------------------|-----------------------------------|
| Max       | max@drinq.local    | `max`                             |
| Lena      | lena@drinq.local   | `lena`                            |

---

## 2) RLS für `orders` aktivieren (wichtig)

Im SQL Editor ausführen:

```sql
alter table public.orders enable row level security;

-- Falls alte, zu offene Policies existieren: zuerst löschen
-- drop policy if exists "..." on public.orders;

create policy "orders_select_authenticated"
on public.orders
for select
to authenticated
using (true);

create policy "orders_insert_authenticated"
on public.orders
for insert
to authenticated
with check (true);

create policy "orders_update_authenticated"
on public.orders
for update
to authenticated
using (true)
with check (true);

create policy "orders_delete_authenticated"
on public.orders
for delete
to authenticated
using (true);
```

Damit kann ohne Login (anon) niemand mehr Daten lesen oder schreiben.

---

## 3) QR-Code pro Barkeeper erstellen

Jeder Barkeeper bekommt einen QR-Code, der eine direkte Login-URL enthält. Scannt er ihn mit der normalen Handy-Kamera, öffnet sich der Browser und er ist automatisch eingeloggt – kein manueller Schritt nötig.

**URL-Format für den QR-Code:**

```
https://DEINE-DOMAIN/login.html?u=BENUTZERNAME&p=PASSWORT
```

`BENUTZERNAME` ist der Teil vor `@` der Supabase-E-Mail.
Beispiel: Supabase-E-Mail `max@drinq.local` → `u=max`

Beispiel:

```
https://meine-bar.de/login.html?u=max&p=S3hrStarkesPasswort!
```

**QR-Code erzeugen:**
1. Auf [qrcode.com](https://www.qrcode.com/en/free/) oder [qr.io](https://qr.io) gehen
2. Die URL oben eingeben
3. Als Bild/PDF exportieren und **ausdrucken**
4. Tipp: URL als Backup auf die Rückseite der Karte drucken

**Barkeeper-Ablauf:**
1. Handy-Kamera öffnen
2. QR-Code scannen
3. Browser öffnet sich → automatisch eingeloggt → direkt in der App

---

## 4) Login-Seite

- Seite: `login.html`
- **Standard:** QR-Code mit nativer Kamera scannen (automatischer Login)
- **In-App:** QR-Code mit dem „QR-Code scannen"-Button auf der Login-Seite
- **Fallback:** Benutzername + Passwort manuell (ausklappbar unten auf der Login-Seite)

---

## 5) Sicherheitshinweise

- QR-Code enthält Zugangsdaten → wie einen Schlüssel behandeln.
- Bei Verlust sofort Passwort des Barkeeper-Users in Supabase ändern und neuen QR erzeugen.
- Kein direkter Zugriff ohne Session möglich, wenn RLS wie oben aktiv ist.
- Barkeeper müssen nie eine E-Mail-Adresse kennen oder eingeben, nur ihren Benutzernamen.
