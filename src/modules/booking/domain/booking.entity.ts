import { ok, err, Result, DomainErrors, DomainError } from "@/shared/result";

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "failed";

export interface BookingProps {
    id: string;
    userId: string;
    ticketTierId: string;
    concertId: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    discountAmount: number;
    finalAmount: number;
    voucherCode: string | null;
    status: BookingStatus;
    idempotencyKey: string | null;
    isFlagged: boolean;
    flagReason: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export class Booking {
    private constructor(private readonly props: BookingProps) { }

    get id() { return this.props.id; }
    get userId() { return this.props.userId; }
    get ticketTierId() { return this.props.ticketTierId; }
    get concertId() { return this.props.concertId; }
    get quantity() { return this.props.quantity; }
    get unitPrice() { return this.props.unitPrice; }
    get totalAmount() { return this.props.totalAmount; }
    get discountAmount() { return this.props.discountAmount; }
    get finalAmount() { return this.props.finalAmount; }
    get voucherCode() { return this.props.voucherCode; }
    get status() { return this.props.status; }
    get idempotencyKey() { return this.props.idempotencyKey; }
    get isFlagged() { return this.props.isFlagged; }
    get flagReason() { return this.props.flagReason; }
    get createdAt() { return this.props.createdAt; }
    get updatedAt() { return this.props.updatedAt; }

    static fromRow(row: BookingProps): Booking {
        return new Booking(row);
    }

    static create(params: {
        id: string;
        userId: string;
        ticketTierId: string;
        concertId: string;
        quantity: number;
        unitPrice: number;
        discountAmount: number;
        voucherCode: string | null;
        idempotencyKey: string | null;
    }): Result<Booking, DomainError> {
        if (params.quantity < 1 || params.quantity > 10) {
            return err(DomainErrors.validation("Quantity must be between 1 and 10"));
        }
        if (params.unitPrice <= 0) {
            return err(DomainErrors.validation("Unit price must be greater than 0"));
        }
        if (params.discountAmount < 0) {
            return err(DomainErrors.validation("Discount amount cannot be negative"));
        }

        const totalAmount = params.unitPrice * params.quantity;
        const finalAmount = Math.max(0, totalAmount - params.discountAmount);

        return ok(new Booking({
            ...params,
            totalAmount,
            finalAmount,
            status: "pending",
            isFlagged: false,
            flagReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }));
    }

    // ── State machine — enforce valid transitions ────────────────────────────
    // pending → confirmed
    confirm(): Result<Booking, DomainError> {
        if (this.props.status !== "pending") {
            return err(DomainErrors.businessRule(
                `Cannot confirm booking with status '${this.props.status}'`
            ));
        }
        return ok(new Booking({ ...this.props, status: "confirmed", updatedAt: new Date() }));
    }

    // pending → failed
    fail(): Result<Booking, DomainError> {
        if (this.props.status !== "pending") {
            return err(DomainErrors.businessRule(
                `Cannot fail booking with status '${this.props.status}'`
            ));
        }
        return ok(new Booking({ ...this.props, status: "failed", updatedAt: new Date() }));
    }

    // pending | confirmed → cancelled
    cancel(): Result<Booking, DomainError> {
        if (this.props.status === "cancelled" || this.props.status === "failed") {
            return err(DomainErrors.businessRule(
                `Cannot cancel booking with status '${this.props.status}'`
            ));
        }
        return ok(new Booking({ ...this.props, status: "cancelled", updatedAt: new Date() }));
    }

    // Ops: đánh dấu booking đáng ngờ
    flag(reason: string): Result<Booking, DomainError> {
        if (!reason.trim()) {
            return err(DomainErrors.validation("Flag reason is required"));
        }
        return ok(new Booking({ ...this.props, isFlagged: true, flagReason: reason, updatedAt: new Date() }));
    }

    unflag(): Booking {
        return new Booking({ ...this.props, isFlagged: false, flagReason: null, updatedAt: new Date() });
    }

    // Booking đã confirmed thì cần hoàn vé khi cancel
    needsInventoryRelease(): boolean {
        return this.props.status === "confirmed";
    }

    toPersistence(): BookingProps {
        return { ...this.props };
    }
}