import { v4 as uuidv4 } from "uuid";
import { ok, err, Result, DomainErrors, DomainError } from "@/shared/result";
import { Concert, TicketTier } from "../domain/concert.entity";
import { IConcertRepository, ITicketTierRepository, ListConcertsFilter } from "../domain/concert.repository.interface";
import { CreateConcertDto, AddTicketTierDto, ConcertView, TicketTierView } from "./concert.dto";
import { toTierView } from "./concert.mapper";

export type { CreateConcertDto, AddTicketTierDto, ConcertView, TicketTierView };

export class ConcertService {
    constructor(
        private readonly concertRepo: IConcertRepository,
        private readonly ticketTierRepo: ITicketTierRepository,
    ) { }

    // ── Customer APIs ─────────────────────────────────────────────────────────

    async listConcerts(filter: ListConcertsFilter): Promise<{ concerts: ConcertView[]; total: number; page: number; limit: number }> {
        const { rows, total } = await this.concertRepo.findAll(filter);
        return {
            concerts: rows.map(r => Concert.fromRow(r).toPersistence()),
            total,
            page: filter.page,
            limit: filter.limit,
        };
    }

    async getConcertDetail(id: string): Promise<Result<{ concert: ConcertView; tiers: TicketTierView[] }, DomainError>> {
        const row = await this.concertRepo.findById(id);
        if (!row) return err(DomainErrors.notFound("Concert"));

        const concert = Concert.fromRow(row);
        const tierRows = await this.ticketTierRepo.findByConcertId(id);
        const tiers = tierRows.map(r => toTierView(TicketTier.fromRow({
            ...r,
            price: Number(r.price),
        })));

        return ok({ concert: concert.toPersistence(), tiers });
    }

    // ── Ops APIs ──────────────────────────────────────────────────────────────

    async createConcert(dto: CreateConcertDto): Promise<Result<ConcertView, DomainError>> {
        const result = Concert.create({ id: uuidv4(), ...dto, description: dto.description ?? null });
        if (result.isErr()) return err(result.error);

        const row = await this.concertRepo.save(result.value.toPersistence());
        return ok(Concert.fromRow(row).toPersistence());
    }

    async addTicketTiers(
        concertId: string,
        tiers: AddTicketTierDto[],
    ): Promise<Result<TicketTierView[], DomainError>> {
        const concertRow = await this.concertRepo.findById(concertId);
        if (!concertRow) return err(DomainErrors.notFound("Concert"));

        const tierEntities: TicketTier[] = [];
        for (const dto of tiers) {
            const result = TicketTier.create({ id: uuidv4(), concertId, ...dto });
            if (result.isErr()) return err(result.error);
            tierEntities.push(result.value);
        }

        const rows = await this.ticketTierRepo.saveBatch(
            tierEntities.map(t => ({
                ...t.toPersistence(),
                price: String(t.price),
            })),
        );

        return ok(rows.map(r => toTierView(TicketTier.fromRow({ ...r, price: Number(r.price) }))));
    }

    async publishConcert(id: string): Promise<Result<ConcertView, DomainError>> {
        const row = await this.concertRepo.findById(id);
        if (!row) return err(DomainErrors.notFound("Concert"));

        const tiers = await this.ticketTierRepo.findByConcertId(id);
        if (tiers.length === 0) {
            return err(DomainErrors.businessRule("Concert must have at least one ticket tier before publishing"));
        }

        const publishResult = Concert.fromRow(row).publish();
        if (publishResult.isErr()) return err(publishResult.error);

        const updated = await this.concertRepo.update(id, { status: "on_sale" });
        if (!updated) return err(DomainErrors.notFound("Concert"));
        return ok(Concert.fromRow(updated).toPersistence());
    }

    async cancelConcert(id: string): Promise<Result<ConcertView, DomainError>> {
        const row = await this.concertRepo.findById(id);
        if (!row) return err(DomainErrors.notFound("Concert"));

        const cancelResult = Concert.fromRow(row).cancel();
        if (cancelResult.isErr()) return err(cancelResult.error);

        const updated = await this.concertRepo.update(id, { status: "cancelled" });
        if (!updated) return err(DomainErrors.notFound("Concert"));
        return ok(Concert.fromRow(updated).toPersistence());
    }

    async checkTicketAvailability(concertId: string): Promise<Result<TicketTierView[], DomainError>> {
        const row = await this.concertRepo.findById(concertId);
        if (!row) return err(DomainErrors.notFound("Concert"));

        const tierRows = await this.ticketTierRepo.findByConcertId(concertId);
        return ok(tierRows.map(r => toTierView(TicketTier.fromRow({ ...r, price: Number(r.price) }))));
    }
}