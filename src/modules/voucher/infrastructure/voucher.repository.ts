import { eq, and, sql } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import {
    voucherCampaigns,
    VoucherCampaignRow,
    NewVoucherCampaignRow,
} from "@/infrastructure/db/schema/vouchers";
import { IVoucherRepository, ListVouchersFilter } from "../domain/voucher.repository.interface";

export class VoucherRepository implements IVoucherRepository {
    async findAll(filter: ListVouchersFilter): Promise<{ rows: VoucherCampaignRow[]; total: number }> {
        const conditions = [
            filter.concertId ? eq(voucherCampaigns.concertId, filter.concertId) : undefined,
        ].filter(Boolean) as any[];

        const where = conditions.length ? and(...conditions) : undefined;
        const offset = (filter.page - 1) * filter.limit;

        const [rows, [{ count }]] = await Promise.all([
            db.query.voucherCampaigns.findMany({
                where,
                limit: filter.limit,
                offset,
                orderBy: (t, { desc }) => [desc(t.createdAt)],
            }),
            db.select({ count: sql<number>`count(*)::int` })
                .from(voucherCampaigns)
                .where(where),
        ]);

        return { rows, total: count };
    }

    async findById(id: string): Promise<VoucherCampaignRow | undefined> {
        return db.query.voucherCampaigns.findFirst({
            where: eq(voucherCampaigns.id, id),
        });
    }

    async findByCode(code: string): Promise<VoucherCampaignRow | undefined> {
        return db.query.voucherCampaigns.findFirst({
            where: eq(voucherCampaigns.code, code.toUpperCase().trim()),
        });
    }

    async existsByCode(code: string): Promise<boolean> {
        const row = await db.query.voucherCampaigns.findFirst({
            where: eq(voucherCampaigns.code, code.toUpperCase().trim()),
        });
        return !!row;
    }

    async save(data: NewVoucherCampaignRow): Promise<VoucherCampaignRow> {
        const [row] = await db.insert(voucherCampaigns).values(data).returning();
        return row;
    }

    async update(id: string, data: Partial<NewVoucherCampaignRow>): Promise<VoucherCampaignRow | undefined> {
        const [row] = await db
            .update(voucherCampaigns)
            .set(data)
            .where(eq(voucherCampaigns.id, id))
            .returning();
        return row;
    }

    async delete(id: string): Promise<boolean> {
        const result = await db
            .delete(voucherCampaigns)
            .where(eq(voucherCampaigns.id, id));
        return (result.rowCount ?? 0) > 0;
    }
}