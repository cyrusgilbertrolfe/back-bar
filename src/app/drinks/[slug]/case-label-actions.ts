"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { skus } from "@/db/schema";

export type IdentityState = { error: string } | { saved: true } | null;

/**
 * OWNER-DRINK-SIZE: four letters, four letters, four digits of ml, e.g.
 * MYFL-NEGR-0500, CRPS-NEGR-3000, FTNM-APPR-0500 (Cyrus, 20 Oct 2026).
 */
const SHORT_CODE = /^([A-Z]{4})-([A-Z]{4})-(\d{4})$/;

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
  const parts = shortCode ? SHORT_CODE.exec(shortCode) : null;
  if (shortCode && !parts) {
    return { error: "A short code is owner, drink and size in ml: four letters, four letters, four digits, e.g. MYFL-NEGR-0500." };
  }
  // The size as sold, which can differ a little from the bottle's brim
  // volume: Fortnum's 510ml bottles are sold as 50cl, so they are 0500.
  if (parts && !sku.shortCode && Math.abs(Number(parts[3]) - sku.sizeMl) > sku.sizeMl * 0.03) {
    return { error: `This SKU is ${sku.sizeMl}ml; the code ends ${parts[3]}.` };
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
