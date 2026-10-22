/**
 * A record of every scheduled-job run, quiet days included, in cron_runs.
 *
 * The daily COGS check writes a snapshot only when a SKU moved, so on a quiet
 * day it left nothing behind and "did it fire?" could only be answered from
 * Vercel's logs, which keep about a day (12 Oct 2026). One row per run fixes
 * that, and the movement page shows the last one.
 */

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { cronRuns, type CronRun } from "@/db/schema";

export const COGS_CHECK_JOB = "cogs-snapshot";
export const INVOICE_CHECK_JOB = "invoice-check";

/**
 * Record one run. Never throws: a failure to write the record is logged and
 * must not fail the job it describes.
 */
export async function recordCronRun(run: {
  job: string;
  ok: boolean;
  checked?: number;
  written?: number;
  error?: string;
}): Promise<void> {
  try {
    await db.insert(cronRuns).values({
      job: run.job,
      ok: run.ok,
      checked: run.checked ?? null,
      written: run.written ?? null,
      error: run.error ?? null,
    });
  } catch (err) {
    console.error(`[cron-runs] could not record a run of "${run.job}"`, err);
  }
}

/** The newest run of a job, and the newest that succeeded, or null for either if none. */
export async function lastCronRuns(job: string): Promise<{ last: CronRun | null; lastOk: CronRun | null }> {
  try {
    const [[last], [lastOk]] = await Promise.all([
      db.select().from(cronRuns).where(eq(cronRuns.job, job)).orderBy(desc(cronRuns.ranAt)).limit(1),
      db
        .select()
        .from(cronRuns)
        .where(and(eq(cronRuns.job, job), eq(cronRuns.ok, true)))
        .orderBy(desc(cronRuns.ranAt))
        .limit(1),
    ]);
    return { last: last ?? null, lastOk: lastOk ?? null };
  } catch (err) {
    // Before migration 0021 is applied the table does not exist; the page
    // should still render.
    console.error(`[cron-runs] could not read runs of "${job}"`, err);
    return { last: null, lastOk: null };
  }
}
