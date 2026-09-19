/**
 * Fortnum's identity on the F&M SKUs, and PO PU215780 as amended, so the case
 * label generator has something true to print.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-fm-case-label-identity-20260919.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/seed-fm-case-label-identity-20260919.ts --write  # apply
 *
 * Written 19 Sept 2026. Sources:
 *   - PU215780 amend.pdf, Abbie Johnson, 4 Sep 2026 09:28, thread
 *     1a057ab771a70db7 in cocktails@myattsfields.london. Line 2 is Apples 'n'
 *     Pears, 42 x Case 12. Line 1, the Gingertini, is 0.00: it moved to
 *     PU217633 on 2 Sep. Descriptions below are copied off that PDF verbatim,
 *     curly quotes included.
 *   - Case 12 on both seasonals: Stina Lundberg, 3 Sep 2026, same thread,
 *     "Both SKUs are now Case 12".
 *   - 5086517 for the Espresso Daiquiri: QuickBooks item note, read 31 Jul
 *     2026, and the old Word case labels. Case 12 from those labels too. No
 *     Daiquiri PO is to hand, so its description is left empty rather than
 *     guessed: the label generator refuses to print without one.
 *   - Short codes: the standard Cyrus agreed on 19 Sep 2026 (see the comment
 *     on skus.shortCode).
 *
 * Only ever fills an empty field. A value already present is reported and left
 * alone, so a correction made in the UI is never overwritten by a re-run.
 */

import { and, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { customers, skus, wholesaleOrderLines, wholesaleOrders } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");

type SkuIdentity = {
  code: string;
  shortCode: string;
  customerItemCode?: string;
  customerDescription?: string;
  unitsPerCase?: number;
};

const SKUS: SkuIdentity[] = [
  {
    code: "apples-and-pears-500-fm",
    shortCode: "FM-APPR",
    customerItemCode: "5248400",
    customerDescription: "Apples ‘n’ Pears Cocktail 19% 50cl",
    unitsPerCase: 12,
  },
  {
    code: "christmas-gingertini-500-fm",
    shortCode: "FM-XGIN",
    customerItemCode: "5246820",
    customerDescription: "Gingertini Christmas Cocktail 17.6% 50cl",
    unitsPerCase: 12,
  },
  { code: "espresso-daiquiri-350-fm", shortCode: "FM-EDAQ", customerItemCode: "5086517", unitsPerCase: 12 },
  { code: "robin-roy-350-fm", shortCode: "FM-RROY" },
  { code: "vesper-martini-350-fm", shortCode: "FM-VESP" },
];

const FIELDS = ["shortCode", "customerItemCode", "customerDescription", "unitsPerCase"] as const;

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — F&M SKU identity and PU215780\n`);

  const skuIdByCode = new Map<string, number>();
  for (const want of SKUS) {
    const [row] = await db.select().from(skus).where(eq(skus.code, want.code));
    if (!row) throw new Error(`SKU ${want.code} not found`);
    skuIdByCode.set(want.code, row.id);

    const patch: Partial<typeof skus.$inferInsert> = {};
    for (const f of FIELDS) {
      const next = want[f];
      if (next === undefined) continue;
      const cur = row[f];
      if (cur === null) {
        (patch as Record<string, unknown>)[f] = next;
        console.log(`  ${want.code}  ${f} := ${next}`);
      } else if (cur !== next) {
        console.log(`  ${want.code}  ${f} holds ${cur}, would be ${next} — LEFT ALONE`);
      }
    }
    if (WRITE && Object.keys(patch).length) {
      await db.update(skus).set({ ...patch, updatedAt: new Date() }).where(eq(skus.id, row.id));
    }
  }

  // ── Customer ──────────────────────────────────────────────────────────────
  let [fm] = await db.select().from(customers).where(eq(customers.accountCode, "MY010"));
  if (!fm) {
    console.log(`\n  customer Fortnum & Mason (MY010): CREATE`);
    if (WRITE) {
      [fm] = await db
        .insert(customers)
        .values({ name: "Fortnum & Mason", accountCode: "MY010", notes: "Their supplier code for us is MY010." })
        .returning();
    }
  } else {
    console.log(`\n  customer ${fm.name} (MY010) exists [${fm.id}]`);
  }

  // ── The order ─────────────────────────────────────────────────────────────
  const existing = fm
    ? await db
        .select()
        .from(wholesaleOrders)
        .where(and(eq(wholesaleOrders.customerId, fm.id), eq(wholesaleOrders.orderNumber, "PU215780")))
    : [];
  if (existing.length) {
    console.log(`  order PU215780 exists [${existing[0].id}] — left untouched`);
  } else {
    console.log(`  order PU215780: CREATE with 2 lines (Apples 'n' Pears 42 x Case 12; Gingertini 0)`);
    if (WRITE && fm) {
      const [order] = await db
        .insert(wholesaleOrders)
        .values({
          customerId: fm.id,
          orderNumber: "PU215780",
          raisedOn: "2026-09-04",
          receivedAt: new Date("2026-09-04T09:28:19Z"),
          sourceThreadId: "1a057ab771a70db7",
          documentRef: "PU215780 amend.pdf",
          status: "in_production",
          requestedDeliveryFrom: "2026-09-21",
          requestedDeliveryTo: "2026-09-25",
          deliveryAddress:
            "iForce House, Unit 1 Ore Lane, Delivery Door D, Midlands Logistics Park, Corby NN18 8ET. Warehouse DC2.",
          notes:
            "As amended 4 Sep 2026. Originally raised 12 Aug on Case 6; reissued at Case 12 with halved " +
            "quantities. The Gingertini line was moved to PU217633 on 2 Sep and stands at 0.00 here.",
        })
        .returning();
      await db.insert(wholesaleOrderLines).values([
        {
          orderId: order.id,
          lineNo: 1,
          customerItemCode: "5246820",
          customerDescription: "Gingertini Christmas Cocktail 17.6% 50cl",
          skuId: skuIdByCode.get("christmas-gingertini-500-fm")!,
          qty: "0",
          unitDescription: "Case 6",
          unitsPerCase: 6,
          unitPriceStated: "0",
        },
        {
          orderId: order.id,
          lineNo: 2,
          customerItemCode: "5248400",
          customerDescription: "Apples ‘n’ Pears Cocktail 19% 50cl",
          skuId: skuIdByCode.get("apples-and-pears-500-fm")!,
          qty: "42",
          unitDescription: "Case 12",
          unitsPerCase: 12,
          unitPriceStated: "0",
        },
      ]);
      console.log(`  created order [${order.id}]`);
    }
  }

  console.log(WRITE ? "\nDONE." : "\nDry run only. Re-run with --write to apply.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
