CREATE TYPE "public"."stock_count_status" AS ENUM('draft', 'closed');--> statement-breakpoint
CREATE TYPE "public"."stock_line_kind" AS ENUM('finished', 'bulk', 'component', 'other');--> statement-breakpoint
CREATE TABLE "stock_count_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"count_id" integer NOT NULL,
	"kind" "stock_line_kind" NOT NULL,
	"sku_id" integer,
	"component_id" integer,
	"drink_id" integer,
	"client_id" integer,
	"description" text,
	"location" text DEFAULT 'Unit' NOT NULL,
	"quantity" numeric(12, 3),
	"unit" text NOT NULL,
	"obsolete" boolean DEFAULT false NOT NULL,
	"unit_cost" numeric(12, 4),
	"value" numeric(12, 2),
	"cost_source" text,
	"cost_note" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_counts" (
	"id" serial PRIMARY KEY NOT NULL,
	"as_at" date NOT NULL,
	"counted_on" date,
	"counted_by" text,
	"status" "stock_count_status" DEFAULT 'draft' NOT NULL,
	"basis" text,
	"notes" text,
	"closed_at" timestamp with time zone,
	"closed_total" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_count_id_stock_counts_id_fk" FOREIGN KEY ("count_id") REFERENCES "public"."stock_counts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_drink_id_drinks_id_fk" FOREIGN KEY ("drink_id") REFERENCES "public"."drinks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_count_lines_count_idx" ON "stock_count_lines" USING btree ("count_id");