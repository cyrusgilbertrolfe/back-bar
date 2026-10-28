ALTER TYPE "public"."sku_component_role" ADD VALUE 'insert';--> statement-breakpoint
CREATE TABLE "sku_set_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"set_sku_id" integer NOT NULL,
	"child_sku_id" integer NOT NULL,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sku_set_lines_qty_positive" CHECK ("sku_set_lines"."quantity" > 0),
	CONSTRAINT "sku_set_lines_not_self" CHECK ("sku_set_lines"."set_sku_id" <> "sku_set_lines"."child_sku_id")
);
--> statement-breakpoint
ALTER TABLE "sku_set_lines" ADD CONSTRAINT "sku_set_lines_set_sku_id_skus_id_fk" FOREIGN KEY ("set_sku_id") REFERENCES "public"."skus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku_set_lines" ADD CONSTRAINT "sku_set_lines_child_sku_id_skus_id_fk" FOREIGN KEY ("child_sku_id") REFERENCES "public"."skus"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sku_set_lines_set_idx" ON "sku_set_lines" USING btree ("set_sku_id");--> statement-breakpoint
CREATE INDEX "sku_set_lines_child_idx" ON "sku_set_lines" USING btree ("child_sku_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sku_set_lines_set_child_uq" ON "sku_set_lines" USING btree ("set_sku_id","child_sku_id");