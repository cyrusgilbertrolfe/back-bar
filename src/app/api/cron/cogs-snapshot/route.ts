import { recordCogsSnapshots } from "@/lib/erp/cogs-movement";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The daily COGS check (vercel.json crons). Saves in the app snapshot COGS as
 * they happen; this catches what they cannot see, chiefly the data scripts
 * run from the Mini, so a movement is never left unrecorded for more than a day.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. The password gate in
 * proxy.ts lets this path through, so the secret is the only lock, and
 * without it set the route refuses every call.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await recordCogsSnapshots("daily check");
  return Response.json(result);
}
