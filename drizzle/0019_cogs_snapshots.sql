CREATE TABLE "sku_cogs_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku_id" integer NOT NULL,
	"as_of" date NOT NULL,
	"total" numeric(12, 4) NOT NULL,
	"liquid_total" numeric(12, 4) NOT NULL,
	"packaging_total" numeric(12, 4) NOT NULL,
	"wastage" numeric(12, 4) NOT NULL,
	"wastage_pct" numeric(8, 6) NOT NULL,
	"lines" jsonb NOT NULL,
	"trigger" text NOT NULL,
	"reconstructed" boolean DEFAULT false NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sku_cogs_snapshots" ADD CONSTRAINT "sku_cogs_snapshots_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sku_cogs_snapshots_sku_as_of_idx" ON "sku_cogs_snapshots" USING btree ("sku_id","as_of");