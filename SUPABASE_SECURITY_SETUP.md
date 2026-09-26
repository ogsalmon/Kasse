# Supabase Security Setup

## 0) Bestellungen für den Neustart löschen (nur wenn bestätigt)

Am 26.09.2026 waren 3 Bestellungen für Beilngries und 520 für Lost & Found sichtbar. Die folgende Vorschau muss diese beiden Zeilen mit insgesamt 523 Bestellungen zeigen, bevor du den Löschbefehl ausführst. Sie löscht keine Getränke oder Barkeeper.

Im Supabase Dashboard **SQL Editor** zuerst die Vorschau ausführen:

```sql
select bar_id, count(*) as bestellungen, min(created_at) as erste, max(created_at) as letzte
from public.orders
where bar_id in (
	'ab51c181-946c-4cf2-9305-1a540172cd7f',
	'ee94abda-7082-48c0-a587-541dd420472b'
)
group by bar_id
order by bar_id;
```

Nur wenn die Summe weiterhin exakt 523 ist (3 Beilngries, 520 Lost & Found), den folgenden einzelnen Befehl ausführen. Der Guard löscht andernfalls nichts:

```sql
with scoped as materialized (
	select id
	from public.orders
	where bar_id in (
		'ab51c181-946c-4cf2-9305-1a540172cd7f',
		'ee94abda-7082-48c0-a587-541dd420472b'
	)
), guard as (
	select count(*) = 523 as expected_count from scoped
)
delete from public.orders o
using scoped s, guard g
where o.id = s.id and g.expected_count
returning o.id, o.bar_id;
```

Der Löschbefehl muss 523 Zeilen zurückgeben. Danach muss diese Kontrolle für beide IDs 0 ergeben:

```sql
select bars.bar_id, count(o.id) as verbleibende_bestellungen
from (values
	('ab51c181-946c-4cf2-9305-1a540172cd7f'::uuid),
	('ee94abda-7082-48c0-a587-541dd420472b'::uuid)
) as bars(bar_id)
left join public.orders o on o.bar_id = bars.bar_id
group by bars.bar_id
order by bars.bar_id;
```

Wenn Vorschau oder Löschresultat abweichen, nicht erneut löschen, sondern erst die Abweichung prüfen. Der SQL Editor benötigt Admin-Rechte; der öffentliche Schlüssel in der App darf diesen Vorgang nicht ausführen.

## 1) Barkeeper-Konten anlegen

Jeder Barkeeper bekommt einen eigenen Supabase-User. Da Supabase intern E-Mail-Adressen verlangt, nutzen wir eine interne Fake-Domain – das ist rein technisch und für Barkeeper unsichtbar.

1. In Supabase: **Authentication → Users → Add user**
2. E-Mail-Format: `benutzername@drinq.local` (z. B. `max@drinq.local`)
3. Passwort: beliebig stark, wird im QR gespeichert
4. Die App zeigt derzeit den Benutzernamen (Teil vor `@`), nicht `display_name` aus den User Metadata.

Beispiele:
| Barkeeper | E-Mail in Supabase | Benutzername im QR-URL-Parameter |
|-----------|--------------------|-----------------------------------|
| Max       | max@drinq.local    | `max`                             |
| Lena      | lena@drinq.local   | `lena`                            |

## 1a) Gewünschte Barkeeper und Bars zuordnen

Die App kann mehrere Zeilen pro `username` laden: Jede Zeile in `barkeepers` gibt genau einer Person Zugriff auf genau eine Bar. Der Barkeeper heißt Fausti; sein Auth-Login im Screenshot lautet `faust@drinq.local`, daher muss `username` in der Zuordnung `faust` sein. Chris und Nora verwenden gemeinsam den Login `chris@drinq.local` für Beilngries. Buchungen beider werden in der App unter `chris` erfasst. Passwörter nicht in SQL oder Chat eintragen.

Gewünschte Zuordnung:

| Loginname (Auth-E-Mail-Präfix) | Beilngries | Lost & Found |
|---|---|---|
| `test` | Ja | Ja |
| `olivia` | Ja | Ja |
| Fausti (`faust`) | Ja | Ja |
| `umut` | Ja | Nein |
| `chris` | Ja | Nein |
| `carla` | Nein | Ja |

Der Fehler `duplicate key ... barkeepers_username_key` bedeutet, dass die Tabelle noch `username` allein als eindeutig erzwingt. Stelle diese Regel **einmalig zuerst** im SQL Editor um. Dadurch bleibt jede Person pro Bar eindeutig, kann aber mehreren Bars zugeordnet werden:

```sql
alter table public.barkeepers
drop constraint if exists barkeepers_username_key;

create unique index if not exists barkeepers_username_bar_id_key
on public.barkeepers (username, bar_id);
```

Falls das Entfernen der alten Constraint wegen eines Foreign Keys fehlschlägt, hier stoppen und die Fehlermeldung prüfen. Nicht die Barkeeper-Tabelle leeren.

Danach den folgenden Zuordnungsblock ausführen. Er bricht ab und nennt fehlende Auth-Accounts, bevor er Zuordnungen ändert; vorhandene passende Zuordnungen bleiben bestehen und fehlende werden ergänzt. `username` muss dabei exakt dem Teil vor `@` der Auth-E-Mail entsprechen: für `faust@drinq.local` also `faust`; `display_name` kann `Fausti` sein.

```sql
do $$
declare
	missing_users text;
begin
	with required_users(username) as (
		values ('test'), ('olivia'), ('faust'), ('umut'), ('chris'), ('carla')
	)
	select string_agg(r.username, ', ' order by r.username)
	into missing_users
	from required_users r
	where not exists (
		select 1
		from auth.users u
		where lower(u.email) = r.username || '@drinq.local'
	);

	if missing_users is not null then
		raise exception 'Zuerst diese Auth-Accounts anlegen: %', missing_users;
	end if;

	with desired(username, display_name, bar_id) as (
		values
			('test', 'Test', 'ab51c181-946c-4cf2-9305-1a540172cd7f'::uuid),
			('test', 'Test', 'ee94abda-7082-48c0-a587-541dd420472b'::uuid),
			('olivia', 'Olivia', 'ab51c181-946c-4cf2-9305-1a540172cd7f'::uuid),
			('olivia', 'Olivia', 'ee94abda-7082-48c0-a587-541dd420472b'::uuid),
			('faust', 'Fausti', 'ab51c181-946c-4cf2-9305-1a540172cd7f'::uuid),
			('faust', 'Fausti', 'ee94abda-7082-48c0-a587-541dd420472b'::uuid),
			('umut', 'Umut', 'ab51c181-946c-4cf2-9305-1a540172cd7f'::uuid),
			('chris', 'Chris', 'ab51c181-946c-4cf2-9305-1a540172cd7f'::uuid),
			('carla', 'Carla', 'ee94abda-7082-48c0-a587-541dd420472b'::uuid)
	)
	insert into public.barkeepers (id, username, display_name, bar_id, created_at)
	select gen_random_uuid(), d.username, d.display_name, d.bar_id, now()
	from desired d
	where not exists (
		select 1
		from public.barkeepers b
		where lower(b.username) = d.username
			and b.bar_id = d.bar_id
	);
end $$;
```

Danach die Tabelle `barkeepers` kontrollieren: Die sechs gewünschten Logins müssen zusammen neun Zuordnungszeilen haben. Der Auth-Screenshot zeigt außerdem `test2` und ein Konto `old295@thi.de`, das nicht in der gewünschten Liste steht. Der Block entfernt keine anderen Zugriffszeilen und ordnet `old295` keiner Bar zu; bestehende Zugriffe erst nach Identifikation und Bestätigung entfernen.

---

## 2) RLS für `orders` aktivieren (wichtig)

Der Browser verwendet den öffentlichen `anon`-Schlüssel. Dieser ist kein Passwort: Sicherheit muss durch Grants und RLS kommen. In **Database → Policies** alle vorhandenen Policies für `orders`, `drinks` und `barkeepers` prüfen. Alte Policies mit `using (true)`, `with check (true)` oder Rolle `anon` vollständig entfernen. Policies werden mit OR verknüpft; eine zusätzliche sichere Policy schränkt eine alte offene Policy nicht ein.

Danach im SQL Editor ausführen. Die Zuordnung erfolgt über `barkeepers.username` = Benutzername vor `@drinq.local` und `bar_id`:

```sql
alter table public.barkeepers enable row level security;
alter table public.drinks enable row level security;
alter table public.orders enable row level security;

revoke all on table public.barkeepers, public.drinks, public.orders from anon, public;
grant select on table public.barkeepers, public.drinks to authenticated;
grant select, insert, delete on table public.orders to authenticated;

drop policy if exists "barkeepers_select_self" on public.barkeepers;
drop policy if exists "drinks_select_assigned_bar" on public.drinks;
drop policy if exists "orders_select_authenticated" on public.orders;
drop policy if exists "orders_insert_authenticated" on public.orders;
drop policy if exists "orders_update_authenticated" on public.orders;
drop policy if exists "orders_delete_authenticated" on public.orders;
drop policy if exists "orders_select_assigned_bar" on public.orders;
drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_delete_own" on public.orders;

create policy "barkeepers_select_self"
on public.barkeepers
for select
to authenticated
using (username = split_part((select auth.jwt()->>'email'), '@', 1));

create policy "drinks_select_assigned_bar"
on public.drinks
for select
to authenticated
using (exists (
	select 1 from public.barkeepers b
	where b.username = split_part((select auth.jwt()->>'email'), '@', 1)
		and b.bar_id = drinks.bar_id
));

create policy "orders_select_assigned_bar"
on public.orders
for select
to authenticated
using (exists (
	select 1 from public.barkeepers b
	where b.username = split_part((select auth.jwt()->>'email'), '@', 1)
		and b.bar_id = orders.bar_id
));

create policy "orders_insert_own"
on public.orders
for insert
to authenticated
with check (
	bartender = split_part((select auth.jwt()->>'email'), '@', 1)
	and exists (
		select 1 from public.barkeepers b
		where b.username = split_part((select auth.jwt()->>'email'), '@', 1)
			and b.bar_id = orders.bar_id
	)
);

create policy "orders_delete_own"
on public.orders
for delete
to authenticated
using (
	bartender = split_part((select auth.jwt()->>'email'), '@', 1)
	and exists (
		select 1 from public.barkeepers b
		where b.username = split_part((select auth.jwt()->>'email'), '@', 1)
			and b.bar_id = orders.bar_id
	)
);
```

Damit können Barkeeper nur die Getränkeliste und Bestellungen ihrer zugeordneten Bar lesen und nur eigene Bestellungen anlegen oder löschen. Die Kasse benötigt keine Order-Updates. Prüfe danach in einem privaten Browserfenster, dass `/rest/v1/orders?select=id` mit dem öffentlichen Schlüssel keinen Bestellinhalt mehr liefert; anschließend mit einem Barkeeper-Login Kasse, Verlauf und PDF testen.

**Sofortmaßnahme:** Am 26.09.2026 war der Projekt-Endpunkt erreichbar, aber ein anonymer GET auf `orders` lieferte 523 Bestell-Metadatensätze aus beiden konfigurierten Bars. Bis die Policies kontrolliert und getestet sind, keine Bestellungen im System anlegen. Der anonyme GET auf `drinks` und `barkeepers` lieferte keine Zeilen; ob dort Daten vorhanden sind, lässt sich ohne Barkeeper-Login nicht feststellen.

## 3) Barkeeper und Getränke kontrollieren

In **Database → Table Editor**:

- `barkeepers`: Für jeden Login muss `username` exakt dem Teil vor `@drinq.local` entsprechen und `bar_id` die UUID aus `config.js` sein. Für Beilngries ist das `ab51c181-946c-4cf2-9305-1a540172cd7f`.
- `drinks`: Jede Zeile braucht diese `bar_id`; `name`, `category`, `volume`, `price` und `deposit` vor dem Event prüfen. Preise sind Eurobeträge als Dezimalzahl (zum Beispiel `3.50`), nicht Cent.
- `orders`: Nicht löschen, um eine neue Schicht zu beginnen. PDF und Statistik rechnen mit den pro Bestellung gespeicherten Verkaufspreisen.

Lege erst nach dem Anlegen/Prüfen eines Auth-Users die passende `barkeepers`-Zeile an. Die E-Mail allein gibt der App keine Bar-Zuordnung.

---

## 4) QR-Code pro Barkeeper erstellen

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

## 5) Login-Seite

- Seite: `login.html`
- **Standard:** QR-Code mit nativer Kamera scannen (automatischer Login)
- **In-App:** QR-Code mit dem „QR-Code scannen"-Button auf der Login-Seite
- **Fallback:** Benutzername + Passwort manuell (ausklappbar unten auf der Login-Seite)

---

## 6) Sicherheitshinweise

- QR-Code enthält Zugangsdaten → wie einen Schlüssel behandeln.
- Bei Verlust sofort Passwort des Barkeeper-Users in Supabase ändern und neuen QR erzeugen.
- Kein direkter Zugriff ohne Session möglich, wenn RLS wie oben aktiv ist.
- Barkeeper müssen nie eine E-Mail-Adresse kennen oder eingeben, nur ihren Benutzernamen.
