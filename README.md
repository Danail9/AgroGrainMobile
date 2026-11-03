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

### Logistics (Android / iOS)

The **Карта** bottom tab opens `/map` for both farmer and trader accounts inside
the existing active-subscription gate. Logistics is no longer a Home shortcut.
It opens an interactive map of Bulgaria, with labelled logistics markers, compact
floating filters, a verification legend and a list toggle. There are no GPS,
nearby-search or search-centre controls in this tab.
The old `/logistics` link redirects to `/map`. Facilities open a details sheet
with external directions and `/logistics/[id]` with provenance, verification states,
contacts and capacities.
The marker sheet prioritizes description, operator/phone, website, contact
verification state, latest current verification date and a source link/date.
Rail/grain capabilities remain explicitly labelled as verified/pending/unknown.
External directions and the full detail screen remain available.
Locations now carry an optional accuracy label for API backward compatibility.
CITY_APPROXIMATE explicitly means a town-area marker, not a factory/entrance.
Markers and cards label this uncertainty; delivery navigation is unavailable
for approximate locations. UNKNOWN means accuracy has not been confirmed.
ADDRESS_GEOCODED is an address-level point, not a verified loading entrance.
FACILITY_VERIFIED is derived by the backend from current coordinate evidence.
Release this client before publishing approximate drafts to users.
Publication no longer requires a source: source-free published records are
visible with an explicit missing-source warning, not promoted to verified.
Evidence requirements for verification and approximate-location warnings remain.
The map toolbar has a horizontally scrollable category row, including
“Мелници”, “Маслобойни”, “Фуражни заводи” and “Пивоварни”. Selecting a category
immediately filters the map/list while preserving the other applied filters;
“Всички категории” clears only the type. These types also appear in Filters.
Deploy the backend processing-categories and split-mills migrations before using
the new types. Existing combined-category records remain visible under All
and retain their legacy label until an administrator reclassifies them.
Public map category buttons and type filters offer only Мелници, Маслобойни,
Фуражни заводи, Пивоварни and Пристанища (PORT_TERMINAL), plus the All reset.
Other stored types remain supported by the API and are visible under All.
The native overview uses a light base map, compact category chips and count-only
clusters. A segmented Map/List switch and accessible icon buttons for Filters
and Legend keep the toolbar narrow; the All chip is shortened visually.
The initial viewport is tighter around Bulgaria. The bottom-right overview
button returns to Bulgaria without changing filters and clears any saved
selection viewport. The count badge sits at the bottom-left.
Five custom SVG category icons (wheat, oil drop, feed factory, brewery mug,
port anchor) appear in category chips, facility pins/cards and the legend.
Single-category clusters show their icon and count; mixed clusters show count
only. Status colours and approximate dashed borders retain their meaning.
Map GeoJSON includes `properties.type` for category pins under All; deploy the
portal with the mobile change. For older API responses without a type, selecting
a category supplies its icon to pins and clusters. Under All, untyped pins keep
a neutral fallback. Explicit server categories always take precedence.
No new native dependency is required.
Facility labels appear at close zoom to avoid overlapping names.
Tapping a single marker zooms to it; clusters zoom in and offer member selection,
which also centres the map. The scrollable detail sheet leaves more map visible.
Applying a category (including All, even when already selected) or other filters
restores the viewport from before the first facility/group selection. Without
a saved selection viewport it returns to the Bulgaria overview.
The list has “Само моят регион”, using the region slug already saved in the
account, without GPS or a required settlement. It preserves other filters.
“Всички региони” clears this list-only override and restores the original
region filter, if any. Missing account regions show a profile-settings link.
The map query is unaffected. Facilities without an assigned region do not
match the regional filter.
Dashed marker borders indicate approximate locations; status colours retain
their meaning. Approximate facility summaries replace the UNVERIFIED status
row and repeated accuracy/source warnings with one highlighted notice:
“Приблизително място”, not the exact facility or delivery entrance.
Planned/closed/inactive statuses and detailed claim verification remain visible.
Facility summaries hide empty operator/contact/address rows, unknown capability
values and missing verification dates. Contact verification is shown only when
contact details exist. Known true and false capabilities retain their claim
status. This is display-only; stored data and approximate warnings are unchanged.
The full detail page also hides missing numeric capacities, descriptions,
contact fields, source references and dates, and empty Contact/Source sections.
Zero capacities remain visible; capacity/contact verification appears only
alongside supplied data. Approximate coordinate rows are explicitly labelled.
The app only reads administrator-published records; it does not invent or hardcode
facilities. No trading-offer or agricultural-field map layers are added.

Filters cover district, municipality, settlement, facility type, verified status,
rail/freight/grain capabilities and last verification date. Capability filters
require verified yes/no; unknown is not false. The map does not request location
permission or track the user's position. The shared backend radius API remains
available, but is not used by this screen.
Settlement search is textual, not geocoding. Stored agricultural-field search
is not available because there is no field module.

`react-native-maps` uses **Apple Maps on iOS**, without an application map key,
and **Google Maps on Android**. Native provider attribution remains visible.
For Android set `GOOGLE_MAPS_ANDROID_API_KEY` in the build environment, enable
Maps SDK for Android, and restrict the key to the app package and its signing
certificate SHA-1. `app.config.ts` passes the key to the native config plugin;
only a configured/not-configured flag is included in Expo `extra`.
The key is public in the native application by design. Without it Android shows
the list and an explicit setup notice instead of mounting an unconfigured map.
No credentials were added to `.env`. The old native MapTiler key is no longer used;
the portal's web MapLibre/MapTiler integration is unchanged.

Dense markers are grouped in viewport-scaled geographic cells without dropping
facilities. Tapping a group zooms and offers all its members for selection,
including facilities with identical coordinates. Facility-data failures show a
compact retry notice over the base map, not a blank full-screen error or invented
markers. The base map is independent of the Logistics API.
Listings use a virtualized FlatList (25 per page). Map markers use all matching
records in the current bbox, not just the list page; server safety limits return
an explicit narrow-search message rather than silently dropping points.

The new endpoints require the updated portal deployment and the Phase 1 Logistics
migration before use. The public schemas are identical in `src/api/schemas.ts`
and the portal's `lib/api/schemas.ts`. Queries use the existing bearer-auth API
client, cancel superseded requests and refresh every minute while mounted.
Logistics responses/coordinate-bearing query keys are **not persisted to disk**.
In-memory stale/offline data is labelled; confirm current conditions with the operator.

**A new Android/iOS native build is mandatory**: `react-native-maps` replaces the
previous MapLibre/location native modules. The already-installed binary
will not gain these screens until rebuilt and installed; do not send this change
as an OTA update to a binary without the modules.
Use a development build or EAS (`npx eas-cli@latest build --platform android
--profile production`, and the corresponding iOS command). No cloud build,
deployment, migration or real facility import is performed by adding these screens.

### Accounts

AP-06 fertilizer-report alerts use the existing price-update notification type,
in-app history and Expo push. The portal compares administrator-verified report
prices only (Urea, Ammonium Nitrate, DAP, NPK), with per-category thresholds
defaulting to 3%. Existing notification/push preferences apply. Report prices stay
separate from AgroGrain offers. Optional reviewed AI explanations do not trigger
alerts; prices alone determine eligibility. No new native module or mobile schema
change is required. Deploy the portal report-alert migration before using imports.

AP-07 adds optional crop-specific quality to farmer listings and trader crop
offers. Sunflower, rapeseed and flaxseed use oil content and impurities;
chickpeas use protein and moisture; coriander uses impurities. Malting barley
has no enabled measurements until management confirms its quality parameters;
forms show a pending-confirmation notice instead.
All values are percentages from 0 to 100, including zero. No quality grades are
calculated. Changing crops clears entered measurements; wheat's existing sample
fields remain unchanged. Old API responses and offline records without quality
are supported. The portal's crop-quality migration must precede deployment of its
updated API; the app itself makes no database changes.

AP-03 adds `barley-malting` (Ечемик пивоварен) as a distinct catalogue crop,
separate from feed barley. Trading selectors receive it from the portal catalogue
even without market quotes. Grain filters, crop details and market summaries use
its own published port quotes when available; no price or history is invented.
Deploy the portal's `20261031153000_malting_barley` migration first. Agricultural
field create/edit integration is deferred because neither project has that module.

Market and home crop prices are manually entered Varna/Burgas port quotes only.
Market category tabs without published crop offers are hidden. If no crop offers
exist, the market shows a single empty state without category tabs.
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

### iOS simulator: missing native modules or push entitlement

`Cannot find native module` means the installed binary does not
include a module used by the current JavaScript bundle. Restarting Metro cannot add it. After changing native
dependencies or config plugins, refresh the generated iOS configuration and rebuild:

```sh
npx expo prebuild --platform ios --no-install
npx expo run:ios
```

If Metro is already running for this project, use `npx expo run:ios --no-bundler`.
Use config plugins rather than editing generated native files. The map overview
does not require foreground location permissions.

`no valid aps-environment entitlement` means the running binary lacks the APNs
entitlement; notification permission alone does not supply it. The notifications
plugin configures the entitlement for a new build. Rebuild and install that binary.
For a physical iPhone signed with a free Personal Team, set `IOS_PERSONAL_TEAM=1`
consistently when generating/building native code and starting Metro; that mode
intentionally removes unsupported entitlements and disables remote push.
Paid-team physical-device builds also require matching APNs credentials and signing.
Do not send these native dependency changes as an OTA update to an older binary.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server with the QR code |
| `npm test` | Jest unit and component tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` |
| `npm run check:contract` | Validates a running portal against this app's schemas. Set `API_URL`, `CHECK_EMAIL`, `CHECK_PASSWORD`. Also checks the schema copy is byte-identical to the portal's. |

## Layout

AI market analysis selects one favourite-first crop, compares same-date Varna/
Burgas port prices and labels the spread separately from daily changes.
Missing ports or mismatched dates are not compared. Crop-mentioned news is
context only; commentary is requested explicitly using the existing insight API.
No historical port trend is fabricated. Detailed prices/alerts and crop-specific
chat remain linked. Source and price dates stay visible.

The AI landing page has an explicit chat action, a 2x2 tool grid, one weather
insight and three expandable example questions. Profile region and weather
retrieval freshness are explicit; demo weather suppresses work recommendations.
Temporary weather browsing does not change AI context. Chat errors are separate
notices, never assistant turns; retry resends the same question without duplication,
or “Промени въпроса” restores it for editing. Requests are guarded against double
submission. Conversations remain screen-local; persistence/streaming are not added.

Weather offers a temporary oblast selector for forecasts and statistics together.
It never edits the profile; “Регион от профила” restores the default.
Selections last while the weather screen remains mounted. Data represents the
oblast's configured weather point, not individual town/village measurements.
The portal must support `GET /api/v1/weather?region=<slug>`. Queries are cached
separately per region and never display another region's previous payload.

The farmer homepage previews three favourite-first market prices and three
trader offers, prioritizing the saved account region without filtering out
other regions. Offer location is shown when available. Weather previews rain
and wind; humidity remains on the weather screen. The daily overview previews
one risk/tip/news insight, not repeated weather/prices, with full details linked.
Empty offers show an explicit empty state. Trader dashboards are unchanged.
Farmer market and offer previews end with full-width, explicit destination
buttons (“Виж всички пазарни цени” and “Отвори борсата”), rather than small
section-header links. The exchange action remains available for empty offers.
The daily insight uses one tinted card with a topic badge, inset content and
a full-width “Отвори дневния обзор” action. Without a non-repeating insight,
it explains the linked overview rather than showing an empty content area.

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
