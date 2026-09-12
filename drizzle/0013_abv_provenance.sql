CREATE TYPE "public"."abv_source" AS ENUM('bottle', 'manufacturer', 'supplier_invoice', 'assumed', 'placeholder');--> statement-breakpoint
CREATE TABLE "component_abv_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"component_id" integer NOT NULL,
	"abv" numeric(5, 2) NOT NULL,
	"effective_date" date NOT NULL,
	"source" "abv_source" NOT NULL,
	"source_ref" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "abv_source" "abv_source";--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "abv_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "component_abv_history" ADD CONSTRAINT "component_abv_history_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "component_abv_history_component_idx" ON "component_abv_history" USING btree ("component_id");--> statement-breakpoint
CREATE INDEX "component_abv_history_effective_date_idx" ON "component_abv_history" USING btree ("effective_date");