import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/api/client";
import {
  authResultSchema,
  chatReplySchema,
  cropDetailSchema,
  cropInsightSchema,
  dailySummarySchema,
  homeSchema,
  listingDetailSchema,
  marketResponseSchema,
  meSchema,
  newsArticleSchema,
  newsListSchema,
  notificationPrefsSchema,
  notificationsSchema,
  offerDetailSchema,
  regionsSchema,
  tradeResponseSchema,
  versionSchema,
  weatherResponseSchema,
  weeklyBriefingSchema,
} from "@/api/schemas";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long a persisted answer stays usable offline. Must outlive every staleTime. */
export const CACHE_MAX_AGE = 7 * DAY;

export const keys = {
  version: ["version"] as const,
  me: ["me"] as const,
  home: ["home"] as const,
  weather: ["weather"] as const,
  market: ["market"] as const,
  crop: (slug: string) => ["crop", slug] as const,
  cropInsight: (slug: string) => ["crop", slug, "insight"] as const,
  news: (category: string | null) => ["news", category ?? "all"] as const,
  article: (slug: string) => ["article", slug] as const,
  trade: ["trade"] as const,
  offer: (id: string) => ["offer", id] as const,
  listing: (id: string) => ["listing", id] as const,
  notifications: ["notifications"] as const,
  regions: ["regions"] as const,
  daily: ["briefing", "daily"] as const,
  weekly: ["briefing", "weekly"] as const,
};

/** The AI briefings are cached per day on the server, so they expire at midnight. */
function untilMidnight() {
  const next = new Date();
  next.setHours(24, 0, 0, 0);
  return Math.max(MINUTE, next.getTime() - Date.now());
}

const ok = z.object({}).passthrough();

/* ------------------------------------------------------------------ reads */

export const useVersion = () =>
  useQuery({
    queryKey: keys.version,
    queryFn: ({ signal }) => api("/version", { schema: versionSchema, auth: false, signal }),
    staleTime: HOUR,
  });

export const useMe = () =>
  useQuery({
    queryKey: keys.me,
    queryFn: ({ signal }) => api("/me", { schema: meSchema, signal }),
    staleTime: 5 * MINUTE,
  });

export const useHome = () =>
  useQuery({
    queryKey: keys.home,
    queryFn: ({ signal }) => api("/home", { schema: homeSchema, signal }),
    staleTime: 15 * MINUTE,
  });

export const useWeather = () =>
  useQuery({
    queryKey: keys.weather,
    queryFn: ({ signal }) => api("/weather", { schema: weatherResponseSchema, signal }),
    staleTime: 15 * MINUTE,
  });

export const useMarket = () =>
  useQuery({
    queryKey: keys.market,
    queryFn: ({ signal }) => api("/market", { schema: marketResponseSchema, signal }),
    staleTime: 30 * MINUTE,
  });

export const useCrop = (slug: string) =>
  useQuery({
    queryKey: keys.crop(slug),
    queryFn: ({ signal }) =>
      api(`/market/${encodeURIComponent(slug)}`, { schema: cropDetailSchema, signal }),
    staleTime: 30 * MINUTE,
  });

/** The model-written commentary is slow, so it loads after the rest of the screen. */
export const useCropInsight = (slug: string) =>
  useQuery({
    queryKey: keys.cropInsight(slug),
    queryFn: ({ signal }) =>
      api(`/market/${encodeURIComponent(slug)}/insight`, { schema: cropInsightSchema, signal }),
    staleTime: untilMidnight(),
  });

export const useNews = (category: string | null = null) =>
  useQuery({
    queryKey: keys.news(category),
    queryFn: ({ signal }) =>
      api(`/news${category ? `?category=${category}` : ""}`, { schema: newsListSchema, signal }),
    staleTime: HOUR,
  });

export const useArticle = (slug: string) =>
  useQuery({
    queryKey: keys.article(slug),
    queryFn: ({ signal }) =>
      api(`/news/${encodeURIComponent(slug)}`, { schema: newsArticleSchema, signal }),
    staleTime: HOUR,
  });

export const useTrade = () =>
  useQuery({
    queryKey: keys.trade,
    queryFn: ({ signal }) => api("/trade", { schema: tradeResponseSchema, signal }),
    staleTime: 5 * MINUTE,
  });

export const useOffer = (id: string) =>
  useQuery({
    queryKey: keys.offer(id),
    queryFn: ({ signal }) =>
      api(`/trade/offers/${encodeURIComponent(id)}`, { schema: offerDetailSchema, signal }),
    staleTime: 5 * MINUTE,
  });

export const useListing = (id: string) =>
  useQuery({
    queryKey: keys.listing(id),
    queryFn: ({ signal }) =>
      api(`/trade/listings/${encodeURIComponent(id)}`, { schema: listingDetailSchema, signal }),
    staleTime: 5 * MINUTE,
  });

export const useNotifications = () =>
  useQuery({
    queryKey: keys.notifications,
    queryFn: ({ signal }) => api("/notifications", { schema: notificationsSchema, signal }),
    staleTime: 2 * MINUTE,
  });

export const useRegions = () =>
  useQuery({
    queryKey: keys.regions,
    queryFn: ({ signal }) => api("/regions", { schema: regionsSchema, auth: false, signal }),
    staleTime: 7 * DAY,
  });

export const useDailyBriefing = () =>
  useQuery({
    queryKey: keys.daily,
    queryFn: ({ signal }) => api("/ai/briefing/daily", { schema: dailySummarySchema, signal }),
    staleTime: untilMidnight(),
  });

export const useWeeklyBriefing = () =>
  useQuery({
    queryKey: keys.weekly,
    queryFn: ({ signal }) => api("/ai/briefing/weekly", { schema: weeklyBriefingSchema, signal }),
    staleTime: untilMidnight(),
  });

/* -------------------------------------------------------------- mutations */

/** Refreshes everything a trade change can affect, including the home summary. */
function invalidateTrade(client: QueryClient) {
  void client.invalidateQueries({ queryKey: keys.trade });
  void client.invalidateQueries({ queryKey: keys.home });
}

function useInvalidating<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  invalidate: (client: QueryClient, data: TData) => void,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => invalidate(client, data),
  });
}

export type ProfileInput = {
  name: string;
  farmName: string;
  phone: string;
  phoneCode: string;
};

export const useUpdateProfile = () =>
  useInvalidating(
    (input: ProfileInput) => api("/me", { method: "PATCH", body: input, schema: meSchema }),
    (client, me) => {
      client.setQueryData(keys.me, me);
      void client.invalidateQueries({ queryKey: keys.home });
    },
  );

export const useUpdateRegion = () =>
  useInvalidating(
    (input: { regionSlug: string; settlement: string }) =>
      api("/me/region", { method: "PATCH", body: input, schema: meSchema }),
    (client, me) => {
      client.setQueryData(keys.me, me);
      // Region drives the weather, the briefings and the home summary.
      for (const key of [keys.home, keys.weather, keys.daily, keys.weekly]) {
        void client.invalidateQueries({ queryKey: key });
      }
    },
  );

export const useUpdatePrefs = () =>
  useInvalidating(
    (input: Partial<z.infer<typeof notificationPrefsSchema>>) =>
      api("/me/notification-prefs", {
        method: "PATCH",
        body: input,
        schema: notificationPrefsSchema,
      }),
    (client) => void client.invalidateQueries({ queryKey: keys.me }),
  );

/** Returns a fresh session: every other device is signed out, as on the web. */
export const changePassword = (input: { current: string; password: string; confirm: string }) =>
  api("/me/password", { method: "POST", body: input, schema: authResultSchema });

/** Tells the portal which phone to send alerts to. */
export const registerPushToken = (token: string) =>
  api("/me/push-token", { method: "POST", body: { token }, schema: ok });

export const removePushToken = (token: string) =>
  api("/me/push-token", { method: "DELETE", body: { token }, schema: ok });

/** Permanently deletes the account after re-checking the password. */
export const deleteAccount = (input: { password: string }) =>
  api("/me", { method: "DELETE", body: input, schema: ok });

export type OfferInput = {
  category: "CROP" | "FERTILIZER" | "SEED";
  title: string;
  price: string;
  unit: string;
  note: string;
  validUntil: string;
};

export const useCreateOffer = () =>
  useInvalidating(
    (input: OfferInput) =>
      api("/trade/offers", { method: "POST", body: input, schema: ok }),
    (client) => invalidateTrade(client),
  );

export const useToggleOffer = () =>
  useInvalidating(
    (input: { id: string; isActive: boolean }) =>
      api(`/trade/offers/${input.id}`, {
        method: "PATCH",
        body: { isActive: input.isActive },
        schema: ok,
      }),
    (client) => invalidateTrade(client),
  );

export const useDeleteOffer = () =>
  useInvalidating(
    (id: string) => api(`/trade/offers/${id}`, { method: "DELETE", schema: ok }),
    (client) => invalidateTrade(client),
  );

export type ListingInput = {
  title: string;
  quantityT: string;
  askPrice: string;
  unit: string;
  note: string;
  hectolitre: string;
  protein: string;
  gluten: string;
};

export const useCreateListing = () =>
  useInvalidating(
    (input: ListingInput) =>
      api("/trade/listings", { method: "POST", body: input, schema: ok }),
    (client) => invalidateTrade(client),
  );

export const useSetListingStatus = () =>
  useInvalidating(
    (input: { id: string; status: "OPEN" | "RESERVED" | "CLOSED" }) =>
      api(`/trade/listings/${input.id}`, {
        method: "PATCH",
        body: { status: input.status },
        schema: ok,
      }),
    (client) => invalidateTrade(client),
  );

export const useDeleteListing = () =>
  useInvalidating(
    (id: string) => api(`/trade/listings/${id}`, { method: "DELETE", schema: ok }),
    (client) => invalidateTrade(client),
  );

export const useMarkAllRead = () =>
  useInvalidating(
    () => api("/notifications/read-all", { method: "POST", schema: ok }),
    (client) => {
      void client.invalidateQueries({ queryKey: keys.notifications });
      void client.invalidateQueries({ queryKey: keys.me });
    },
  );

export const useMarkRead = () =>
  useInvalidating(
    (id: string) => api(`/notifications/${id}/read`, { method: "POST", schema: ok }),
    (client) => {
      void client.invalidateQueries({ queryKey: keys.notifications });
      void client.invalidateQueries({ queryKey: keys.me });
    },
  );

export const useClearNotifications = () =>
  useInvalidating(
    () => api("/notifications", { method: "DELETE", schema: ok }),
    (client) => {
      void client.invalidateQueries({ queryKey: keys.notifications });
      void client.invalidateQueries({ queryKey: keys.me });
    },
  );

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** One assistant turn. Not cached: a conversation is not server state. */
export const sendChat = (messages: ChatTurn[]) =>
  api("/ai/chat", { method: "POST", body: { messages }, schema: chatReplySchema });
