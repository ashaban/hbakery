# Customer ordering

Customers order from their own Android app; staff see those orders in
the main system and schedule when each one goes out.

There are now **two** Android apps in this repo, built from two separate
front-ends against one backend:

| | Staff app | Customer app |
|---|---|---|
| Source | `ui/` | `ui-client/` |
| Package | `tz.co.hanein.bakery` | `tz.co.hanein.shop` |
| Launcher name | Hanein Bakery Admin | Hanein Bakery |
| Also a web site / PWA | yes — `hanein.co.tz` | **no**, app only |
| Who installs it | staff | customers |

They're deliberately separate: a customer never downloads the admin
bundle, the two get their own Play Store listings, and a bug in one
can't reach the other.

---

## 1. What a customer does

1. **Registers**, once — shop name, phone number, a password, and where
   they are: region, district, town/street, and a **landmark**. The
   landmark is required, because an address alone routinely isn't enough
   for a driver to find a shop.
2. **Browses the products** with prices, and builds a basket. The basket
   shows a running total and survives the app being closed.
3. **Places the order.** They see "awaiting confirmation" until staff
   schedule it.
4. **Sees the delivery days** as soon as staff set them — including
   which items and how many arrive on each day, when an order is split
   across several days.

The phone number is the login identity and is accepted in any of the
usual forms (`0712345678`, `+255712345678`, `255 712 345 678`) — they
all resolve to the same account, so nobody is locked out for typing
their own number a different way than they registered it.

A customer can cancel their own order **only while nothing has been
scheduled yet**. After that the bakery may already be baking against it,
so it becomes a phone call rather than a button.

---

### Language

The app is **Kiswahili by default**, with English available. The choice
sits on the welcome screen (so someone who wants English doesn't have to
register in Kiswahili first) and under **Akaunti → Lugha**, and is
remembered across restarts.

Every string lives in one file per language:

```
ui-client/src/locales/sw.json     <- Kiswahili
ui-client/src/locales/en.json     <- English
backend/modules/customerMessages.js  <- server messages, both languages
```

To correct any wording, edit the value in those files — no code changes
are needed, and the two JSON files have identical key structures so it's
easy to see if anything is missing.

Server-side messages are translated too: the app sends its language in
`Accept-Language`, so a validation error appears in the same language as
the screen it lands on. Anything other than `sw` falls back to English,
and a request with no header at all gets Kiswahili.

**Not translated:** product names, units and descriptions come from the
`product` table, so they read exactly as staff typed them ("Andazi",
"Pack", "13 in one pack"). If you want those in Kiswahili, edit them in
the admin system and both apps follow.

---

## 2. What staff do

**Customer Orders** in the main menu (needs the `can_see_orders` task).

- Every order, with the customer's phone, region/district/town and their
  landmark right there on the order.
- **Schedule a delivery**: pick the day, then set how much of each item
  goes out on that day. Lines default to the full outstanding amount, so
  scheduling everything at once is one tap; type a smaller number to
  split an order across several days.
- **Day's Deliveries**: everything promised for a given date, grouped by
  area, with each customer's landmark — a driver's run sheet.
- **Mark delivered** when the goods actually go out (and undo it if it
  was tapped by mistake).

An order's status is derived from its deliveries, never set by hand:

```
nothing scheduled          -> Awaiting scheduling
some lines scheduled       -> Partly scheduled
every line fully scheduled -> Scheduled
some scheduled days done   -> Partly delivered
everything delivered       -> Delivered
```

New permissions: `can_see_orders`, `can_schedule_order_delivery`,
`can_cancel_order`. All three are granted to `admin` by migration 015.

### This does not touch stock or sales

Scheduling a delivery records a **promise**, not a movement. Nothing here
writes to `product_ledger`, `sale`, or any stock figure — staff still
record the actual sale the normal way when goods leave. That separation
is deliberate: a customer-facing feature must not be able to move the
numbers the business runs on.

---

## 3. Database

Apply these to production in order, the same way as the others (copy the
SQL and run it against Postgres):

- **`015_customer_orders.sql`** — regions/districts tables, the customer
  account columns (password, location, landmark), the order/delivery
  tables, a database-level guard against promising more than was
  ordered, and the three new permissions.
- **`016_seed_tanzania_geography.sql`** — Tanzania's 31 regions and 195
  districts, so the registration dropdowns have something to offer. Safe
  to re-run.

Customer accounts extend the **existing `customer` table** rather than
living in their own. That matters: a shop that registers in the app is
the same record staff already attribute sales and debts to, so their
history stays in one place. If staff had already created a customer with
that phone number, registering claims that record instead of creating a
duplicate.

---

## 4. Security

Customers and staff both get JWTs signed with the same secret, so the
boundary between them is enforced in two places:

- `requireCustomer` rejects anything that isn't a customer token, so a
  staff token can't act as a customer.
- The staff `jwtValidator` in `app.js` rejects any token whose `type` is
  `customer`. Without that, a customer token would verify fine and reach
  the routes that aren't individually task-gated — `GET /customers`
  would have handed a customer the entire customer list.

Every `/shop` route is scoped to the customer id **in the token**, never
one from the request, so there is no parameter to tamper with.

Prices are always read from the database when an order is placed. The
app shows the customer a total, but a modified request cannot set its
own price.

---

## 5. Building the customer app

Prerequisites: JDK 17+, Android SDK (`ANDROID_HOME`).

```bash
cd ui-client
npm install
npm run apk     # vite build -> cap sync -> gradlew assembleDebug
# android/app/build/outputs/apk/debug/app-debug.apk
```

For a Play Store release, the process and the keystore warning are
identical to the staff app — see [MOBILE.md](MOBILE.md) §2. The package
name `tz.co.hanein.shop` is permanent once published.

The app talks to `https://hanein.co.tz`, hardcoded in
`ui-client/src/lib/api.js` (override at build time with `VITE_API_URL`).
Update it there if the production domain ever changes. The API already
allows the app's WebView origin — both apps share it, so no extra CORS
entry was needed.

**Local development:** `npm run dev` serves on port 3010 and proxies
`/geo`, `/customerAuth` and `/shop` to the backend on 3007, so the app
runs in a desktop browser against real data.

---

## 6. Not included

- **Push notifications.** "Your delivery is confirmed for Tuesday" is
  the obvious first one to add, and this is the feature that most wants
  it — but it needs Firebase Cloud Messaging wiring that isn't here yet.
  Customers currently find out by opening the app.
- **Online payment.** Orders record what is owed; money is still handled
  the way it is today.
- **iOS.** Android only, matching the staff app.
