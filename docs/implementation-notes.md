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

### Last app open

`AppOpenTracker` reports `POST /api/v1/app-open` after authentication on a
foreground launch and whenever the app returns to the foreground, including
the paywall/admin gates. Background launches, screen navigation and duplicate
active events do not count. The backend records server time in
`User.lastOpenedAt`, shared with web tab opens/returns; `lastLoginAt` remains
the sign-in timestamp. Failed/offline reports are logged, not queued.
Deploy the backend migration `20261016073000_user_last_opened` before shipping
the mobile JS update. Existing users show no data until their first reported
open; historical opens are not reconstructed.

### Sentry account identification

Authenticated reports use the readable account number (for example `"58"`) as
Sentry's `user.id` and searchable `user_id`, with `user_number`
and `role` tags, plus an `account` context with the admin profile path
(`/admin/users/<number>`). The number is supplied by the backend's public user
payload; it is optional for compatibility with older deployments. Identification
is set immediately after login/registration/social login and refreshed by `/me`.
The database ID remains in `internal_user_id` and `account.id`. If an older
backend does not supply a number, Sentry's User ID falls back to the database ID.
Logout clears the identity. No name, email or phone is added to Sentry.
Errors before authentication cannot be attributed to an account, and historical
events are not backfilled. Deploy the backend and ship the mobile JS changes
to see numbers in new reports.

### Apple In-App Purchase (iOS)

iOS paywalls and Subscription use direct StoreKit 2 through `expo-iap`, not
Stripe PaymentSheet. Android/web keep Stripe. iOS does not initialize the
Stripe provider. Apple prices/currency are read from StoreKit products, not
the Stripe catalog. Both monthly/yearly Apple products grant all features
including Борса; the account role still determines posting permissions.

Purchase, Restore Purchases and native App Store subscription management
are wired. Access always comes from the authenticated backend's official Apple
JWS verification and App Store Server API status, never a client access claim. Confirmation errors
after payment warn against paying again. SDK operations are serialized and
the server-issued private `appAccountToken` UUID is rechecked after a purchase.
Listeners are installed before requesting a purchase. Signed transactions are
finished only after server verification/persistence; unfinished transactions
are recovered at launch/foreground. User-triggered restore calls StoreKit sync.
Different AgroGrain accounts cannot share/transfer an Apple purchase.
Existing Stripe/bank access and prepaid periods block new Apple purchases
until they end; they are not canceled or converted automatically.

**External setup required before release:**

1. In App Store Connect, for bundle `bg.agrograin.mobile`, create ONE
   auto-renewable subscription group with `bg.agrograin.mobile.full.month`
   (one month) and `bg.agrograin.mobile.full.year` (one year). Set App Store
   prices (intended EUR 50/month and EUR 500/year, subject to available Apple
   price points), availability, localized names/descriptions, review
   screenshot and review notes. Complete Paid Apps agreements/tax/banking.
   Do not add an Apple introductory trial: the existing registration month
   needs no payment details and is independent of Apple.
2. Create an In-App Purchase signing key in App Store Connect -> Users and
   Access -> Integrations -> In-App Purchase (Admin required). Configure its
   `.p8` key, key ID, issuer ID, numeric app Apple ID and bundle ID **only on
   the backend** (see web README). No RevenueCat account or mobile SDK key is needed.
3. The app requires login before buying. Every purchase includes the account's
   UUID, checked against Apple's signed transaction. Restore
   requires the same AgroGrain profile and Apple ID. Deleting a profile does
   not cancel Apple billing and prevents restoring it to a newly created
   profile; warn the user and use support for ownership recovery.
4. In App Store Connect set App Store Server Notifications to version 2 and
   the backend's `/api/apple/notifications` URL, for production and sandbox.
   Notifications are authenticated by Apple's JWS signature, not a bearer secret.
5. Deploy the backend migration and signing credentials (see web README).
   The local Apple migration is not applied by this change.
   Use a sandbox-enabled staging
   backend for development/TestFlight; review builds also make sandbox
   purchases, so ensure their backend explicitly permits them.
6. Build a new binary: `npx eas-cli@latest build --platform ios --profile production`,
   then `npx eas-cli@latest submit --platform ios`. Native IAP cannot be
   installed with an OTA update or tested in Expo Go.

Tests cover native purchase/restore wiring, cancellation, server confirmation,
account changes, duplicate-payment prevention and Android Stripe regression.
They do **not** replace a real sandbox transaction. Before submission test
purchase, cancellation, interrupted/pending payment, restore after reinstall,
wrong-profile restore, monthly/yearly changes in App Store, renewal, billing
grace, refund/revocation and expiry; verify backend access and Apple admin/
report rows. Supply a working review login and include the subscriptions in
the app's first IAP submission. Add policy links in App Store metadata.
Apple receipts/refunds are handled by Apple. Profile deletion warns users
to cancel in App Store first; it never claims Apple billing was canceled.

### Trader registration trial

New trader self-registrations receive one calendar month of full access from
the server without payment details. Email and completed Google/Apple signup
share the policy. `/me` exposes optional `trialActive`/`trialEndsAt` fields;
Profile and Subscription show the end date and no automatic charge.
The app rechecks `/me` at expiry and displays the payment gate. Paid access
takes precedence; purchasing during the trial starts billing immediately.
Older API payloads remain compatible. Deploy the backend trial migration
before enabling registration in the updated app.

### iOS upload permission descriptions

Apple rejected build 1 with ITMS-90683 for missing camera and photo-library
purpose strings. Both keys are configured in `app.json`, not generated native
files. Stripe PaymentSheet includes optional camera-based card scanning.
The app has no photo-library feature; its description explicitly states this
rather than claiming uploads are implemented. Apple's static scan can flag
linked APIs even if unused. If review requires a concrete photo use case,
identify/remove the unused native reference rather than inventing a feature.
These plist changes require a new iOS binary and build number.

### Support access

Profile includes a Help group with "Помощ и поддръжка". It opens the public
support form in the device browser at `https://agrograinhub.bg/support`;
`EXPO_PUBLIC_SUPPORT_URL` can override this for staging. Opening failures
are logged and display the support email instead of failing silently.

### Full-access subscriptions

Each role has one plan: Стопанин for farmers and Търговец for traders, with
monthly (€50) and annual (€500) billing. Both include Борса; annual billing
saves €100. Prices and features come from the backend catalog, not app constants.
Farmer purchases use BASE; trader purchases use TRADER. Legacy tiers remain
readable and labels use the account role. Existing Stripe renewals keep their
original prices until the customer changes plans. Deploy the backend and
configure the new Stripe price IDs before releasing this app update.

### Local iPhone testing with a free Apple account

Use `IOS_PERSONAL_TEAM=1 npx expo prebuild --platform ios --no-clean --no-install`
to remove Push Notifications, Associated Domains and Sign in with Apple
entitlements from the generated iOS project. Select your Personal Team under
Signing & Capabilities in Xcode and run on your connected iPhone. Remote push,
universal links and Apple sign-in are unavailable in this local build; use email
sign-in. Do not set this flag in EAS environments. Regenerate without the flag
before a paid-team or store build to restore production capabilities.

### Optional biometric app lock

Notifications request fresh data on screen mount and app resume, retaining cached
data during fetching and offline. While signed in, unlocked and foregrounded,
notifications are checked every 10 seconds; checks pause offline/in the background
and stop on lock/logout. The Home bell reads the same notification query. Automatic
checks do not show the pull-to-refresh spinner. This is polling after server
creation, not immediate remote push delivery. Home and weather keep their 15-minute freshness
windows; notification refresh does not invalidate them.
Home's pull-to-refresh indicator tracks only a user-initiated refresh, not
background home/weather requests. It stops after that refresh settles, including
failure; returning to Home does not activate the indicator.
The signed-in app keeps the notifications query subscribed across all screens.
Unread alerts use a filled amber bell and count badge. Profile > Notifications
offers device-local, per-account "Банери в приложението" (off by default).
After the initial baseline, new unread items show a dismissable six-second banner
while foregrounded, provided both this option and the master notification switch
are enabled. Tapping opens notifications; old items do not generate banner bursts.
These foreground banners do not require APNs or substitute for lock-screen push.

Profile settings offer Face ID / Touch ID on iOS and strong biometrics on Android.
After successful email registration/login or completed social sign-in, eligible
devices show an optional biometric setup prompt. "Not now" dismisses it for that
sign-in; restored sessions and token renewal do not show it again. Already-enabled
locks and unsupported devices skip the prompt. Enabling requires OS verification
and successful preference storage; failures remain visible with retry/skip.
Enabling and disabling require OS authentication. The device-local preference is
stored in SecureStore and cleared on logout/session revocation. An enabled lock
blocks private screens on cold launch and on leaving the foreground; authentication
starts automatically on opening or returning to the app. Each foreground visit
gets one automatic attempt; cancellation/errors leave an explicit Unlock retry
instead of repeatedly prompting. Cancellation/errors never reveal private screens, and
users can sign out instead if biometrics become unavailable. The OS device
passcode is an allowed fallback. No password or biometric data is stored by the
app, and this lock does not replace server authentication or renew expired sessions.
Web and iOS Expo Go cannot enable it. Rebuild native apps after installing
`expo-local-authentication`; iOS needs the plugin's Face ID usage description.

The free Personal Team build explicitly disables remote push registration and
explains the limitation in notification settings. Paid-team iOS builds need APNs
credentials on EAS; Android builds need Firebase `google-services.json` plus an
FCM v1 service-account credential on EAS. Existing backend push delivery and
in-app notification preferences remain unchanged. Remote delivery must be tested
on a configured build before release.

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
| Google / Apple sign-in | `src/ui/SocialButtons.tsx` (login, register), `src/lib/social-sign-in.ts`, `src/app/(auth)/complete-profile.tsx`, `AuthContext.socialSignIn` → `POST /api/v1/auth/social` | A new development or store build (both libraries are native). Google: OAuth client ids (Web, iOS, Android with the SHA-1 of each signing key) in Google Cloud, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in the app (the iOS URL scheme is added by `app.config.ts`), and `GOOGLE_CLIENT_IDS` on the portal. Apple: the "Sign in with Apple" capability on the App ID (iOS only). Portal migration `20261009110000_social_sign_in`. Each button hides itself when not available. |

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
