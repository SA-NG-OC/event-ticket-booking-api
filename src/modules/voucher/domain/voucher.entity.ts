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

    // ── Getters ───────────────────────────────────────────────────────────────
    get id() { return this.props.id; }
    get name() { return this.props.name; }
    get code() { return this.props.code; }
    get discountType() { return this.props.discountType; }
    get discountValue() { return this.props.discountValue; }
    get maxUses() { return this.props.maxUses; }
    get usedCount() { return this.props.usedCount; }
    get minOrderValue() { return this.props.minOrderValue; }
    get expiresAt() { return this.props.expiresAt; }
    get concertId() { return this.props.concertId; }
    get createdAt() { return this.props.createdAt; }

    // ── Derived ───────────────────────────────────────────────────────────────
    get remainingUses() { return this.props.maxUses - this.props.usedCount; }
    get isExhausted() { return this.props.usedCount >= this.props.maxUses; }
    get isExpired() { return this.props.expiresAt !== null && this.props.expiresAt < new Date(); }

    // ── Factories ─────────────────────────────────────────────────────────────
    static fromRow(row: VoucherProps): Voucher {
        return new Voucher(row);
    }

    static create(params: {
        id: string;
        name: string;
        code: string;
        discountType: DiscountType;
        discountValue: number;
        maxUses: number;
        minOrderValue: number;
        expiresAt: Date | null;
        concertId: string | null;
    }): Result<Voucher, DomainError> {
        // ── Invariants ────────────────────────────────────────────────────────
        if (params.name.trim().length < 2) {
            return err(DomainErrors.validation("Voucher name must be at least 2 characters"));
        }
        if (!/^[A-Z0-9_-]{3,50}$/.test(params.code)) {
            return err(DomainErrors.validation(
                "Voucher code must be 3–50 uppercase alphanumeric characters (A-Z, 0-9, _, -)"
            ));
        }
        if (params.maxUses < 1) {
            return err(DomainErrors.validation("maxUses must be at least 1"));
        }
        if (params.minOrderValue < 0) {
            return err(DomainErrors.validation("minOrderValue cannot be negative"));
        }
        if (params.discountType === "percentage") {
            if (params.discountValue <= 0 || params.discountValue > 100) {
                return err(DomainErrors.validation("Percentage discount must be between 1 and 100"));
            }
        } else {
            if (params.discountValue <= 0) {
                return err(DomainErrors.validation("Fixed discount must be greater than 0"));
            }
        }
        if (params.expiresAt !== null && params.expiresAt <= new Date()) {
            return err(DomainErrors.businessRule("Expiry date must be in the future"));
        }

        return ok(new Voucher({
            ...params,
            code: params.code.toUpperCase().trim(),
            name: params.name.trim(),
            usedCount: 0,
            createdAt: new Date(),
        }));
    }

    // ── Domain behaviour ──────────────────────────────────────────────────────

    // Validate xem voucher có apply được vào order không
    // Dùng cả trong booking service và trong preview API
    validate(params: {
        orderAmount: number;
        concertId: string;
        now?: Date;
    }): Result<void, DomainError> {
        const now = params.now ?? new Date();

        if (this.props.expiresAt && this.props.expiresAt < now) {
            return err(DomainErrors.businessRule("Voucher has expired"));
        }
        if (this.isExhausted) {
            return err(DomainErrors.businessRule("Voucher has reached maximum usage limit"));
        }
        if (params.orderAmount < this.props.minOrderValue) {
            return err(DomainErrors.businessRule(
                `Minimum order value for this voucher is ${this.props.minOrderValue}`
            ));
        }
        if (this.props.concertId && this.props.concertId !== params.concertId) {
            return err(DomainErrors.businessRule("Voucher is not valid for this concert"));
        }

        return ok(undefined);
    }

    calculateDiscount(orderAmount: number): number {
        if (this.props.discountType === "percentage") {
            return Math.floor(orderAmount * (this.props.discountValue / 100));
        }
        return Math.min(this.props.discountValue, orderAmount);
    }

    // ── Update — chỉ các field an toàn ──────────────────────────────────────
    update(params: {
        name?: string;
        maxUses?: number;
        expiresAt?: Date | null;
    }): Result<Voucher, DomainError> {
        const nextName = params.name ?? this.props.name;
        const nextMaxUses = params.maxUses ?? this.props.maxUses;
        const nextExpiresAt =
            params.expiresAt !== undefined ? params.expiresAt : this.props.expiresAt;

        if (nextName.trim().length < 2) {
            return err(DomainErrors.validation("Voucher name must be at least 2 characters"));
        }
        // maxUses không được giảm xuống dưới số đã dùng
        if (nextMaxUses < this.props.usedCount) {
            return err(DomainErrors.businessRule(
                `maxUses cannot be less than current usedCount (${this.props.usedCount})`
            ));
        }
        if (nextMaxUses < 1) {
            return err(DomainErrors.validation("maxUses must be at least 1"));
        }
        if (nextExpiresAt !== null && nextExpiresAt !== undefined && nextExpiresAt <= new Date()) {
            return err(DomainErrors.businessRule("Expiry date must be in the future"));
        }

        return ok(new Voucher({
            ...this.props,
            name: nextName.trim(),
            maxUses: nextMaxUses,
            expiresAt: nextExpiresAt ?? null,
        }));
    }

    // ── Delete guard ──────────────────────────────────────────────────────────
    canDelete(): Result<void, DomainError> {
        if (this.props.usedCount > 0) {
            return err(DomainErrors.businessRule(
                `Cannot delete voucher that has been used ${this.props.usedCount} time(s). Deactivate by setting expiresAt to a past date instead.`
            ));
        }
        return ok(undefined);
    }

    toPersistence(): VoucherProps {
        return { ...this.props };
    }
}