ALTER TYPE "public"."purchase_commitment_status" ADD VALUE 'needed' BEFORE 'placed';--> statement-breakpoint
ALTER TYPE "public"."purchase_commitment_status" ADD VALUE 'quoted' BEFORE 'placed';--> statement-breakpoint
ALTER TYPE "public"."purchase_commitment_status" ADD VALUE 'confirmed' BEFORE 'arrived';--> statement-breakpoint
ALTER TABLE "purchase_commitments" ALTER COLUMN "supplier_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_commitments" ALTER COLUMN "ordered_on" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "materials_checked_on" date;