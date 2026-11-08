import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { clients, drinks, skus } from "@/db/schema";
import { Field, Select } from "@/app/erp/_components/forms";

function sizeText(ml: number): string {
  return ml >= 1000 ? `${ml / 1000}L` : `${ml / 10}cl`;
}

/** Every active SKU as a person would say it, by customer, then drink, then size. */
export async function skuOptions() {
  const rows = await db
    .select({ id: skus.id, drink: drinks.name, sizeMl: skus.sizeMl, client: clients.name })
    .from(skus)
    .innerJoin(clients, eq(clients.id, skus.clientId))
    .innerJoin(drinks, eq(drinks.id, skus.drinkId))
    .where(eq(skus.active, true))
    .orderBy(asc(clients.name), asc(drinks.name), asc(skus.sizeMl));
  return rows.map((r) => ({ value: String(r.id), label: `${r.client}: ${r.drink} ${sizeText(r.sizeMl)}` }));
}

/** A line can be a SKU, or their words alone until someone matches it. */
export function LineFields({ options, required = false }: { options: { value: string; label: string }[]; required?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Select label="SKU, if you know it" name="skuId" options={options} />
      <Field label="Their description" name="customerDescription" placeholder="As they wrote or said it" />
      <div className="order-fields" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
        <Field label="How many" name="qty" type="number" step="1" min="1" required={required} />
        <Select
          label="Counted in"
          name="countedIn"
          required
          defaultValue="bottles"
          options={[
            { value: "bottles", label: "Bottles" },
            { value: "cases", label: "Cases" },
          ]}
        />
        <Field label="Bottles a case" name="unitsPerCase" type="number" step="1" min="1" placeholder="From the SKU, if known" />
      </div>
      <Field label="Their product code" name="customerItemCode" />
      <Field label="£ a bottle, ex VAT" name="unitPrice" type="number" step="0.01" min="0" placeholder="Blank uses the price list" />
    </div>
  );
}
