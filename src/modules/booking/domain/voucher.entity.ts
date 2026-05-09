import { ok, err, Result, DomainErrors, DomainError } from "@/shared/result";

export type DiscountType = "percentage" | "fixed";

export interface VoucherProps {
    id: string;
    name: string;
    code: string;
    discountType: DiscountType;
    discountValue: number;
    maxUses: number;
    usedCount: number;
    minOrderValue: number;
    expiresAt: Date | null;
    concertId: string | null;
    createdAt: Date;
}

export class Voucher {
    private constructor(private readonly props: VoucherProps) { }

    get id() { return this.props.id; }
    get code() { return this.props.code; }
    get discountType() { return this.props.discountType; }
    get discountValue() { return this.props.discountValue; }
    get maxUses() { return this.props.maxUses; }
    get usedCount() { return this.props.usedCount; }
    get minOrderValue() { return this.props.minOrderValue; }
    get expiresAt() { return this.props.expiresAt; }
    get concertId() { return this.props.concertId; }
    get name() { return this.props.name; }

    static fromRow(row: VoucherProps): Voucher {
        return new Voucher(row);
    }

    // ── Domain: validate xem voucher có thể áp dụng không ───────────────────
    validate(params: {
        orderAmount: number;
        concertId: string;
        now?: Date;
    }): Result<void, DomainError> {
        const now = params.now ?? new Date();

        if (this.props.expiresAt && this.props.expiresAt < now) {
            return err(DomainErrors.businessRule("Voucher has expired"));
        }
        if (this.props.usedCount >= this.props.maxUses) {
            return err(DomainErrors.businessRule("Voucher has reached maximum usage limit"));
        }
        if (params.orderAmount < this.props.minOrderValue) {
            return err(DomainErrors.businessRule(
                `Minimum order value for this voucher is ${this.props.minOrderValue}`
            ));
        }
        // null concertId = áp dụng tất cả
        if (this.props.concertId && this.props.concertId !== params.concertId) {
            return err(DomainErrors.businessRule("Voucher is not valid for this concert"));
        }

        return ok(undefined);
    }

    // ── Tính số tiền discount ─────────────────────────────────────────────────
    calculateDiscount(orderAmount: number): number {
        if (this.props.discountType === "percentage") {
            return Math.floor(orderAmount * (this.props.discountValue / 100));
        }
        // fixed: không discount nhiều hơn order amount
        return Math.min(this.props.discountValue, orderAmount);
    }

    toPersistence(): VoucherProps {
        return { ...this.props };
    }
}