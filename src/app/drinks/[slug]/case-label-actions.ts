"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { skus } from "@/db/schema";

export type IdentityState = { error: string } | { saved: true } | null;

/** Client prefix, hyphen, four-letter mnemonic, optional size suffix: FM-APPR, FM-EDAQ-35. */
const SHORT_CODE = /^[A-Z]{2,4}-[A-Z]{4}(-\d{2,3})?$/;

const text = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

/**
 * Save how a client knows one of our SKUs. The short code is write-once: the
 * standard (Cyrus, 19 Sep 2026) is that a code is assigned once and never
 * changed or reused, because it is printed on boxes sitting in someone else's
 * warehouse and typed into their system.
 */
export async function saveSkuIdentity(
  drinkSlug: string,
  skuId: number,
  _prev: IdentityState,
  form: FormData,
): Promise<IdentityState> {
  const [sku] = await db.select().from(skus).where(eq(skus.id, skuId));
  if (!sku) return { error: "That SKU no longer exists." };

  const shortCode = text(form.get("shortCode"))?.toUpperCase() ?? null;
  const customerItemCode = text(form.get("customerItemCode"));
  const customerDescription = text(form.get("customerDescription"));
  const unitsRaw = text(form.get("unitsPerCase"));
  const unitsPerCase = unitsRaw === null ? null : Number(unitsRaw);

  if (sku.shortCode && shortCode !== sku.shortCode) {
    return { error: `The short code ${sku.shortCode} is permanent and cannot be changed.` };
  }
  if (shortCode && !SHORT_CODE.test(shortCode)) {
    return { error: "A short code is the client prefix, a hyphen and four capital letters, e.g. FM-APPR." };
  }
  if (unitsPerCase !== null && !(Number.isInteger(unitsPerCase) && unitsPerCase > 0)) {
    return { error: "Case quantity must be a whole number of bottles." };
  }
  if (shortCode && !sku.shortCode) {
    const [taken] = await db.select({ code: skus.code }).from(skus).where(eq(skus.shortCode, shortCode));
    if (taken) return { error: `${shortCode} is already ${taken.code}. Codes are never reused.` };
  }

  await db
    .update(skus)
    .set({ shortCode, customerItemCode, customerDescription, unitsPerCase, updatedAt: new Date() })
    .where(eq(skus.id, skuId));

  revalidatePath(`/drinks/${drinkSlug}`);
  return { saved: true };
}
