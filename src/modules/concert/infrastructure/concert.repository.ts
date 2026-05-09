import { eq, sql, and } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { concerts, ticketTiers, ConcertRow, NewConcertRow, TicketTierRow, NewTicketTierRow } from "@/infrastructure/db/schema/concerts";
import { IConcertRepository, ITicketTierRepository, ListConcertsFilter } from "../domain/concert.repository.interface";

export class ConcertRepository implements IConcertRepository {
    async findAll(filter: ListConcertsFilter): Promise<{ rows: ConcertRow[]; total: number }> {
        const conditions = filter.status
            ? [eq(concerts.status, filter.status as any)]
            : [];

        const offset = (filter.page - 1) * filter.limit;

        const [rows, [{ count }]] = await Promise.all([
            db.query.concerts.findMany({
                where: conditions.length ? and(...conditions) : undefined,
                limit: filter.limit,
                offset,
                orderBy: (t, { desc }) => [desc(t.eventDate)],
            }),
            db.select({ count: sql<number>`count(*)::int` })
                .from(concerts)
                .where(conditions.length ? and(...conditions) : undefined),
        ]);

        return { rows, total: count };
    }

    async findById(id: string): Promise<ConcertRow | undefined> {
        return db.query.concerts.findFirst({ where: eq(concerts.id, id) });
    }

    async save(data: NewConcertRow): Promise<ConcertRow> {
        const [row] = await db.insert(concerts).values(data).returning();
        return row;
    }

    async update(id: string, data: Partial<NewConcertRow>): Promise<ConcertRow | undefined> {
        const [row] = await db
            .update(concerts)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(concerts.id, id))
            .returning();
        return row;
    }
}

export class TicketTierRepository implements ITicketTierRepository {
    async findByConcertId(concertId: string): Promise<TicketTierRow[]> {
        return db.query.ticketTiers.findMany({
            where: eq(ticketTiers.concertId, concertId),
            orderBy: (t, { asc }) => [asc(t.price)],
        });
    }

    async findById(id: string): Promise<TicketTierRow | undefined> {
        return db.query.ticketTiers.findFirst({ where: eq(ticketTiers.id, id) });
    }

    async save(data: NewTicketTierRow): Promise<TicketTierRow> {
        const [row] = await db.insert(ticketTiers).values(data).returning();
        return row;
    }

    async saveBatch(data: NewTicketTierRow[]): Promise<TicketTierRow[]> {
        return db.insert(ticketTiers).values(data).returning();
    }
}