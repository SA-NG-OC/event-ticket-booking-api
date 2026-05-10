import { VoucherProps, DiscountType } from "../domain/voucher.entity";

export interface CreateVoucherDto {
    name: string;
    code: string;
    discountType: DiscountType;
    discountValue: number;
    maxUses: number;
    minOrderValue: number;
    expiresAt?: Date;
    concertId?: string;
}

export interface UpdateVoucherDto {
    name?: string;
    maxUses?: number;
    expiresAt?: Date | null;
}

export interface PreviewVoucherDto {
    code: string;
    orderAmount: number;
    concertId: string;
}

export interface VoucherView extends VoucherProps {
    remainingUses: number;
    isExpired: boolean;
    isExhausted: boolean;
}

export interface VoucherPreview {
    code: string;
    discountType: DiscountType;
    discountAmount: number;
    finalAmount: number;
    description: string;
}