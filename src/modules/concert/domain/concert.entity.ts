import { ok, err, Result, DomainErrors, DomainError } from "@/shared/result";

// ── Value types ───────────────────────────────────────────────────────────────
export type ConcertStatus = "draft" | "on_sale" | "sold_out" | "cancelled" | "completed";

export interface TicketTierProps {
    id: string;
    concertId: string;
    name: string;
    price: number;
    totalQty: number;
    reservedQty: number;
    soldQty: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ConcertProps {
    id: string;
    name: string;
    description: string | null;
    venue: string;
    artistName: string;
    eventDate: Date;
    status: ConcertStatus;
    createdAt: Date;
    updatedAt: Date;
}

// ── TicketTier Entity ─────────────────────────────────────────────────────────
export class TicketTier {
    private constructor(private readonly props: TicketTierProps) { }

    get id() { return this.props.id; }
    get concertId() { return this.props.concertId; }
    get name() { return this.props.name; }
    get price() { return this.props.price; }
    get reservedQty() { return this.props.reservedQty; }
    get soldQty() { return this.props.soldQty; }
    get availableQty() { return this.props.totalQty - this.props.reservedQty - this.props.soldQty; }
    get createdAt() { return this.props.createdAt; }
    get updatedAt() { return this.props.updatedAt; }

    static fromRow(row: TicketTierProps): TicketTier {
        return new TicketTier(row);
    }

    static create(params: Omit<TicketTierProps, "reservedQty" | "soldQty" | "createdAt" | "updatedAt">): Result<TicketTier, DomainError> {
        if (params.price <= 0) {
            return err(DomainErrors.validation("Price must be greater than 0"));
        }
        if (params.totalQty <= 0) {
            return err(DomainErrors.validation("Total quantity must be greater than 0"));
        }
        return ok(new TicketTier({
            ...params,
            reservedQty: 0,
            soldQty: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        }));
    }

    // Domain behaviour: kiểm tra còn đủ vé không
    hasAvailableQty(requested: number): boolean {
        return this.availableQty >= requested;
    }

    toPersistence(): TicketTierProps {
        return { ...this.props };
    }
}

// ── Concert Entity ────────────────────────────────────────────────────────────
export class Concert {
    private constructor(private readonly props: ConcertProps) { }

    get id() { return this.props.id; }
    get name() { return this.props.name; }
    get description() { return this.props.description; }
    get venue() { return this.props.venue; }
    get artistName() { return this.props.artistName; }
    get eventDate() { return this.props.eventDate; }
    get status() { return this.props.status; }
    get createdAt() { return this.props.createdAt; }
    get updatedAt() { return this.props.updatedAt; }

    static fromRow(row: ConcertProps): Concert {
        return new Concert(row);
    }

    static create(params: Omit<ConcertProps, "status" | "createdAt" | "updatedAt">): Result<Concert, DomainError> {
        if (params.name.trim().length < 3) {
            return err(DomainErrors.validation("Concert name must be at least 3 characters"));
        }
        if (params.eventDate <= new Date()) {
            return err(DomainErrors.validation("Event date must be in the future"));
        }
        if (params.venue.trim().length < 2) {
            return err(DomainErrors.validation("Venue is required"));
        }
        return ok(new Concert({
            ...params,
            name: params.name.trim(),
            venue: params.venue.trim(),
            status: "draft",
            createdAt: new Date(),
            updatedAt: new Date(),
        }));
    }

    // ── State transitions — chỉ cho phép các bước hợp lệ ────────────────────
    publish(): Result<Concert, DomainError> {
        if (this.props.status !== "draft") {
            return err(DomainErrors.businessRule(
                `Cannot publish concert with status '${this.props.status}'`
            ));
        }
        return ok(new Concert({ ...this.props, status: "on_sale", updatedAt: new Date() }));
    }

    cancel(): Result<Concert, DomainError> {
        if (this.props.status === "completed" || this.props.status === "cancelled") {
            return err(DomainErrors.businessRule(
                `Cannot cancel concert with status '${this.props.status}'`
            ));
        }
        return ok(new Concert({ ...this.props, status: "cancelled", updatedAt: new Date() }));
    }

    isAcceptingBookings(): boolean {
        return this.props.status === "on_sale";
    }

    toPersistence(): ConcertProps {
        return { ...this.props };
    }
}