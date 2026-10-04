# AgroMobile — Design

**Date:** 2026-10-04
**Status:** Approved, pending implementation plan
**Scope:** A native multiplatform (iOS + Android) Expo application in `AgroMobile/`, plus the JSON API inside `AgroGrain/` required to serve it.

---

## 1. Intent

### Outcome

A native mobile app for Bulgarian farmers and grain traders that delivers the AgroGrain portal's daily value — weather, market prices, the Борса marketplace and the AI assistant — as a real native client, publishable to the App Store and Google Play, and testable during development by scanning a QR code with a phone.

### Who it is for

- **Farmers (`FARMER`)** — the primary audience. They check weather and field-work windows in the field, often on poor connectivity, and track crop prices.
- **Traders (`TRADER`)** — marketplace-first users who publish offers and browse farmer listings.
- **Admins (`ADMIN`)** — out of scope for mobile; directed to the web portal.

### Success criteria

1. A farmer can sign in, read today's forecast and prices, and open the daily AI briefing without touching a browser.
2. The app opens to usable content with no network connection, showing clearly when the data was last refreshed.
3. Visual and textual parity with the web portal: same Bulgarian copy, same design tokens, same navigation model, same error messages.
4. The app passes App Store and Google Play review on first submission.
5. Scanning a QR code from `expo start` loads the app on a developer's phone for every feature in v1 scope.

### Constraints established with the product owner

| Decision | Choice |
|---|---|
| Backend | Add a versioned JSON API to the AgroGrain repo. Both repos change. |
| Billing | **Reader app.** No prices, purchase buttons or outbound purchase links in the mobile app. |
| Device rule | Mobile is a **separate device slot**: one web session + one mobile session per account. |
| v1 scope | Core farmer app + Борса + AI assistant. |
| Offline | Cached reads with a staleness stamp. Writes require connectivity. No write queue. |
| Client architecture | Expo Router + NativeWind + TanStack Query. |
| Tab bar | Five tabs. |

### Explicitly out of scope

Push notifications, the admin panel, an offline write queue, in-app purchases, and retiring the existing Capacitor wrapper. Each is deferred by decision, not oversight; see §12.

---

## 2. The problem this design solves

AgroGrain is a React Server Component application. Every screen is an `async` Server Component that calls Prisma directly, and every mutation is a Next.js server action invoked through an encrypted, version-coupled wire format. Authentication is a signed JWT in an `httpOnly` cookie.

None of that is consumable by a native client. The only JSON route handlers that exist today are `/api/ai/chat`, `/api/stripe/webhook`, `/api/cron/notifications` and `/api/health`.

The enabling insight is that AgroGrain's **data layer is already UI-free**. The functions below are plain `async` functions over Prisma and `fetch`, with no React, JSX or request-scoped Next.js dependency:

- `lib/weather.ts` — `getWeather`, `fieldWorkWindows`, `bestSprayWindow`, `describeCode`
- `lib/weather-history.ts` — `getWeatherPeriods`
- `lib/data.ts` — `getLatestPrices`, `getPriceHistory`, `getRegionalPrices`, `getNews`, `getFertilizers`
- `lib/trade.ts` — `getTraderOffers`, `getFarmerListings`, `getMyOffers`, `getMyListings`, `getOfferById`, `getListingById`, `getCropOptions`, `getFertilizerOptions`
- `lib/daily-summary.ts`, `lib/briefing.ts`, `lib/crop-insight.ts`
- `lib/notifications.ts`, `lib/subscription.ts`, `lib/plans.ts`, `lib/regions.ts`, `lib/settlements.ts`

Therefore the API layer is **thin**: authenticate, call the existing function, serialize the result. No business logic is reimplemented, and the web and mobile clients cannot drift in behavior because they execute the same code.

---

## 3. Repository layout

`AgroMobile/` is its own git repository, a sibling of `AgroGrain/`. They are not a monorepo; see §5.4 for how the API contract stays synchronized across the two.

```
E:\Work\Agro2\
  AgroGrain\     existing Next.js portal  (gains app/api/v1/** and lib/api/**)
  AgroMobile\    new Expo application
```

---

## 4. Part One — the API in AgroGrain

### 4.1 Authentication

The design reuses the existing session machinery rather than building a parallel one. `getCurrentUser()` in `lib/auth.ts` currently performs five jobs in sequence: read the cookie, verify the `jose` HS256 JWT, load the `Session` row, reject blocked users (deleting their sessions), and throttle-update `lastSeenAt`.

Jobs two through five are transport-independent and must not be duplicated.

**Refactor.** Extract them into `resolveSession(token: string)`, returning `CurrentUser | null`. Two thin callers remain:

```ts
// lib/auth.ts
export async function resolveSession(token: string): Promise<CurrentUser | null>

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? resolveSession(token) : null;
}

// lib/api/auth.ts
export async function getApiUser(request: Request): Promise<CurrentUser | null> {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return token ? resolveSession(token) : null;
}
```

The mobile bearer token **is the same signed session JWT** the web issues. This is a deliberate choice with concrete consequences:

- Admin session revocation works on mobile with no extra code.
- `isBlocked` locks a phone out on its next request, not at next login.
- `lastSeenAt` keeps flowing, so the device rule and admin "last seen" stay accurate.
- There is exactly one token format to audit.

Cookie clearing is the one behavior that must not run on the bearer path: `resolveSession` returns `null` and the caller decides. `getCurrentUser()` keeps clearing the stale cookie; `getApiUser()` simply returns `401`.

Impersonation (`getEffectiveUser`) is **not** exposed to the API. Admins impersonate from the web portal only.

**Token lifetime and refresh.** Tokens carry the existing 30-day expiry. `POST /api/v1/auth/refresh` accepts a valid token and issues a new one, deleting the old `Session` row, so a daily-active user is never logged out.

So the client never has to decode a JWT to decide when to refresh, `/auth/login`, `/auth/register` and `/auth/refresh` all return `{ token, expiresAt, user }`, and the client stores `expiresAt` in SecureStore beside the token. It refreshes on the first request made once the token is within 7 days of `expiresAt`.

### 4.2 The device-slot migration

Add to `prisma/schema.prisma`:

```prisma
enum SessionKind {
  WEB
  MOBILE
}

model Session {
  // ...existing fields
  kind SessionKind @default(WEB)
}
```

Changes in `lib/auth.ts`:

- `createSession(userId, meta, options)` gains `kind` (default `WEB`).
- The `deleteMany` inside `createSession` that enforces one usable device becomes scoped: `where: { userId, kind }`.
- `findActiveDeviceSession(userId, idleMinutes, meta)` gains a `kind` parameter and filters on it.

Result: one web session plus one mobile session per account. A second phone is still refused and still raises a `DeviceLoginAttempt` for admin approval, exactly as today. The `@default(WEB)` makes the migration a no-op for every existing row, so browser behavior is unchanged.

`app/admin/users/[id]/page.tsx` and `components/admin-session-list.tsx` should display the kind, so support can tell a phone from a browser.

### 4.3 Response envelope

```ts
type ApiSuccess<T> = { data: T };
type ApiError = { error: { code: string; message: string; field?: string } };
```

`message` is **Bulgarian, user-displayable text**, taken from the Zod schemas already defined in `app/actions/auth.ts` and `app/actions/trade.ts`. Reusing those strings is what keeps error copy identical between web and app. `field` carries the Zod issue path so the mobile form can highlight the right input.

Canonical error codes:

| Code | HTTP | Meaning |
|---|---|---|
| `unauthorized` | 401 | Missing, malformed, expired or revoked token |
| `validation_failed` | 400 | Zod rejection; `field` set |
| `subscription_inactive` | 403 | No active plan (`getSubscriptionState().active === false`) |
| `trade_access` | 403 | Active plan without the `TRADER` tier |
| `forbidden` | 403 | Role check failed (e.g. a farmer posting a trader offer) |
| `not_found` | 404 | Unknown crop slug, news slug, listing or offer id |
| `device_in_use` | 409 | Single-device rule refused the sign-in |
| `login_locked` | 423 | `isLoginLocked()` threshold reached |
| `rate_limited` | 429 | `rateLimit()` refused; `Retry-After` header set |
| `server_error` | 500 | Unexpected failure |

### 4.4 Date serialization

This is the highest-risk detail in the API, because RSC passes `Date` objects directly into components today and nothing in the current code ever crosses a JSON boundary.

Every `Date` is serialized as an ISO-8601 string by an explicit serializer in `lib/api/serialize.ts` — never by incidental `JSON.stringify`. The affected fields are:

- `WeatherData.updatedAt`
- `HourlyEntry.time`
- `DailyEntry.date`, `.sunrise`, `.sunset`
- `PriceRow.date`
- `PricePoint.date`
- `NewsRow.publishedAt`
- `TraderOfferRow.validUntil`, `.createdAt`
- `FarmerListingRow.createdAt`
- `SubscriptionState.currentPeriodEnd`
- `Notification.createdAt`, `.readAt`

Each serializer is unit-tested for a round trip through the matching client Zod schema, which is what makes the duplication in §5.4 safe.

### 4.5 Endpoints

All routes live under `app/api/v1/`. Every route except `/auth/*` and `/version` requires a bearer token; every route except `/auth/*`, `/version`, `/me` and `/regions` additionally requires an active subscription.

**Authentication** — no token required.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | Mirrors `registerAction`. Reuses `registerSchema`. Returns token + user. |
| POST | `/auth/login` | Mirrors `loginAction`, including `isLoginLocked`, `recordFailedLogin`, `singleDeviceRule`, `consumeDeviceApproval`, `recordDeviceAttempt`. `kind: MOBILE`. |
| POST | `/auth/refresh` | Rotates the session. |
| POST | `/auth/logout` | Deletes the `Session` row. |
| POST | `/auth/password/forgot` | Mirrors `requestPasswordResetAction`; always returns success, as the web does, so the endpoint cannot enumerate accounts. |
| POST | `/auth/password/reset` | Mirrors `completePasswordResetAction`. |
| POST | `/auth/device/request` | Re-raises a `DeviceLoginAttempt` after a `409`, so the user can ask an admin for access from the gate screen. |

**Account**

| Method | Path | Returns / notes |
|---|---|---|
| GET | `/me` | `user`, `SubscriptionState`, `unreadCount`, `NotificationPreference`, and the `AppSetting` flags the client needs (`freeAccessEnabled`, `freeAccessTrade`). The client's bootstrap call. |
| PATCH | `/me` | `profileSchema` |
| PATCH | `/me/region` | `{ regionSlug, settlement? }` |
| POST | `/me/password` | `changePasswordSchema` |
| GET | `/regions?q=` | `REGIONS` plus `Settlement` search, backing the region combobox |

**Content**

| Method | Path | Returns |
|---|---|---|
| GET | `/home` | Aggregate; see below |
| GET | `/weather` | `WeatherData` + `fieldWorkWindows()` + `bestSprayWindow()` + `getWeatherPeriods()` |
| GET | `/market` | `getLatestPrices()` grouped by category + `getFertilizers()` |
| GET | `/market/:crop` | Crop, current price, `getPriceHistory()`, `getRegionalPrices()`, `CropInsight` |
| GET | `/news?category=` | Paginated `getNews()` |
| GET | `/news/:slug` | Full article |

**`GET /home` is an aggregate** returning exactly what `app/(app)/page.tsx` gathers in its five-way `Promise.all`: current weather plus today's entry, the first field-work window, the four highlighted prices (`wheat, sunflower, rapeseed, barley` with fillers), the `DailySummary` sections, the unread count, and active trader offers. On field connectivity, collapsing five round trips into one is the difference between a usable home screen and an unusable one. Trader accounts receive the `TraderHome` shape instead.

**Борса** — all require `trade_access`.

| Method | Path | Notes |
|---|---|---|
| GET | `/trade` | `getTraderOffers`, `getFarmerListings`, `getMyOffers`/`getMyListings`, `getCropOptions`, `getFertilizerOptions` |
| GET | `/trade/offers/:id` | `getOfferById` |
| POST | `/trade/offers` | `offerSchema`; trader/admin only; triggers `notifyNewOffer` |
| PATCH | `/trade/offers/:id` | Toggle `isActive` or edit |
| DELETE | `/trade/offers/:id` | Owner only |
| GET | `/trade/listings/:id` | `getListingById`. Contact details included only when `canSeeListingContacts(role)` |
| POST | `/trade/listings` | `listingSchema`, including `hectolitre`/`protein`/`gluten`; triggers `notifyNewListing` |
| PATCH | `/trade/listings/:id` | `status` transitions (`OPEN`/`RESERVED`/`CLOSED`) |
| DELETE | `/trade/listings/:id` | Owner only |

Contact-detail gating is enforced **server-side** in the response shape. The mobile client never receives a phone number it is not allowed to show.

**AI**

| Method | Path | Notes |
|---|---|---|
| POST | `/ai/chat` | The existing `app/api/ai/chat/route.ts`, extended to accept a bearer token and keep its 10/min and 100/day `rateLimit` caps |
| GET | `/ai/briefing/daily` | `getDailySummary(user)` |
| GET | `/ai/briefing/weekly` | Weekly `AiBriefing` |
| GET | `/ai/analysis/weather` | Backs `/ai/weather` |
| GET | `/ai/analysis/market` | Backs `/ai/market` |

The calculators are pure client-side arithmetic in `components/calculators.tsx` and need no endpoint.

**Notifications** — the inbox is read-only in v1; delivery is deferred.

| Method | Path |
|---|---|
| GET | `/notifications` |
| POST | `/notifications/read-all` |
| PATCH | `/me/notification-prefs` |

**Platform**

`GET /version` returns `{ minSupportedAppVersion, latestAppVersion }`, giving a forced-upgrade hook before it is ever needed. A store app cannot be rolled back, so this ships in Phase 1, not when it becomes urgent.

### 4.6 Not exposed

Admin endpoints, Stripe checkout and billing-portal endpoints (the reader-app rule makes them useless to the client), impersonation, and the cron scan.

---

## 5. Part Two — the Expo client

### 5.1 Platform versions

| Dependency | Version | Note |
|---|---|---|
| Expo SDK | 57 | RN 0.86, React 19.2 — matches the portal's React version |
| expo-router | SDK 57's pinned version | File-based routing |
| nativewind | v5 (RC) | Tailwind v4 line, matching the portal's `@theme` syntax |
| lightningcss | pinned `1.30.1` | Required by NativeWind v5 under Expo 57 |
| @tanstack/react-query | v5 | With `persistQueryClient` |
| react-native-svg | SDK 57's pinned version | Weather glyphs and the price chart |
| expo-secure-store | SDK 57's pinned version | Keychain / Android Keystore |

PostCSS config must be `postcss.config.mjs`. Expo 57 does not discover `postcss.config.cjs`.

**NativeWind v5 is a release candidate.** Phase 0 contains a half-day spike that builds one real screen with it on both platforms. If it is unstable, the fallback is a typed `src/theme/tokens.ts` plus `StyleSheet`-based primitives. The token set is roughly twenty hex values, so the fallback costs little and the design system is identical either way. **The spike's outcome is recorded in this repo's README before Phase 2 begins.**

### 5.2 Routing

Routes mirror the portal path-for-path, so the two codebases stay mentally mapped to each other.

```
app/
  _layout.tsx                  providers, fonts, splash, NativeWind, query persister
  (auth)/
    _layout.tsx                redirects to (app) when a token exists
    login.tsx  register.tsx  forgot-password.tsx  reset-password.tsx
    device-blocked.tsx         the 409 gate
  (app)/
    _layout.tsx                session guard, subscription gate, admin redirect
    (tabs)/
      _layout.tsx              role-aware five-tab bar
      index.tsx                Начало  (farmer) / Табло (trader)
      weather.tsx              Време   (tab shown to farmers only)
      market.tsx               Пазар
      trade.tsx                Борса
      news.tsx                 Новини  (tab shown to traders only)
      ai.tsx                   AI
    market/[crop].tsx
    news/[slug].tsx
    trade/listings/[id].tsx  trade/offers/[id].tsx
    ai/daily.tsx  ai/weekly.tsx  ai/weather.tsx  ai/market.tsx  ai/calculator.tsx
    notifications.tsx
    settings.tsx
    subscription-required.tsx  the 403 gate
    admin-notice.tsx           admins are sent to the web portal
```

**Tab bar.** Five tabs, role-aware, derived from the portal's `nav-items.ts`:

- **Farmer:** Начало · Време · Пазар · Борса · AI
- **Trader:** Табло · Борса · Пазар · Новини · AI (`TRADER_NAV` already omits Време)

There is exactly **one** news list screen, `(tabs)/news.tsx`, and exactly one weather screen, `(tabs)/weather.tsx`. Rather than duplicating either as a non-tab route, the tab a given role should not see is hidden with `options={{ href: null }}`, which removes it from the bar while leaving the route navigable by `router.push`. So farmers still open the full news list — from the home screen's news entry points, the Пазар screen's existing news section, and a header icon on Начало — and traders can still reach weather if a link sends them there.

### 5.3 Source layout

```
src/
  api/
    client.ts        fetch wrapper: base URL, bearer header, envelope unwrapping,
                     error-code mapping, refresh-on-near-expiry
    schemas.ts       Zod schemas for every response (copied from AgroGrain)
    queries.ts       TanStack Query hooks, one per endpoint
  auth/
    context.tsx      token in SecureStore, current user, sign-in/out
  ui/                ports of components/ui.tsx and friends
    Card  SectionHeader  ChangeBadge  IconTile  StatChip  Pill  LinkRow
    EmptyState  BarList  SampleSpecs  UnreadBadge  Tabs
    WeatherGlyph     react-native-svg port
    PriceChart       react-native-svg port; geometry unchanged
  lib/
    format.ts        ported verbatim from lib/format.ts
    plans.ts         ported from lib/plans.ts (labels only; no prices rendered)
    calculators.ts   arithmetic extracted from components/calculators.tsx
    field-work.ts    pure helpers if any classification happens client-side
  theme/
    tokens.ts        brand-50..900, canvas, ink, muted, line, soft, up, down, warn
global.css           the token set, in the portal's @theme syntax
```

`format.ts`, `plans.ts` and the calculator arithmetic are pure functions with no React or Next.js dependency. They port verbatim and are the natural first unit tests.

### 5.4 Keeping the contract honest across two repos

Zod schemas are **authored** in `AgroGrain/lib/api/schemas.ts` and **copied** to `AgroMobile/src/api/schemas.ts`. Copying is deliberate: a monorepo migration is not in scope, and an unversioned shared package between two independently deployed repos trades one drift problem for another.

The duplication is made safe by two automated checks:

1. **`npm run check:contract`** in AgroMobile hits a running portal (local or staging) with a seeded account, requests every `GET` endpoint, and validates each response against the client schemas. It runs in CI against staging.
2. **Serializer round-trip tests** in AgroGrain assert that each `toApi*()` output parses under the corresponding schema.

A schema change that is applied on one side only fails CI.

### 5.5 Data flow

TanStack Query is the only data layer. There is no Redux or Zustand store, because the server is the source of truth for everything except the auth token, which lives in `expo-secure-store` and is read once at boot into a React context.

`persistQueryClient` with an `AsyncStorage` persister rehydrates the cache on launch, so the app opens showing the last-known forecast and prices before any network request resolves.

`staleTime` is set per query from how fast the underlying data actually moves:

| Query | staleTime | Rationale |
|---|---|---|
| `/weather` | 15 min | Open-Meteo's own refresh cadence |
| `/home` | 15 min | Dominated by its weather component |
| `/market`, `/market/:crop` | 30 min | Prices are daily, but intraday refreshes exist |
| `/news` | 1 h | Editorial cadence |
| `/ai/briefing/*` | until local midnight | Cached per user per day server-side |
| `/trade` | 5 min | Users expect to see their own posts immediately |
| `/regions` | 7 days | Effectively static |
| `/me` | 5 min | Subscription state must react to a web-side change |

Every cached screen shows a staleness stamp built from `dataUpdatedAt` via the ported `relativeTime()` — "обновено преди 2 ч". Separately, `WeatherData` already carries `isFallback`, set when Open-Meteo is unreachable and the portal substitutes a demo forecast; the mobile client surfaces this explicitly so a farmer is never silently shown fabricated weather.

Mutations require connectivity and fail with a clear Bulgarian message. There is no write queue, by decision.

### 5.6 Error and gate handling

| Code | Mobile behavior |
|---|---|
| `unauthorized` | Clear SecureStore, reset the query cache, route to `(auth)/login` |
| `subscription_inactive` | Route to `subscription-required.tsx` |
| `trade_access` | Борса tab renders an informational state, not a redirect |
| `device_in_use` | Route to `(auth)/device-blocked.tsx`, naming the other device via the ported `describeDevice()`, offering "Заяви достъп" (`POST /auth/device/request`) and retry |
| `login_locked` | Message naming the 15-minute window |
| `validation_failed` | Highlight `field`, show `message` inline |
| `rate_limited` | Honor `Retry-After`; the AI chat's caps become real UI states |
| `not_found` | Empty state with a back affordance |
| offline / `server_error` | Serve cache with the stale banner; show an error state only when the cache is empty |

**The reader-app constraint.** `subscription-required.tsx` and the Борса informational state contain **no price, no plan comparison, no purchase button and no outbound link to a purchase flow.** The text states that the subscription or the plan tier is inactive, and offers sign-out. This follows Apple's guideline 3.1.1 reader-app allowance and the equivalent Google Play policy, and it is the most likely cause of a review rejection if softened later. `plans.ts` is ported for its `TIER_LABELS` and `planName()` only, so the settings screen can name the current plan without quoting its price.

### 5.7 Configuration

`app.config.ts` reads `EXPO_PUBLIC_API_URL`. Development points at a LAN address (`http://192.168.x.x:3000`), mirroring the existing `CAP_SERVER_URL` convention; production points at the deployed portal. `appId`/`bundleIdentifier` reuse `bg.agrograin.app` only if the existing Capacitor Android and iOS apps have not been published under it; otherwise the Expo app takes a distinct identifier and the Capacitor app is retired after launch. **This must be verified against the store accounts in Phase 0,** because an identifier collision cannot be fixed after submission.

Splash and status-bar colors reuse the portal's `#1b5c32`, with `#f3f5f2` as the Android and iOS background, matching `capacitor.config.ts`.

---

## 6. Design system port

The portal's visual language is defined by roughly twenty CSS custom properties in `app/globals.css`, eleven primitives in `components/ui.tsx`, and `Tabs` from `components/tabs.tsx`. All port directly.

Tokens: `brand-50` through `brand-900`, `surface`, `canvas`, `ink`, `muted`, `line`, `soft`, `up`, `down`, `warn`, and the three card shadows. Under NativeWind these stay literal Tailwind classes, so `className="text-brand-600"` is written identically in both codebases.

Primitives to port: `Card`, `SectionHeader`, `ChangeBadge`, `IconTile`, `StatChip`, `Pill`, `LinkRow`, `EmptyState`, `BarList`, `SampleSpecs`, `UnreadBadge`, `Tabs`.

Two ports need real work rather than translation:

- **`WeatherGlyph`** — redrawn with `react-native-svg` for the seven icons in `WeatherIcon` (`sun`, `cloud-sun`, `cloud`, `rain`, `storm`, `snow`, `fog`).
- **`PriceChart`** — already pure SVG path arithmetic with no DOM dependency. The min/max/span math, coordinate mapping and area-path construction transfer unchanged; only the elements become `react-native-svg` components. Its two-point minimum and flat-series guard (`max - min || max * 0.05 || 1`) are preserved.

`lucide-react` becomes `lucide-react-native`, which exposes the same icon names used across `nav-items.ts` and the screens.

Safe-area insets replace the portal's `pt-safe`/`pb-safe` utilities via `react-native-safe-area-context`.

The interface is **entirely in Bulgarian**. All copy is lifted from the corresponding portal screen rather than retranslated, and Phase 6 includes a copy audit comparing every mobile string against its web counterpart.

---

## 7. Screen inventory

| Mobile route | Portal source | Notes |
|---|---|---|
| `(auth)/login` | `app/(auth)/login` | Plus the `device_in_use` and `login_locked` paths |
| `(auth)/register` | `app/(auth)/register` | Role picker (`FARMER`/`TRADER`), region combobox, phone with `DEFAULT_PHONE_CODE` |
| `(auth)/forgot-password`, `reset-password` | same | Reset arrives by email; deep link handled in Phase 6 |
| `(auth)/device-blocked` | *new* | Mobile-specific gate |
| `(tabs)/index` | `app/(app)/page.tsx` | Role-split; `/home` aggregate |
| `(tabs)/weather` | `app/(app)/weather` | Today / 7 days / field work; hourly strip; soil moisture with `describeSoilMoisture`; spray window; YoY history |
| `(tabs)/market` | `app/(app)/market` | Crop categories + fertilizer tab via `MarketSwitch` |
| `market/[crop]` | `app/(app)/market/[crop]` | `PriceChart`, regional comparison, AI insight |
| `(tabs)/trade` | `app/(app)/trade` | Offers / listings / mine; create forms |
| `trade/listings/[id]`, `trade/offers/[id]` | same | Role-gated contacts, `SampleSpecs` |
| `(tabs)/news`, `news/[slug]` | `app/(app)/news` | Four categories; the tab is hidden for farmers, the route stays navigable |
| `(tabs)/ai` | `app/(app)/ai` | Chat + shortcut rows |
| `ai/daily`, `ai/weekly` | same | `BriefingSections` port |
| `ai/weather`, `ai/market` | same | Analysis screens |
| `ai/calculator` | `app/(app)/ai/calculator` | Five calculators, pure arithmetic |
| `notifications` | `app/(app)/notifications` | Inbox + prefs; delivery deferred |
| `settings` | `app/(app)/settings` | Profile, password, region, prefs, plan name, sign out |
| `subscription-required`, `admin-notice` | *new* | Gates |

---

## 8. Testing

AgroGrain has no test infrastructure today. This project introduces it **scoped to the new API only** — retrofitting tests across the whole portal is not in scope.

**AgroGrain (Vitest):**

- `resolveSession` — valid, expired, revoked, blocked-user, and malformed tokens.
- Each gate returns its documented status code and error code.
- Serializer round trips against the client schemas (§5.4).
- The device-slot rule: web + mobile succeeds; a second mobile is refused and raises a `DeviceLoginAttempt`.
- Contact-detail gating: a farmer requesting another farmer's listing receives no phone number.

**AgroMobile:**

- `jest-expo` unit tests for `format.ts`, `plans.ts`, the calculators, and every Zod parser.
- React Native Testing Library for screens against a mocked `QueryClient`, covering loading, empty, error, offline-with-cache and gated states.
- Maestro end-to-end flows: register → subscription gate; login → home → weather; create a listing; recover from device-blocked; open the app offline and read cached weather.

**CI:** `check:contract` against staging on every pull request.

---

## 9. Development and release workflow

### The QR-code requirement

**Phases 0–5 run in Expo Go.** `npx expo start`, scan the QR, test on device immediately. Everything in v1 scope is bundled in Expo Go: all screens, auth, Борса, AI text chat, `react-native-svg`, `expo-secure-store`, TanStack Query.

**Two features require a development build**, because they involve custom native code that Expo Go does not contain:

- Voice input in the AI chat (`expo-speech-recognition`).
- Push notifications — unavailable in Expo Go since SDK 53.

A development build is a one-time `eas build --profile development` install on the device. **QR scanning still works** via `npx expo start --dev-client`; the bundle simply loads into a custom client instead of Expo Go. Voice input is therefore scheduled in Phase 5, behind that build; push stays deferred.

### Release

EAS Build and EAS Submit. Phase 6 produces the 1024×1024 icon, splash assets, store screenshots in Bulgarian, the privacy policy and data-collection disclosures (location is **not** used — the region is user-selected, which simplifies both store questionnaires), and the reviewer notes explaining the reader-app model together with demo credentials.

---

## 10. Architecture summary

```
┌──────────────────────┐      ┌───────────────────────────────────────┐
│  AgroMobile (Expo)   │      │  AgroGrain (Next.js)                  │
│                      │      │                                       │
│  expo-router screens │      │  app/(app)/**      RSC screens  ──┐    │
│         │            │      │  app/actions/**    server actions ─┤    │
│  TanStack Query ─────┼─HTTP─┼─▶ app/api/v1/**    JSON handlers ──┤    │
│         │            │ bear │                                   ▼    │
│  src/api/client.ts   │  er  │                              lib/**    │
│         │            │      │                         (shared logic) │
│  SecureStore (token) │      │                                   │    │
│  AsyncStorage (cache)│      │                              Prisma    │
└──────────────────────┘      │                                   │    │
                              │        PostgreSQL · Open-Meteo ·  │    │
                              │        OpenAI · Stripe · BorsaAgro ┘   │
                              └───────────────────────────────────────┘
```

Both clients execute the same `lib/**` code, so they cannot diverge in behavior.

---

## 11. Phasing

Estimates assume one developer and are rough.

| Phase | Work | Est. |
|---|---|---|
| **0** | Scaffold Expo SDK 57; NativeWind v5 spike with recorded outcome; verify store bundle identifiers against the existing Capacitor apps; CI; EAS setup | 0.5–1 wk |
| **1** | **AgroGrain:** `SessionKind` migration; `resolveSession` extraction; `getApiUser`; envelope; serializers; `/auth/*`; `/me`; `/regions`; `/version`; Vitest suite | 1–1.5 wk |
| **2** | Mobile shell; auth context + SecureStore; all auth screens; the three gates; design-system primitives; `WeatherGlyph` | 1.5 wk |
| **3** | `/home`, `/weather`, `/market`, `/market/:crop`, `/news` endpoints and screens; `PriceChart`; offline cache + staleness stamps; `settings.tsx` (profile, password, region, prefs, plan name, sign out) and the read-only `notifications.tsx` inbox | 2 wk |
| **4** | Борса: endpoints, list and detail screens, create/edit forms, role-gated contacts, grain-sample specs | 1.5 wk |
| **5** | AI: chat, briefings, analyses, calculators; voice input behind the development build | 1.5 wk |
| **6** | Hardening; accessibility; Bulgarian copy audit; Maestro suite; deep links for password reset; store assets; EAS submit | 2 wk |

**Total ≈ 10–11 weeks.**

Phase 1 is on the critical path for everything after it. Phases 3, 4 and 5 are independent of each other once Phase 2 lands and could be parallelized across developers.

**On planning granularity.** At ten to eleven weeks this is too large for one implementation plan at a useful level of detail. This document is the umbrella spec; implementation plans are written **per phase**, each one covering a shippable, verifiable increment. Phases 0 and 1 are planned together, since Phase 0's bundle-identifier and NativeWind findings change nothing about the API work and the two can proceed in parallel. Each later phase is planned when its predecessor lands, so the plan reflects what the previous phase actually taught us.

---

## 12. Deferred, by decision

| Item | Why deferred | What it would take |
|---|---|---|
| Push notifications | Requires a development build, so it cannot be validated in the Expo Go phase. Server-side delivery (`lib/push.ts`, `lib/notification-scan.ts`, the cron scan, `NotificationPreference`, all seven `NotificationType`s) already exists. | `expo-notifications` + FCM/APNs credentials; extend `PushSubscription` to carry Expo push tokens alongside web-push endpoints; a delivery branch in `lib/push.ts` |
| Admin panel | Nine admin sections, used at a desk | A separate decision; likely never on mobile |
| Offline write queue | Explicitly scoped out | Idempotency keys on mutations + a replay queue + conflict handling |
| In-app purchases | Reader-app model chosen | StoreKit / Play Billing or RevenueCat, receipt validation, store webhooks, and reconciliation against Stripe as a second source of truth for `Subscription` |
| Retiring Capacitor | Keep the shipping wrapper until the Expo app is live | Remove `mobile/`, `capacitor.config.ts`, `components/native-bootstrap.tsx`, five `@capacitor/*` dependencies and four npm scripts |

---

## 13. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Date serialization bugs at the JSON boundary — nothing in the portal crosses one today | High | Explicit serializers in `lib/api/serialize.ts`, round-trip tests, `check:contract` in CI |
| NativeWind v5 is a release candidate | Medium | Phase 0 spike with a recorded decision; `theme.ts` + `StyleSheet` fallback costing ~20 token values |
| Phase 1 modifies `lib/auth.ts`, the portal's most security-sensitive file | High | An extraction refactor, not new parallel logic; the cookie path keeps calling the same `resolveSession`; tests written before the refactor |
| Reader-app gates softened during design review, causing store rejection | High | Documented here as a constraint; reviewer notes explain the model at submission |
| Bundle-identifier collision with the published Capacitor app | High | Verified in Phase 0, before any build is submitted |
| Contract drift between the two repos | Medium | Copied schemas plus `check:contract` in CI |
| Six-to-five tab reduction hides Новини from farmers | Low | Three entry points retained: home news card, Пазар news section, header icon |
