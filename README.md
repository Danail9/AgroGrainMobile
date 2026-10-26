# AgroMobile

Native iOS and Android app for AgroGrain, built with Expo SDK 57 and React Native 0.86.
It talks to the AgroGrain portal's `/api/v1` and reuses the portal's design tokens and
Bulgarian copy. Design: [docs/superpowers/specs](docs/superpowers/specs/2026-10-04-agromobile-design.md).
What was actually built and what is left: [docs/implementation-notes.md](docs/implementation-notes.md).
Use Node.js 26.12.1, pinned in [.nvmrc](.nvmrc) and the EAS build profiles.

## Run it on your phone (QR code, Expo Go)

1. Install **Expo Go** from the App Store or Google Play.
2. Start the app, from `app-mobile/`:

   ```bash
   npm install
   npm start
   ```

   Scan the QR code with the phone camera (iOS) or from inside Expo Go (Android).

### Which portal the app talks to

By default the live portal. The address is set in the committed `.env` via
`EXPO_PUBLIC_API_URL`, so a fresh clone works with no setup. It holds a public URL only:
`EXPO_PUBLIC_` values are bundled into the app and visible to anyone
who has it, so never put a secret in there. Note this is the **real** database: registering
creates a real user.
If the configured AgroGrain `.bg` or `.com` API domain returns a gateway-unavailable response,
the app retries on the alternate domain. It also fails over for network failures on reads and
login requests; other writes are not replayed after an ambiguous network failure.

To use a portal running on your own PC instead:

1. Start it from `app-web/` against a **local** database, never the hosted one
   (`npm run db:migrate:deploy`, then `npm run dev`). The phone must reach the PC: same Wi-Fi,
   and allow Node through your firewall for private networks (on Windows: the private-network rule).
2. Copy `.env.local.example` to `.env.local` (not committed) and set your PC's LAN address as the
   phone sees it, for example `EXPO_PUBLIC_API_URL=http://192.168.1.10:3000`.
3. Restart with a cleared cache:

   ```bash
   npm start -- --clear
   ```

**Always pass `--clear` after changing any `.env` file.** Metro caches the compiled value, and
without it the app keeps using the previous address even though Expo reports loading the new
file. With no `EXPO_PUBLIC_API_URL` at all the app falls back to guessing the address of the PC
running `expo start` on port 3000, which fails when that PC has virtual network adapters.

### Accounts

Market and home crop prices are manually entered Varna/Burgas port quotes only.
Lists retain compact crop-icon rows with separate Varna and Burgas price columns;
missing quotes show a dash. Details show full delivery labels and update dates.
Crop details include a local quantity calculator below the port quotes, initially
set to 100 tonnes. It accepts decimal commas or dots and estimates the euro value
at each published port price, plus the absolute difference when both exist.
Whole-euro totals omit decimal zeros (for example, `20 400 €`); cents remain visible.
Missing quotes never count as zero. Estimates are not profit calculations and
do not subtract transport costs; no additional API request is needed.
Crops without quotes are
omitted. There are no scraped/national crop prices, price charts, comparison
controls, or target-price alerts. This requires the updated web API and mobile
client. Existing manual port quotes are preserved by the server migration.

The account needs an **active subscription** (admin-granted, or the platform "free access"
setting). Register your own account; database seeding does not create a demo login. Without a plan the app
shows a text-only gate, by design (see below).

### If `expo start` crashes when the phone connects

`metro.config.js` already limits Metro to one worker on Windows, which fixes a native crash seen
there. If you still see a segmentation fault, run `npx expo start --clear` once.

### Optional environment

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL` | Policy pages linked from register and settings (hidden when unset) |
| `EXPO_PUBLIC_IOS_STORE_URL` | App Store link for the forced-upgrade screen |

Push notifications and voice input are native: they need a development build
(`npx expo run:ios|android` or `eas build --profile development`), not Expo Go.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server with the QR code |
| `npm test` | Jest unit and component tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` |
| `npm run check:contract` | Validates a running portal against this app's schemas. Set `API_URL`, `CHECK_EMAIL`, `CHECK_PASSWORD`. Also checks the schema copy is byte-identical to the portal's. |

## Layout

```
src/app/        routes (Expo Router): (auth), (app)/(tabs), detail screens
src/api/        typed client, TanStack Query hooks, schemas.ts (copy of the portal's contract)
src/auth/       session in the OS keychain, sign-in/out
src/ui/         design-system components ported from the portal
src/lib/        pure logic: formatting, calculators, chart geometry, market/weather helpers
src/theme/      colour, spacing and type tokens from the portal's globals.css
```

## Rules worth knowing

- **Reader app.** The app never shows a price, a plan comparison or a way to buy. Gates only say
  what is wrong. Apple (3.1.1) and Google Play reject apps that sell digital access outside their
  own billing. The wording lives in `GATE_COPY` and is asserted by tests.
- **`src/api/schemas.ts` is a copy** of `app-web/lib/api/schemas.ts`. Edit the portal's file
  and copy it here; `npm run check:contract` fails if they differ.
- **One phone per account.** The portal allows one browser session and one phone session. A
  second phone is refused until the first signs out or an admin approves it.
- **Offline.** Reads come from a cache kept for 7 days and are labelled "обновено преди …".
  Changes need a connection. The persisted cache has a revision string (`buster` in
  `src/api/queryClient.ts`) that is bumped on API contract changes so stale responses,
  which bypass schema defaults, are discarded even after same-version OTA updates.
- The News screen shows the latest USDA WASDE global wheat, corn, rice and soybean estimates
  in Bulgarian, with a link to the readable PDF report. Each crop shows production, ending
  stocks and stocks-to-use with the change versus the previous season, a deterministic
  "balance" chip (tighter / looser / no clear direction) derived server-side from the monthly
  stocks revision and the change in cover, plus expandable details: consumption, trade,
  monthly revisions, the regions that matter for Bulgaria (EU, Russia, Ukraine, US, Brazil,
  Argentina) and a short "why it matters" note. The header shows the publication date and the
  next USDA release date when the portal could read the calendar. These are world
  supply-and-demand balances, not Bulgarian prices; the portal reads USDA's public monthly
  XML. Summaries cached by older app versions still parse because the new fields default.
- Expo APIs change every SDK. Check `https://docs.expo.dev/versions/v57.0.0/` before using one
  from memory, and use `npx expo install` (not `npm install`) for Expo packages.
