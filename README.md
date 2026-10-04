# AgroMobile

Native iOS and Android app for AgroGrain, built with Expo SDK 57 and React Native 0.86.
It talks to the AgroGrain portal's `/api/v1` and reuses the portal's design tokens and
Bulgarian copy. Design: [docs/superpowers/specs](docs/superpowers/specs/2026-10-04-agromobile-design.md).
What was actually built and what is left: [docs/implementation-notes.md](docs/implementation-notes.md).

## Run it on your phone (QR code, Expo Go)

1. Install **Expo Go** from the App Store or Google Play.
2. Start the portal on this machine, from `AgroGrain/` (needs its database and `.env`):

   ```powershell
   git checkout feat/mobile-api
   npm run db:migrate:deploy   # applies the new SessionKind migration
   npm run dev                 # listens on port 3000
   ```

   The portal must be reachable from the phone: same Wi-Fi, and allow Node through the
   Windows firewall for private networks when prompted.
3. Start the app, from `AgroMobile/`:

   ```powershell
   npm install
   npm start
   ```

   Scan the QR code with the phone camera (iOS) or from inside Expo Go (Android).

The app finds the portal by itself: it takes the address of the machine running `expo start`
and uses port 3000. Override it with `EXPO_PUBLIC_API_URL` (for example
`EXPO_PUBLIC_API_URL=https://app.agrograin.bg npm start`).

The account needs an **active subscription** (admin-granted, or the platform "free access"
setting) and the demo seed account is `demo@agrograin.bg` / `demo1234`. Without a plan the app
shows a text-only gate, by design (see below).

### If `expo start` crashes when the phone connects

`metro.config.js` already limits Metro to one worker, which fixes a native crash seen on
Windows. If you still see a segmentation fault, run `npx expo start --clear` once.

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
- **`src/api/schemas.ts` is a copy** of `AgroGrain/lib/api/schemas.ts`. Edit the portal's file
  and copy it here; `npm run check:contract` fails if they differ.
- **One phone per account.** The portal allows one browser session and one phone session. A
  second phone is refused until the first signs out or an admin approves it.
- **Offline.** Reads come from a cache kept for 7 days and are labelled "обновено преди …".
  Changes need a connection.
- Expo APIs change every SDK. Check `https://docs.expo.dev/versions/v57.0.0/` before using one
  from memory, and use `npx expo install` (not `npm install`) for Expo packages.
