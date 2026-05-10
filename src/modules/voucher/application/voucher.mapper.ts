import { Voucher, VoucherProps } from "../domain/voucher.entity";
import { VoucherView } from "./voucher.dto";

export function toView(v: Voucher): VoucherView {
    return {
        ...v.toPersistence(),
        remainingUses: v.remainingUses,
        isExpired: v.isExpired,
        isExhausted: v.isExhausted,
    };
}

export function toNumericProps(row: any): VoucherProps {
    return {
        ...row,
        discountValue: Number(row.discountValue ?? row.discount_value),
        minOrderValue: Number(row.minOrderValue ?? row.min_order_value),
    };
}