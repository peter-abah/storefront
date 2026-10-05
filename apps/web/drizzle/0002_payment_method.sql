CREATE TABLE "payment_methods" (
	"code" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" text DEFAULT 'cod' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paystack_ref" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paystack_auth" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_paystack_ref_unique" UNIQUE("paystack_ref");