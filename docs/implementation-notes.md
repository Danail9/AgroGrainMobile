# Implementation notes

What was built, where it differs from
[the design spec](superpowers/specs/2026-10-04-agromobile-design.md), and why.
The spec is the intent; this file is what exists.

## Status

| Phase | Result |
|---|---|
| 0 Scaffold | Expo SDK 57 app, `src/app` routing, CI-able scripts. NativeWind spike **not run** (see below). |
| 1 API (AgroGrain, branch `feat/mobile-api`) | Done. Bearer auth, per-kind device slots, 37 route handlers (30 files), shared flows, contract schemas. |
| 2 Shell + auth + gates | Done. Login, register, forgot password, inactive-plan and admin gates. |
| 3 Core farmer app | Done. Home, weather (4 tabs), market (+ fertilisers), crop detail, news, profile, notifications. |
| 4 Борса | Done. Offers, listings, create/edit/delete, role-gated contacts, sample specs. |
| 5 AI | Done except **voice input**. Chat, daily/weekly briefings, weather and market analysis, calculators. |
| 6 Hardening | Partly. Contract check and tests done. **Not done:** accessibility audit on device, Maestro E2E, store assets, EAS submit, reset-password deep link. |

## Verified, and how

- `tsc --noEmit` clean in both repos; `expo lint` clean; `expo-doctor` 21/21.
- AgroMobile: 108 Jest tests (formatters, calculators, API client incl. single-flight
  refresh, gate copy, query states). AgroGrain: 94 Vitest tests.
- Both platforms bundle with Metro (`expo export`), and the dev server serves Android and iOS
  bundles and the Expo Go manifest (`exposdk:57.0.0`).
- Against a **real portal and a real (throwaway) PostgreSQL**: all 17 migrations apply, the new
  `SessionKind` migration matches `schema.prisma` (no drift), 15 live endpoints match the
  contract, and a 51-assertion end-to-end script covers registration, device slots, token rotation,
  logout, password change, exchange roles, listing privacy and ownership.

**Not verified: the app running on a phone.** No device or emulator was available, so no screen
has been looked at. Layout, spacing, keyboard behaviour, safe areas and gestures are untested.
Expect visual fixes on first scan.

## Deviations from the spec

| Spec | Built | Why |
|---|---|---|
| NativeWind v5 + Tailwind | Typed tokens (`src/theme/tokens.ts`) + `StyleSheet` primitives | NativeWind v5 is a release candidate and could not be validated without a device. The spec allowed this fallback. Tokens are the portal's values; NativeWind can be added behind the same primitives later. |
| Routes in `app/` | Routes in `src/app/` | Expo SDK 57's convention. |
| `Tabs` from `expo-router` | `Tabs` from `expo-router/js-tabs` | The installed SDK 57 package marks the former deprecated. |
| `lucide-react-native` | `@expo/vector-icons` (Ionicons) | Ships with Expo Go; no extra native dependency. |
| `WeatherGlyph` drawn with SVG | Ionicons glyphs | Same reason. `react-native-svg` is still used for the price chart. |
| Explicit per-field date serializers | Recursive `serialize()` | A field list goes stale when a column is added; a walker cannot forget one. It also rejects NaN, Infinity, Map, Set and BigInt. |
| `GET /regions?q=` requiring a token | `GET /regions`, public, returns all 114 settlements (~4 KB) | Registration needs the region picker before sign-in; filtering client-side works offline. |
| `POST /auth/device/request` | Removed | A refused sign-in already records the `DeviceLoginAttempt` for the admin. |
| `GET /ai/analysis/weather` and `/market` | Removed | Those portal pages are rule-based and computed inside the page components; the app derives them from `/weather` and `/market`. |
| Regional prices on `/market/:crop` | Removed | No portal screen shows them, and `getRegionalPrices` can fall back to a synthetic spread. |
| Separate `device-blocked` route | Inline card on the sign-in screen | Fewer states to keep consistent. |
| `/market` news = latest | `MARKET` category, as the web | Parity. |
| Date picker for offer validity | Choice of 7 / 30 / 90 days / none | Avoids a native dependency. |
| Bundle id `bg.agrograin.app` if free | `bg.agrograin.mobile` | Could not check the store accounts. **Confirm before the first store build**; an id cannot be changed afterwards. |

Server-side behaviour changes beyond new routes:

- `loginAction`, `registerAction` and the password-reset actions now call shared functions in
  `lib/auth-flow.ts` (same checks, same Bulgarian messages) instead of holding their own copy.
- `getCurrentUser()` is a thin cookie wrapper over the new `resolveSession(token)`.
- The one-active-device rule is per `SessionKind`; existing sessions default to `WEB`.
- The chat route shares `runChat()` with the new endpoint, so the 10/min and 100/day limits
  count per account across both clients.
- The admin session list labels each session "Приложение" or "Браузър".

## Known issues and decisions to make

1. **Metro crashes on this Windows machine with multiple workers** (Node segmentation fault,
   exit 139 / 0xC0000005), on both Node 24 and Node 22. The first bundle request killed
   `expo start`. `metro.config.js` sets `maxWorkers = 1`, which fixed it. The portal's
   `next build` crashes the same way on `master` ("Collecting page data"), so it looks
   machine-level (antivirus or a native module). Not diagnosed further.
2. **Voice input** needs `expo-speech-recognition`, which is not in Expo Go. Build it in a
   development build.
3. **Push notifications** are deferred, as decided. The inbox, preferences and server-side
   scan already work; delivery to the device does not. The push switch is hidden in settings.
4. **Password reset** emails a web link. Opening it in the phone's browser works; handling it
   inside the app needs a deep link and a verified domain.
5. **Reader-app rule**: gates carry no price, plan comparison or purchase link
   (`GATE_COPY` in `src/ui/Gate.tsx`, asserted in tests). Check the current App Store and Play
   wording again before submitting.
6. The web trade server actions do not re-check the exchange tier (only the page does). The
   API enforces it on every route. Worth fixing on the web.
7. `lib/auth.ts` and four server-action files in AgroGrain were refactored. All 94 tests pass
   and the flows were exercised live, but a human security review of that diff is advisable.
