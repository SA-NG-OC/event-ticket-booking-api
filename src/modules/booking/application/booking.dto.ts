export interface CreateBookingDto {
    userId: string;
    ticketTierId: string;
    quantity: number;
    voucherCode?: string;
    idempotencyKey: string;
}

export interface UpdateBookingStatusDto {
    status: "confirmed" | "cancelled" | "failed";
    flagReason?: string;
}