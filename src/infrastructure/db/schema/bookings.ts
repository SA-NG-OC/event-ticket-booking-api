import {
    pgTable, uuid, varchar, text, integer, numeric,
    timestamp, pgEnum,
} from "drizzle-orm/pg-core";
import { concerts, ticketTiers } from "./concerts";

export const bookingStatusEnum = pgEnum("booking_status", [
    "pending",    // vừa tạo, chưa thanh toán
    "confirmed",  // đã thanh toán thành công
    "cancelled",  // đã huỷ (tự huỷ hoặc ops huỷ)
    "failed",     // thanh toán thất bại
]);

export const bookings = pgTable("bookings", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    ticketTierId: uuid("ticket_tier_id").notNull().references(() => ticketTiers.id),
    concertId: uuid("concert_id").notNull().references(() => concerts.id),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    finalAmount: numeric("final_amount", { precision: 12, scale: 2 }).notNull(),
    voucherCode: varchar("voucher_code", { length: 50 }),
    status: bookingStatusEnum("status").notNull().default("pending"),
    // idempotency key — client gửi lên để tránh duplicate booking khi retry
    idempotencyKey: varchar("idempotency_key", { length: 255 }).unique(),
    // ops flags
    isFlagged: integer("is_flagged").notNull().default(0), // 0/1 — simple flag
    flagReason: text("flag_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});