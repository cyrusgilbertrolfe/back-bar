"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { systemSettings, SETTING_KEYS } from "@/db/schema";
import { scheduleCogsSnapshot } from "@/lib/erp/cogs-movement";

function readStr(form: FormData, key: string): string {
  const raw = form.get(key);
  if (raw == null) return "";
  return String(raw).trim();
}

async function upsert(key: string, value: string) {
  await db
    .insert(systemSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function updateSettings(form: FormData) {
  // Wastage % entered as a percentage by humans (e.g. "2"); stored as decimal "0.02".
  const wastagePctRaw = readStr(form, "wastagePct");
  const wastagePctNum = Number(wastagePctRaw);
  if (!Number.isFinite(wastagePctNum) || wastagePctNum < 0 || wastagePctNum > 100) {
    throw new Error("Wastage must be a number between 0 and 100");
  }
  const wastagePct = (wastagePctNum / 100).toString();

  const labourRateRaw = readStr(form, "labourRate");
  const labourRateNum = Number(labourRateRaw);
  if (!Number.isFinite(labourRateNum) || labourRateNum < 0) {
    throw new Error("Labour rate must be a non-negative number");
  }
  const labourRate = labourRateNum.toFixed(2);

  const nextSerialRaw = readStr(form, "nextSerial");
  const nextSerialNum = Number.parseInt(nextSerialRaw, 10);
  if (!Number.isFinite(nextSerialNum) || nextSerialNum < 1) {
    throw new Error("Next serial number must be a positive integer");
  }

  await upsert(SETTING_KEYS.WASTAGE_PCT, wastagePct);
  await upsert(SETTING_KEYS.LABOUR_RATE_GBP_PER_HOUR, labourRate);
  await upsert(SETTING_KEYS.NEXT_SERIAL_NUMBER, String(nextSerialNum));

  scheduleCogsSnapshot("wastage setting");
  revalidatePath("/erp/settings");
  revalidatePath("/erp");
}
