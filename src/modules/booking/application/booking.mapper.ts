import { BookingProps } from "../domain/booking.entity";
import { VoucherProps } from "../../voucher/domain/voucher.entity";
import { TicketTierProps } from "@/modules/concert/domain/concert.entity";

export function toTierProps(row: any): TicketTierProps {
    return {
        ...row,
        concertId: row.concertId ?? row.concert_id,
        totalQty: row.totalQty ?? row.total_qty,
        reservedQty: row.reservedQty ?? row.reserved_qty,
        soldQty: row.soldQty ?? row.sold_qty,
        createdAt: row.createdAt ?? row.created_at,
        updatedAt: row.updatedAt ?? row.updated_at,
        price: Number(row.price),
    };
}

export function toVoucherProps(row: any): VoucherProps {
    return {
        ...row,
        discountType: row.discountType ?? row.discount_type,
        discountValue: Number(row.discountValue ?? row.discount_value),
        maxUses: row.maxUses ?? row.max_uses,
        usedCount: row.usedCount ?? row.used_count,
        minOrderValue: Number(row.minOrderValue ?? row.min_order_value),
        concertId: row.concertId ?? row.concert_id,
        expiresAt: row.expiresAt ?? row.expires_at,
        createdAt: row.createdAt ?? row.created_at,
    };
}

export function toBookingProps(row: any): BookingProps {
    return {
        ...row,
        unitPrice: Number(row.unitPrice ?? row.unit_price),
        totalAmount: Number(row.totalAmount ?? row.total_amount),
        discountAmount: Number(row.discountAmount ?? row.discount_amount),
        finalAmount: Number(row.finalAmount ?? row.final_amount),
    };
}