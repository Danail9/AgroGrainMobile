import { z } from "zod";

/**
 * The wire contract of `/api/v1`: one Zod schema per response, describing what
 * the client actually receives after `serialize()` has turned every Date into
 * an ISO-8601 string.
 *
 * This file is the source of truth. It is copied verbatim to
 * `AgroMobile/src/api/schemas.ts`; `npm run check:contract` in AgroMobile
 * validates live responses against that copy, and `tests/contract.test.ts`
 * here validates the serializers against this one, so a change made on one
 * side only fails CI.
 *
 * It has no imports other than `zod`, so it is safe to copy anywhere.
 */

export const isoDate = z.iso.datetime();

/* ---------------------------------------------------------------- account */

export const roleSchema = z.enum(["FARMER", "TRADER", "ADMIN"]);

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  farmName: z.string().nullable(),
  phone: z.string().nullable(),
  role: roleSchema,
  regionSlug: z.string(),
  regionName: z.string(),
  settlement: z.string().nullable(),
});

export const subscriptionSchema = z.object({
  active: z.boolean(),
  canTrade: z.boolean(),
  exempt: z.boolean(),
  freeAccess: z.boolean(),
  status: z.enum(["NONE", "INCOMPLETE", "ACTIVE", "PAST_DUE", "CANCELED"]),
  interval: z.enum(["MONTH", "YEAR"]).nullable(),
  tier: z.enum(["BASE", "TRADER"]).nullable(),
  currentPeriodEnd: isoDate.nullable(),
  cancelAtPeriodEnd: z.boolean(),
});

export const scheduledChangeSchema = z.object({
  interval: z.enum(["MONTH", "YEAR"]),
  tier: z.enum(["BASE", "TRADER"]),
  effectiveAt: isoDate,
});

export const checkoutSchema = z.object({
  setupIntentClientSecret: z.string().optional(),
  setupIntentId: z.string().optional(),
  immediateUpgrade: z.boolean().optional(),
  /** Null for a scheduled change: no payment is collected now. */
  paymentIntentClientSecret: z.string().nullable(),
  scheduledChange: scheduledChangeSchema.nullable().optional(),
});

export const plansSchema = z.object({
  supportsImmediateUpgrades: z.boolean().optional(),
  supportsScheduledChanges: z.boolean().optional(),
  scheduledChange: scheduledChangeSchema.nullable().optional(),
  /** The tier that matches the account type; the screen highlights it. */
  recommendedTier: z.enum(["BASE", "TRADER"]),
  current: z
    .object({
      interval: z.enum(["MONTH", "YEAR"]),
      tier: z.enum(["BASE", "TRADER"]),
      currentPeriodEnd: isoDate.nullable(),
      cancelAtPeriodEnd: z.boolean(),
      managedByAdmin: z.boolean(),
    })
    .nullable(),
  plans: z.array(
    z.object({
      interval: z.enum(["MONTH", "YEAR"]),
      tier: z.enum(["BASE", "TRADER"]),
      name: z.string(),
      priceCents: z.number().int(),
      suffix: z.string(),
      savingCents: z.number().int().nullable(),
      features: z.array(z.string()),
      tradeFeatures: z.array(z.string()),
    }),
  ),
});

export const notificationPrefsSchema = z.object({
  enabled: z.boolean(),
  newOffer: z.boolean(),
  newListing: z.boolean(),
  subscriptionUpgrade: z.boolean(),
  subscriptionReminder: z.boolean(),
  priceMove: z.boolean(),
  priceThreshold: z.number(),
  heavyRain: z.boolean(),
  frost: z.boolean(),
  strongWind: z.boolean(),
  goodFieldWork: z.boolean(),
  push: z.boolean(),
});

export const meSchema = z.object({
  user: publicUserSchema,
  subscription: subscriptionSchema,
  unreadCount: z.number().int(),
  notificationPrefs: notificationPrefsSchema,
  flags: z.object({
    freeAccessEnabled: z.boolean(),
    freeAccessTrade: z.boolean(),
  }),
});

export const authResultSchema = z.object({
  token: z.string(),
  expiresAt: isoDate,
  user: publicUserSchema,
});

export const refreshResultSchema = z.object({
  token: z.string(),
  expiresAt: isoDate,
});

export const regionsSchema = z.object({
  regions: z.array(z.object({ slug: z.string(), name: z.string() })),
  settlements: z.array(z.object({ label: z.string(), regionSlug: z.string() })),
});

export const versionSchema = z.object({
  minSupportedAppVersion: z.string(),
  latestAppVersion: z.string(),
  apiVersion: z.number().int(),
});

/* ---------------------------------------------------------------- weather */

export const weatherIconSchema = z.enum([
  "sun",
  "cloud-sun",
  "cloud",
  "rain",
  "storm",
  "snow",
  "fog",
]);

export const weatherConditionSchema = z.object({
  code: z.number(),
  label: z.string(),
  icon: weatherIconSchema,
});

export const currentWeatherSchema = z.object({
  temperature: z.number(),
  apparentTemperature: z.number(),
  humidity: z.number(),
  windSpeed: z.number(),
  precipitation: z.number(),
  uvIndex: z.number(),
  isDay: z.boolean(),
  condition: weatherConditionSchema,
  soilTemperature: z.number(),
  soilMoisture: z.number(),
  dewPoint: z.number(),
});

export const hourlyEntrySchema = z.object({
  time: isoDate,
  temperature: z.number(),
  precipitationProbability: z.number(),
  windSpeed: z.number(),
  condition: weatherConditionSchema,
});

export const dailyEntrySchema = z.object({
  date: isoDate,
  min: z.number(),
  max: z.number(),
  precipitationProbability: z.number(),
  windMax: z.number(),
  uvIndex: z.number(),
  condition: weatherConditionSchema,
  precipitationSum: z.number(),
  et0: z.number(),
  sunrise: isoDate,
  sunset: isoDate,
});

export const weatherDataSchema = z.object({
  regionSlug: z.string(),
  regionName: z.string(),
  current: currentWeatherSchema,
  hourly: z.array(hourlyEntrySchema),
  daily: z.array(dailyEntrySchema),
  updatedAt: isoDate,
  /** True when the portal could not reach Open-Meteo and substituted a demo forecast. */
  isFallback: z.boolean(),
});

export const fieldWorkWindowSchema = z.object({
  date: isoDate,
  score: z.number(),
  level: z.enum(["good", "medium", "bad"]),
  label: z.string(),
  reason: z.string(),
});

export const sprayWindowSchema = z
  .object({ from: isoDate, to: isoDate })
  .nullable();

const yearStatsSchema = z.object({
  year: z.number().int(),
  days: z.number().int(),
  avgTemp: z.number().nullable(),
  maxTemp: z.number().nullable(),
  minTemp: z.number().nullable(),
  precipitation: z.number(),
  rainDays: z.number().int(),
});

const monthSummarySchema = z.object({
  precipitation: z.number(),
  avgTemp: z.number().nullable(),
  days: z.number().int(),
});

export const weatherHistorySchema = z.object({
  through: isoDate,
  periods: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      from: isoDate,
      to: isoDate,
      current: yearStatsSchema,
      previous: yearStatsSchema,
    }),
  ),
  months: z.array(
    z.object({
      month: z.number().int(),
      label: z.string(),
      current: monthSummarySchema,
      previous: monthSummarySchema,
    }),
  ),
});

export const weatherResponseSchema = z.object({
  weather: weatherDataSchema,
  fieldWork: z.array(fieldWorkWindowSchema),
  sprayWindow: sprayWindowSchema,
  history: weatherHistorySchema,
});

/* ----------------------------------------------------------------- market */

export const cropCategorySchema = z.enum([
  "GRAIN",
  "OILSEED",
  "OTHER",
  "PROCESSED",
]);

export const priceRowSchema = z.object({
  slug: z.string(),
  name: z.string(),
  emoji: z.string(),
  category: cropCategorySchema,
  unit: z.string(),
  price: z.number(),
  changePct: z.number().nullable(),
  sortIdx: z.number(),
  date: isoDate,
  source: z.string().nullish(),
  overridden: z.boolean().nullish(),
});

export const fertilizerSchema = z.object({
  slug: z.string(),
  name: z.string(),
  category: z.enum(["nitrogen", "phosphorus", "potassium", "npk"]),
  nutrient: z.string(),
  tier: z.enum(["cheap", "medium", "expensive"]),
  price: z.number(),
  changePct: z.number().nullable(),
  source: z.string(),
});

export const newsCategorySchema = z.enum(["TOP", "BULGARIA", "EU", "MARKET"]);

export const newsListItemSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  category: newsCategorySchema,
  source: z.string(),
  imageUrl: z.string().nullable(),
  publishedAt: isoDate,
});

export const newsArticleSchema = newsListItemSchema.extend({ body: z.string() });

export const newsListSchema = z.object({ items: z.array(newsListItemSchema) });

export const marketResponseSchema = z.object({
  prices: z.array(priceRowSchema),
  fertilizers: z.array(fertilizerSchema),
  news: z.array(newsListItemSchema),
});

export const cropDetailSchema = z.object({
  crop: priceRowSchema,
  history: z.array(z.object({ date: isoDate, price: z.number() })),
  related: z.array(priceRowSchema),
  analysis: z.object({
    headline: z.string(),
    points: z.array(
      z.object({
        icon: z.enum(["trend", "range", "tip"]),
        text: z.string(),
      }),
    ),
  }),
});

export const cropInsightSchema = z.object({
  content: z.string(),
  source: z.string(),
});

/* --------------------------------------------------------------------- ai */

export const briefingSectionSchema = z.object({
  icon: z.enum(["weather", "market", "news", "field", "risk", "tip"]),
  title: z.string(),
  body: z.string(),
});

export const dailySummarySchema = z.object({
  title: z.string(),
  highlight: z.string(),
  sections: z.array(briefingSectionSchema),
  source: z.enum(["openai", "offline"]),
  generatedAt: isoDate,
});

export const weeklyBriefingSchema = z.object({
  title: z.string(),
  highlight: z.string(),
  sections: z.array(briefingSectionSchema),
  periodStart: isoDate,
  periodEnd: isoDate,
});

export const chatReplySchema = z.object({
  content: z.string(),
  source: z.string(),
});

/* ------------------------------------------------------------------ trade */

export const offerCategorySchema = z.enum(["CROP", "FERTILIZER", "SEED"]);
export const listingStatusSchema = z.enum(["OPEN", "RESERVED", "CLOSED"]);

export const traderOfferSchema = z.object({
  id: z.string(),
  category: offerCategorySchema,
  title: z.string(),
  price: z.number(),
  unit: z.string(),
  regionSlug: z.string().nullable(),
  note: z.string().nullable(),
  validUntil: isoDate.nullable(),
  isActive: z.boolean(),
  createdAt: isoDate,
  trader: z.object({ name: z.string(), farmName: z.string().nullable() }),
});

export const farmerListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  quantityT: z.number(),
  askPrice: z.number().nullable(),
  unit: z.string(),
  regionSlug: z.string(),
  note: z.string().nullable(),
  status: listingStatusSchema,
  hectolitre: z.number().nullable(),
  protein: z.number().nullable(),
  gluten: z.number().nullable(),
  createdAt: isoDate,
  /** Null unless the viewer is a trader or admin; masked server-side. */
  farmer: z
    .object({
      name: z.string(),
      farmName: z.string().nullable(),
      number: z.number(),
      phone: z.string().nullable(),
    })
    .nullable(),
});

const catalogOptionSchema = z.object({
  slug: z.string(),
  name: z.string(),
  emoji: z.string().optional(),
});

export const tradeResponseSchema = z.object({
  role: roleSchema,
  canPublishOffers: z.boolean(),
  canPublishListings: z.boolean(),
  offers: z.array(traderOfferSchema),
  listings: z.array(farmerListingSchema),
  myOffers: z.array(traderOfferSchema),
  myListings: z.array(farmerListingSchema),
  cropOptions: z.array(catalogOptionSchema),
  fertilizerOptions: z.array(catalogOptionSchema),
});

export const offerDetailSchema = z.object({
  id: z.string(),
  category: offerCategorySchema,
  title: z.string(),
  price: z.number(),
  unit: z.string(),
  regionSlug: z.string().nullable(),
  note: z.string().nullable(),
  validUntil: isoDate.nullable(),
  createdAt: isoDate,
  isActive: z.boolean(),
  isOwner: z.boolean(),
  trader: z.object({
    name: z.string(),
    farmName: z.string().nullable(),
    number: z.number(),
    phone: z.string().nullable(),
  }),
});

export const listingDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  quantityT: z.number(),
  askPrice: z.number().nullable(),
  unit: z.string(),
  regionSlug: z.string(),
  note: z.string().nullable(),
  status: listingStatusSchema,
  hectolitre: z.number().nullable(),
  protein: z.number().nullable(),
  gluten: z.number().nullable(),
  createdAt: isoDate,
  isOwner: z.boolean(),
  farmer: z.object({
    name: z.string(),
    farmName: z.string().nullable(),
    number: z.number(),
    phone: z.string().nullable(),
  }),
});

/* ------------------------------------------------------------------- home */

export const farmerHomeSchema = z.object({
  role: z.literal("FARMER"),
  regionName: z.string(),
  weather: z.object({
    current: currentWeatherSchema,
    today: dailyEntrySchema.nullable(),
    fieldWork: fieldWorkWindowSchema.nullable(),
    updatedAt: isoDate,
    isFallback: z.boolean(),
  }),
  prices: z.array(priceRowSchema),
  summary: dailySummarySchema,
  offers: z.array(traderOfferSchema),
  unreadCount: z.number().int(),
});

export const traderHomeSchema = z.object({
  role: z.literal("TRADER"),
  regionName: z.string(),
  stats: z.object({
    activeOffers: z.number().int(),
    openListings: z.number().int(),
    totalTonnage: z.number(),
  }),
  latestListings: z.array(farmerListingSchema),
  prices: z.array(priceRowSchema),
  unreadCount: z.number().int(),
});

export const adminHomeSchema = z.object({ role: z.literal("ADMIN") });

export const homeSchema = z.discriminatedUnion("role", [
  farmerHomeSchema,
  traderHomeSchema,
  adminHomeSchema,
]);

/* ---------------------------------------------------------- notifications */

export const notificationTypeSchema = z.enum([
  "SUBSCRIPTION_UPGRADED",
  "SUBSCRIPTION_REMINDER",
  "PRICE_MOVE",
  "HEAVY_RAIN",
  "FROST",
  "STRONG_WIND",
  "GOOD_FIELD_WORK",
  "NEW_LISTING",
  "NEW_OFFER",
]);

export const notificationsSchema = z.object({
  unreadCount: z.number().int(),
  items: z.array(
    z.object({
      id: z.string(),
      type: notificationTypeSchema,
      title: z.string(),
      body: z.string(),
      url: z.string().nullable(),
      readAt: isoDate.nullable(),
      createdAt: isoDate,
    }),
  ),
});

/* ---------------------------------------------------------------- envelope */

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      "unauthorized",
      "validation_failed",
      "subscription_inactive",
      "trade_access",
      "forbidden",
      "not_found",
      "conflict",
      "device_in_use",
      "login_locked",
      "rate_limited",
      "server_error",
    ]),
    message: z.string(),
    field: z.string().optional(),
    otherDevice: z.string().optional(),
    retryAfter: z.number().optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
export type Me = z.infer<typeof meSchema>;
export type AuthResult = z.infer<typeof authResultSchema>;
export type WeatherResponse = z.infer<typeof weatherResponseSchema>;
export type PriceRow = z.infer<typeof priceRowSchema>;
export type Home = z.infer<typeof homeSchema>;
