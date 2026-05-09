import { pgTable, uuid, varchar, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { concerts, ticketTiers } from "./concerts";
import { boolean } from "drizzle-orm/pg-core";
import { text } from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";

export const bookingStatusEnum = pgEnum("booking_status", [
    "pending",    // vừa tạo, chờ thanh toán
    "confirmed",  // đã thanh toán thành công
    "cancelled",  // đã huỷ
    "failed",     // thanh toán thất bại
]);

export const bookings = pgTable("bookings", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    ticketTierId: uuid("ticket_tier_id").notNull().references(() => ticketTiers.id),
    concertId: uuid("concert_id").notNull().references(() => concerts.id),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    finalAmount: numeric("final_amount", { precision: 12, scale: 2 }).notNull(),
    voucherCode: varchar("voucher_code", { length: 50 }),
    status: bookingStatusEnum("status").notNull().default("pending"),
    // Idempotency — client tự sinh UUID và gửi lên, unique constraint ngăn duplicate
    idempotencyKey: varchar("idempotency_key", { length: 255 }).unique(),
    // Ops flags
    isFlagged: boolean("is_flagged").notNull().default(false),
    flagReason: text("flag_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});


export type BookingRow = typeof bookings.$inferSelect;
export type NewBookingRow = typeof bookings.$inferInsert;