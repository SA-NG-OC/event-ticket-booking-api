import { BookingRow, NewBookingRow } from "@/infrastructure/db/schema/bookings";
import { VoucherCampaignRow } from "@/infrastructure/db/schema/vouchers";
import { TicketTierRow } from "@/infrastructure/db/schema/concerts";

export interface ListBookingsFilter {
    userId?: string;
    concertId?: string;
    status?: string;
    isFlagged?: boolean;
    page: number;
    limit: number;
}

// Trả về dạng để service có thể join thêm thông tin nếu cần
export interface IBookingRepository {
    findById(id: string): Promise<BookingRow | undefined>;
    findByIdempotencyKey(key: string): Promise<BookingRow | undefined>;
    findAll(filter: ListBookingsFilter): Promise<{ rows: BookingRow[]; total: number }>;
    findByUserId(userId: string, page: number, limit: number): Promise<{ rows: BookingRow[]; total: number }>;
    save(data: NewBookingRow): Promise<BookingRow>;
    updateStatus(id: string, status: string, extra?: Partial<NewBookingRow>): Promise<BookingRow | undefined>;
}

// Repo này thao tác trong transaction — nhận db transaction client
export interface IBookingTxRepository {
    lockTicketTier(tierId: string, tx: any): Promise<TicketTierRow | undefined>;
    incrementReserved(tierId: string, qty: number, tx: any): Promise<void>;
    decrementReserved(tierId: string, qty: number, tx: any): Promise<void>;

    lockVoucher(code: string, tx: any): Promise<VoucherCampaignRow | undefined>;
    incrementVoucherUsed(code: string, tx: any): Promise<void>;

    hasUserUsedVoucher(userId: string, code: string): Promise<boolean>;
    decrementSold(tierId: string, qty: number, tx: any): Promise<void>;
    saveInTx(data: NewBookingRow, tx: any): Promise<BookingRow>;
}