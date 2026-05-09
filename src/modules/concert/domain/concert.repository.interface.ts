import { ConcertRow, NewConcertRow, NewTicketTierRow, TicketTierRow } from "@/infrastructure/db/schema";


export interface ListConcertsFilter {
    status?: string;
    page: number;
    limit: number;
}

export interface ITicketTierRepository {
    findByConcertId(concertId: string): Promise<TicketTierRow[]>;
    findById(id: string): Promise<TicketTierRow | undefined>;
    save(data: NewTicketTierRow): Promise<TicketTierRow>;
    saveBatch(data: NewTicketTierRow[]): Promise<TicketTierRow[]>;
}

export interface IConcertRepository {
    findAll(filter: ListConcertsFilter): Promise<{ rows: ConcertRow[]; total: number }>;
    findById(id: string): Promise<ConcertRow | undefined>;
    save(data: NewConcertRow): Promise<ConcertRow>;
    update(id: string, data: Partial<NewConcertRow>): Promise<ConcertRow | undefined>;
}