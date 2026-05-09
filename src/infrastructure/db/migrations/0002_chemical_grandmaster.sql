ALTER TABLE "voucher_campaigns" ALTER COLUMN "min_order_value" SET NOT NULL;
ALTER TABLE "bookings" ALTER COLUMN "user_id" SET DATA TYPE uuid USING user_id::uuid;
ALTER TABLE "bookings" ALTER COLUMN "is_flagged" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "is_flagged" SET DATA TYPE boolean USING is_flagged::boolean;
ALTER TABLE "bookings" ALTER COLUMN "is_flagged" SET DEFAULT false;
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_user_id_users_id_fk";
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;