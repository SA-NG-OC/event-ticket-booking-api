import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { bookings, BookingRow, NewBookingRow } from "@/infrastructure/db/schema/bookings";
import { ticketTiers, TicketTierRow } from "@/infrastructure/db/schema/concerts";
import { voucherCampaigns, VoucherCampaignRow } from "@/infrastructure/db/schema/vouchers";
import {
    IBookingRepository,
    IBookingTxRepository,
    ListBookingsFilter,
} from "../domain/booking.repository.interface";

export class BookingRepository implements IBookingRepository {
    async findById(id: string): Promise<BookingRow | undefined> {
        return db.query.bookings.findFirst({ where: eq(bookings.id, id) });
    }

    async findByIdempotencyKey(key: string): Promise<BookingRow | undefined> {
        return db.query.bookings.findFirst({
            where: eq(bookings.idempotencyKey, key),
        });
    }

    async findAll(filter: ListBookingsFilter): Promise<{ rows: BookingRow[]; total: number }> {
        const conditions = [
            filter.userId ? eq(bookings.userId, filter.userId) : undefined,
            filter.concertId ? eq(bookings.concertId, filter.concertId) : undefined,
            filter.status ? eq(bookings.status, filter.status as any) : undefined,
            filter.isFlagged !== undefined ? eq(bookings.isFlagged, filter.isFlagged) : undefined,
        ].filter(Boolean) as any[];

        const where = conditions.length ? and(...conditions) : undefined;
        const offset = (filter.page - 1) * filter.limit;

        const [rows, [{ count }]] = await Promise.all([
            db.query.bookings.findMany({
                where,
                limit: filter.limit,
                offset,
                orderBy: [desc(bookings.createdAt)],
            }),
            db.select({ count: sql<number>`count(*)::int` }).from(bookings).where(where),
        ]);

        return { rows, total: count };
    }

    async findByUserId(userId: string, page: number, limit: number) {
        return this.findAll({ userId, page, limit });
    }

    async save(data: NewBookingRow): Promise<BookingRow> {
        const [row] = await db.insert(bookings).values(data).returning();
        return row;
    }

    async updateStatus(
        id: string,
        status: string,
        extra: Partial<NewBookingRow> = {},
    ): Promise<BookingRow | undefined> {
        const [row] = await db
            .update(bookings)
            .set({ status: status as any, updatedAt: new Date(), ...extra })
            .where(eq(bookings.id, id))
            .returning();
        return row;
    }
}

// ── Transaction-aware repository ─────────────────────────────────────────────
// Dùng raw SQL cho SELECT FOR UPDATE vì Drizzle ORM chưa có built-in support
export class BookingTxRepository implements IBookingTxRepository {
    async lockTicketTier(tierId: string, tx: any): Promise<TicketTierRow | undefined> {
        const rows = await tx.execute(
            sql`SELECT * FROM ticket_tiers WHERE id = ${tierId} FOR UPDATE`
        );
        return rows.rows[0] as TicketTierRow | undefined;
    }

    async incrementReserved(tierId: string, qty: number, tx: any): Promise<void> {
        await tx
            .update(ticketTiers)
            .set({ reservedQty: sql`reserved_qty + ${qty}`, updatedAt: new Date() })
            .where(eq(ticketTiers.id, tierId));
    }

    async decrementReserved(tierId: string, qty: number, tx: any): Promise<void> {
        await tx
            .update(ticketTiers)
            .set({
                reservedQty: sql`GREATEST(0, reserved_qty - ${qty})`,
                updatedAt: new Date(),
            })
            .where(eq(ticketTiers.id, tierId));
    }

    async decrementSold(tierId: string, qty: number, tx: any): Promise<void> {
        await tx
            .update(ticketTiers)
            .set({
                soldQty: sql`GREATEST(0, sold_qty - ${qty})`,
                updatedAt: new Date(),
            })
            .where(eq(ticketTiers.id, tierId));
    }

    async lockVoucher(code: string, tx: any): Promise<VoucherCampaignRow | undefined> {
        const rows = await tx.execute(
            sql`SELECT * FROM voucher_campaigns WHERE code = ${code} FOR UPDATE`
        );
        return rows.rows[0] as VoucherCampaignRow | undefined;
    }

    async incrementVoucherUsed(code: string, tx: any): Promise<void> {
        await tx
            .update(voucherCampaigns)
            .set({ usedCount: sql`used_count + 1` })
            .where(eq(voucherCampaigns.code, code));
    }

    async hasUserUsedVoucher(userId: string, code: string): Promise<boolean> {
        const row = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.userId, userId),
                eq(bookings.voucherCode, code),
                sql`status NOT IN ('cancelled', 'failed')`
            ),
        });
        return !!row;
    }

    async saveInTx(data: NewBookingRow, tx: any): Promise<BookingRow> {
        const rows = await tx.insert(bookings).values(data).returning();
        return rows[0];
    }
}