# Hanein Bakery on mobile (staff)

> This covers the **staff** system. Customers have their own separate
> Android app — see [CUSTOMER-ORDERING.md](CUSTOMER-ORDERING.md).


Two ways to get the system onto a phone, sharing one codebase — same
approach as ITSF-IMS, minus push notifications (this system doesn't send
any yet):

| | PWA | Android app |
|---|---|---|
| How it is installed | "Add to home screen" from the browser | APK / Play Store |
| Needs a rebuild per release | no — deploy the site | yes — rebuild and redistribute the APK |
| Extra setup | none — works today | none for a debug build; a keystore for a Play Store release |

---

## 1. What staff do

**From the browser**, which needs nothing installed and works on any phone:

- **Android (Chrome):** open `https://hanein.co.tz`, sign in, then menu →
  **Add to Home screen**. It opens full-screen with no browser chrome.
- **iPhone (Safari):** open the site, tap Share → **Add to Home Screen**.

**The Android app:** install the APK (see §2 for how to build one).

Both are the same app underneath — same login, same data, same
permissions. There is nothing to configure to make either work; the PWA
is live the moment the site is deployed.

---

## 2. Building the Android app

Prerequisites: JDK 17+, Android SDK (`ANDROID_HOME`).

```bash
cd ui
npm run build:app      # vite build, then `npx cap sync android`
```

**Debug APK** — for sideloading onto a test phone, no signing needed:

```bash
cd ui/android
./gradlew assembleDebug
# app/build/outputs/apk/debug/app-debug.apk
```

Or in one step from `ui/`: `npm run apk`.

**Release APK / AAB** — for the Play Store. Create a keystore once:

```bash
keytool -genkey -v -keystore hanein-bakery.keystore -alias hanein-bakery \
  -keyalg RSA -keysize 2048 -validity 10000
```

Keep that file and its password safe and backed up — **losing it means
you can never update the app on the Play Store under the same listing.**
Reference it from `ui/android/key.properties` (git-ignored), then:

```bash
cd ui/android
./gradlew bundleRelease     # app/build/outputs/bundle/release/app-release.aab
```

The app's package name, `tz.co.hanein.bakery`, is permanent once
published — the Play Store treats a different package name as a
different app, not an update to this one.

---

## 3. Server configuration

The API needs to allow the native app's origin, since the Capacitor
WebView serves the bundled assets from the device itself
(`https://localhost` on Android) rather than from `hanein.co.tz` — this
is already configured in `backend/app.js`'s `allowedOrigins` list. If the
production domain ever changes, that list needs updating to match.

**HTTPS is required** for the PWA — service workers and the installability
prompt are refused on plain HTTP by every browser (`localhost` excepted).

The native Android build talks to a hardcoded production URL
(`https://hanein.co.tz`, set in `ui/src/lib/apiBase.js`) rather than a
relative path, since it isn't served from that origin the way the PWA
is. Update that file (or set `VITE_API_URL` at build time) if the
production domain ever changes.

---

## 4. Updates

**PWA** — nothing to distribute. The service worker registers with
`autoUpdate`, so a deploy is picked up the next time the app is launched.
There is no version anyone has to install.

**Android** — an APK is a real release: rebuild, re-sign, redistribute.
The app bundles its own copy of the web assets, so a server deploy alone
does not update it.

---

## 5. Offline

The service worker precaches the whole app shell, so it opens and
navigates without a connection. **Data is not cached** — screens that
need the API show their normal loading/error state offline. That's
deliberate: stale stock figures or a sale whose payment status has since
changed are worse than an honest "cannot reach the server".

---

## 6. Not included (yet)

**Push notifications** — deliberately left out of this build. Adding
them later means deciding what should actually trigger one (a new sale?
a low-stock alert? a production plan due tomorrow?), then wiring up Web
Push (VAPID, for the PWA) and Firebase Cloud Messaging (for the Android
app, since its WebView has no Web Push API of its own) — see ITSF-IMS's
`MOBILE.md` for how that was done there, if it's ever wanted here.
