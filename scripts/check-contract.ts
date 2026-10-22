/**
 * Contract check: does a running AgroGrain portal still answer the way this
 * app expects?
 *
 *   1. If the portal source sits next to this repo (../app-web, or PORTAL_DIR), the schema copy in
 *      src/api/schemas.ts must be byte-identical to lib/api/schemas.ts there.
 *   2. Signs in with a real account and validates every GET endpoint's
 *      response against the schemas the app ships with.
 *
 * Usage:
 *   API_URL=http://localhost:3000 CHECK_EMAIL=your-account@example.com \
 *   CHECK_PASSWORD=your-password npm run check:contract
 *
 * Use an account with an active plan that can trade (a TRADER plan), or the
 * trade endpoints will be reported as skipped. Exit code 1 on any mismatch.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { z } from "zod";

import * as s from "../src/api/schemas";

const API = `${(process.env.API_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/api/v1`;
const EMAIL = process.env.CHECK_EMAIL;
const PASSWORD = process.env.CHECK_PASSWORD;

let failures = 0;
let skipped = 0;

function report(ok: boolean, name: string, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `  ${detail}` : ""}`);
}

function checkSchemaCopy() {
  const source = path.resolve(
    __dirname,
    process.env.PORTAL_DIR ?? "../../app-web",
    "lib/api/schemas.ts",
  );
  const copy = path.resolve(__dirname, "../src/api/schemas.ts");
  if (!existsSync(source)) {
    console.log("  --   schema copy: portal source not found next to this repo, skipped");
    return;
  }
  const same = readFileSync(source, "utf8") === readFileSync(copy, "utf8");
  report(same, "schema copy is identical to the portal's lib/api/schemas.ts", same ? "" : "(copy it again)");
}

async function call(pathname: string, token?: string, init?: RequestInit) {
  const response = await fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": "AgroMobile/check (iPhone)",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = (await response.json().catch(() => null)) as { data?: unknown; error?: { code: string } } | null;
  return { status: response.status, body };
}

async function check<T>(name: string, pathname: string, schema: z.ZodType<T>, token?: string) {
  const { status, body } = await call(pathname, token);

  if (status === 403 && body?.error?.code === "trade_access") {
    skipped += 1;
    console.log(`  --   ${name}: account has no exchange access, skipped`);
    return undefined;
  }
  if (status !== 200) {
    report(false, name, `HTTP ${status} ${body?.error?.code ?? ""}`);
    return undefined;
  }

  const parsed = schema.safeParse(body?.data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    report(false, name, `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    return undefined;
  }
  report(true, name);
  return parsed.data;
}

async function main() {
  console.log(`Contract check against ${API}\n`);
  checkSchemaCopy();

  await check("GET /version", "/version", s.versionSchema);
  await check("GET /regions", "/regions", s.regionsSchema);

  if (!EMAIL || !PASSWORD) {
    console.log("\nSet CHECK_EMAIL and CHECK_PASSWORD to check the authenticated endpoints.");
    process.exit(failures ? 1 : 0);
  }

  const login = await call("/auth/login", undefined, {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const auth = s.authResultSchema.safeParse(login.body?.data);
  if (!auth.success) {
    report(false, "POST /auth/login", `HTTP ${login.status} ${login.body?.error?.code ?? "bad response"}`);
    process.exit(1);
  }
  report(true, "POST /auth/login");
  const token = auth.data.token;

  await check("GET /me", "/me", s.meSchema, token);
  await check("GET /home", "/home", s.homeSchema, token);
  await check("GET /weather", "/weather", s.weatherResponseSchema, token);
  const market = await check("GET /market", "/market", s.marketResponseSchema, token);

  const crop = market?.prices[0]?.slug;
  if (crop) {
    await check(`GET /market/${crop}`, `/market/${crop}`, s.cropDetailSchema, token);
    await check(`GET /market/${crop}/insight`, `/market/${crop}/insight`, s.cropInsightSchema, token);
  }

  const news = await check("GET /news", "/news", s.newsListSchema, token);
  const article = news?.items[0]?.slug;
  if (article) await check(`GET /news/${article}`, `/news/${article}`, s.newsArticleSchema, token);

  const trade = await check("GET /trade", "/trade", s.tradeResponseSchema, token);
  const offer = trade?.offers[0]?.id;
  if (offer) await check("GET /trade/offers/:id", `/trade/offers/${offer}`, s.offerDetailSchema, token);
  const listing = [...(trade?.listings ?? []), ...(trade?.myListings ?? [])][0]?.id;
  if (listing) {
    await check("GET /trade/listings/:id", `/trade/listings/${listing}`, s.listingDetailSchema, token);
  }

  await check("GET /notifications", "/notifications", s.notificationsSchema, token);
  await check("GET /ai/briefing/daily", "/ai/briefing/daily", s.dailySummarySchema, token);
  await check("GET /ai/briefing/weekly", "/ai/briefing/weekly", s.weeklyBriefingSchema, token);

  // Leave no session behind on the account used for the check.
  await call("/auth/logout", token, { method: "POST" });

  console.log(`\n${failures ? `${failures} failed` : "all passed"}${skipped ? `, ${skipped} skipped` : ""}`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(`
Could not complete the check against ${API}: ${error instanceof Error ? error.message : error}`);
  console.error("Is the portal running (npm run dev in AgroGrain)?");
  process.exit(1);
});
