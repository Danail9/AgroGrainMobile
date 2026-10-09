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
| 6 Hardening | Partly. Contract check and tests done. **Not done:** accessibility audit on device, Maestro E2E, store assets and listing, EAS project id and submit, universal-link hosting files. |
| 7 Gap closing (this pass) | Code done, **unverified on a device**: forced-upgrade gate, screen-view tracking, in-app account deletion, reset-password screen, push notifications, voice input, `eas.json`. See below. |

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

## Added after the first pass

The notification cron sends user subscription reminders on its first run within
7 days before the paid period ends (including catch-up after a missed run).
Auto-renewing Stripe plans get a renewal reminder; canceled, bank-paid and
manually granted plans get an expiry warning with the full date. Blocked/admin
and individually free accounts, unpaid/expired plans and already prepaid renewals
are excluded. The master switch and `subscriptionReminder` control in-app/push
delivery; payment emails are unchanged. Each subscription/period dedupe key is
stable across scans. `/billing` links open `/subscription` on mobile.
Deploy migration `20261008113000_subscription_reminders`, regenerate Prisma
and update mobile before enabling reminders. An external scheduler must POST
`/api/cron/notifications` with the server-side cron secret (e.g. every 15 minutes);
no new scheduler is provisioned here.

Home greetings, crop names in price rows, and Home offer titles/seller names
wrap onto additional lines instead of truncating. Other screen titles keep their
existing single-line layout.

Notification preferences include a master `enabled` switch and individual
`newOffer`, `newListing`, and `subscriptionUpgrade` switches alongside existing
price/weather categories. Disabling the master switch pauses new in-app and push
alerts without resetting categories or deleting history. Payment emails and
on-screen payment confirmations are independent. Deploy the backend and apply
`20261007151000_notification_controls` before updating the mobile client; both
wire schemas require the new fields. Existing users retain enabled alerts by
default. The web settings form exposes the same controls.
Борса preferences follow recipient roles: farmers see new offers, traders see
new listings, and admins see neither. Hidden preferences are preserved when
saving web settings; mobile updates only the selected field.

Paid plan changes in the mobile subscription screen are scheduled by
`POST /api/v1/subscription/checkout` for the end of the current Stripe period.
The response and `GET /api/v1/subscription/plans` include `scheduledChange`
(tier, interval, effectiveAt). The current plan stays active until that date;
there is no immediate prorated charge. Deploy the matching app-web backend
before using this flow. New subscriptions still use the PaymentSheet.
The plans endpoint advertises `supportsScheduledChanges: true`. Before sending
a checkout request for a paid plan change, the app refreshes this capability
and blocks older backends, which would otherwise charge and change immediately.
Same-interval BASE → TRADER upgrades explicitly send
`changeTiming: IMMEDIATE_UPGRADE`, gated by `supportsImmediateUpgrades`.
Stripe charges the prorated difference on the saved card with
`error_if_incomplete`; access is synchronized only after a successful update.
Downgrades and interval changes remain scheduled for renewal. An existing
Stripe schedule for a different target blocks immediate upgrades. A matching
scheduled upgrade is explicitly replaced; if payment fails, the backend restores
the scheduled upgrade, or reports a restoration failure requiring support.
If neither the subscription nor customer has a default payment method, checkout
returns a SetupIntent first. The app collects a card in Stripe's PaymentSheet,
then resubmits its SetupIntent ID. The backend verifies successful setup and
customer/user/subscription ownership before setting the subscription's default
method and charging the upgrade. Saving a card alone never unlocks access.

Subscription plans are refreshed on mount rather than kept fresh for an hour.
The backend reconciles paid Stripe access on plan reads (excluding admin grants
and impersonation). The subscription screen supports pull-to-refresh and refreshes
account access after plan updates. Activation sync errors after accepted payments
are shown explicitly with a warning not to pay again. Subscription webhooks read
current Stripe state instead of potentially delayed event snapshots.
After payment and verified activation, the app shows a success confirmation.
Its button opens Борса for a trade-enabled plan or Home for BASE; no success
confirmation or redirect is shown for canceled, failed or unconfirmed activation.

Successful immediate upgrades create a `SUBSCRIPTION_UPGRADED` in-app
confirmation and send push when enabled. The invoice ID deduplicates delivery;
the notification opens `/trade`. Notification failures are logged without
reporting a successful payment as failed. Deploy the
`20261007102000_subscription_upgrade_notification` database migration and
regenerate Prisma before deploying the backend. Older mobile clients must be
updated to recognize this notification type.

Price and weather scans and new Борса offers/listings use shared in-app/push
delivery. Category toggles and the price threshold control scan generation;
disabling push still stores in-app alerts. Concurrent scans only push alerts
they actually inserted, and a delivery failure is logged without stopping other
alerts or recipients. Offers notify farmers, listings notify traders, and
authors and blocked accounts are excluded.

Automatic price/weather delivery requires an external scheduler to POST to
the portal's `/api/cron/notifications` endpoint (for example every 15 minutes)
with `Authorization: Bearer <CRON_SECRET>`. Configure the secret server-side
and in the scheduler; never put it in an `EXPO_PUBLIC_*` variable. Publishing
new offers/listings triggers their alerts directly, without the cron job.

Code is in place and covered by unit tests where the logic is pure; none of it has run on a device.

| Feature | Where | Needs before it works |
|---|---|---|
| Forced upgrade | `src/lib/version.ts`, gate in `src/app/_layout.tsx`, `GATE_COPY.update` | `MOBILE_MIN_VERSION` / `MOBILE_LATEST_VERSION` on the portal; `EXPO_PUBLIC_IOS_STORE_URL` for the iOS button. Fails open when offline. A dismissible banner (`UpdateBanner`) shows when `latestAppVersion` is newer. |
| Screen-view tracking | `src/ui/ActivityTracker.tsx` → `POST /api/v1/activity` | Nothing. Paths only, no query strings. Admin "active today" and top pages now include phone users. |
| Account deletion | Settings → "Изтриване на профила" → `DELETE /api/v1/me {password}` | Cancels a Stripe subscription first; refuses admins. Stripe keeps its own invoice records. |
| Legal links | `src/ui/LegalLinks.tsx` (settings, register, consent line) → portal `/privacy` and `/terms` (`app-web/app/(legal)`) | Have the texts reviewed by a lawyer; set `SUPPORT_EMAIL` on the portal for the contact line. Override URLs with `EXPO_PUBLIC_PRIVACY_URL` / `EXPO_PUBLIC_TERMS_URL`. |
| Reset password in app | `src/app/(auth)/reset-password.tsx`, `agrograin://reset-password?token=…` | The portal serves `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` (public in `proxy.ts`), but each answers 404 until `APPLE_TEAM_ID` and `ANDROID_CERT_SHA256` (comma-separated) are set on the portal. `app.json` already declares the domain. |
| Push notifications | `src/lib/push.ts`, `PushRegistrar`, `POST/DELETE /api/v1/me/push-token`, `lib/expo-push.ts`, migration `20261006120000_push_kind` | A development or store build, an EAS project id (`extra.eas.projectId`), APNs and FCM credentials (`google-services.json`). Optional `EXPO_ACCESS_TOKEN` on the portal. The settings switch only shows in such builds. The token is removed on sign-out. |
| Voice input | `src/ui/VoiceButton.tsx`, `src/lib/voice.ts` | A development build (`expo-speech-recognition` is native). Hidden in Expo Go. |
| EAS profiles | `eas.json` | `eas init` to create the project, then `eas build`. |
| CI | `../.github/workflows/ci.yml` | Typecheck, lint, tests for both projects and a schema-copy drift check. Move it to the repo root if the repo is split. |
| Engagement features | `src/app/(app)/market/[crop].tsx` (favourite star, 30/90/365-day range, last-year overlay via `buildComparisonChart`/`yearOverYear`, `PriceAlerts`), `SaveButton` + "Удължи с 7 дни" on trade details, "Запазени" tab on Борса, `BillingManagement` (renewal + invoices) on Абонамент, profit calculator in `src/lib/calculators.ts`, `src/ui/Dialog.tsx` replacing `Alert.alert` | Portal migration `20261009090000_engagement_features` and the cron workflow secrets. Builds older than this parse the notification type enum strictly, so new types may fail their notifications list until users update. |

## Known issues and decisions to make

1. **Metro crashed on a Windows machine with multiple workers** (Node segmentation fault,
   exit 139 / 0xC0000005), on both Node 24 and Node 22. The first bundle request killed
   `expo start`. `metro.config.js` sets `maxWorkers = 1` on Windows only, which fixed it. The portal's
   `next build` crashes the same way on `master` ("Collecting page data"), so it looks
   machine-level (antivirus or a native module). Not diagnosed further.
2. **Voice input** is built but needs a development build to run (see above).
3. **Push notifications** are built (see above) but unverified: they need credentials and a development build. The switch is hidden in Expo Go.
4. **Password reset** emails a web link. The in-app screen exists; opening the emailed link in the app needs the hosted universal-link files (see above). Until then the link opens the web page.
5. **Reader-app rule**: gates carry no price, plan comparison or purchase link
   (`GATE_COPY` in `src/ui/Gate.tsx`, asserted in tests). Check the current App Store and Play
   wording again before submitting.
6. The web trade server actions do not re-check the exchange tier (only the page does). The
   API enforces it on every route. Worth fixing on the web.
7. `lib/auth.ts` and four server-action files in AgroGrain were refactored. All 94 tests pass
   and the flows were exercised live, but a human security review of that diff is advisable.
