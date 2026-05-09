import { v4 as uuidv4 } from "uuid";
import { ok, err, Result, DomainErrors, DomainError } from "@/shared/result";
import { db } from "@/infrastructure/db";
import { Booking, BookingProps } from "../domain/booking.entity";
import { Voucher, VoucherProps } from "../domain/voucher.entity";
import { Concert, TicketTier, TicketTierProps } from "@/modules/concert/domain/concert.entity";
import { IBookingRepository, IBookingTxRepository, ListBookingsFilter } from "../domain/booking.repository.interface";
import { IConcertRepository } from "@/modules/concert/domain/concert.repository.interface";
import { bookingQueue } from "@/infrastructure/queue/booking.queue";

// ── DTOs ─────────────────────────────────────────────────────────────────────
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

// Helper: convert numeric string từ DB row → number cho entity
function toTierProps(row: any): TicketTierProps {
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

function toVoucherProps(row: any): VoucherProps {
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

function toBookingProps(row: any): BookingProps {
    return {
        ...row,
        unitPrice: Number(row.unitPrice ?? row.unit_price),
        totalAmount: Number(row.totalAmount ?? row.total_amount),
        discountAmount: Number(row.discountAmount ?? row.discount_amount),
        finalAmount: Number(row.finalAmount ?? row.final_amount),
    };
}

export class BookingService {
    constructor(
        private readonly bookingRepo: IBookingRepository,
        private readonly bookingTxRepo: IBookingTxRepository,
        private readonly concertRepo: IConcertRepository,
    ) { }

    // ─── Customer: Tạo booking ─────────────────────────────────────────────────
    async createBooking(dto: CreateBookingDto): Promise<Result<BookingProps, DomainError>> {
        const existing = await this.bookingRepo.findByIdempotencyKey(dto.idempotencyKey);
        if (existing) {
            return ok(toBookingProps(existing));
        }

        try {
            const result = await db.transaction(async (tx) => {
                const tierRow = await this.bookingTxRepo.lockTicketTier(dto.ticketTierId, tx);
                if (!tierRow) return err(DomainErrors.notFound("Ticket tier"));

                const tier = TicketTier.fromRow(toTierProps(tierRow));

                const concertRow = await this.concertRepo.findById(tier.concertId);
                if (!concertRow) return err(DomainErrors.notFound("Concert"));

                const concert = Concert.fromRow(concertRow);
                if (!concert.isAcceptingBookings()) {
                    return err(DomainErrors.businessRule("Concert is not accepting bookings"));
                }

                if (!tier.hasAvailableQty(dto.quantity)) {
                    return err(DomainErrors.conflict(
                        `Not enough tickets. Available: ${tier.availableQty}, Requested: ${dto.quantity}`
                    ));
                }

                let discountAmount = 0;
                let voucherCode: string | null = null;

                if (dto.voucherCode) {
                    const voucherRow = await this.bookingTxRepo.lockVoucher(dto.voucherCode, tx);
                    if (!voucherRow) return err(DomainErrors.notFound("Voucher"));

                    const voucher = Voucher.fromRow(toVoucherProps(voucherRow));
                    const orderAmount = tier.price * dto.quantity;

                    const voucherValidation = voucher.validate({
                        orderAmount,
                        concertId: tier.concertId,
                    });
                    if (voucherValidation.isErr()) return err(voucherValidation.error);

                    const alreadyUsed = await this.bookingTxRepo.hasUserUsedVoucher(dto.userId, dto.voucherCode);
                    if (alreadyUsed) {
                        return err(DomainErrors.conflict("You have already used this voucher"));
                    }

                    discountAmount = voucher.calculateDiscount(orderAmount);
                    voucherCode = dto.voucherCode;

                    await this.bookingTxRepo.incrementVoucherUsed(dto.voucherCode, tx);
                }

                const bookingResult = Booking.create({
                    id: uuidv4(),
                    userId: dto.userId,
                    ticketTierId: dto.ticketTierId,
                    concertId: tier.concertId,
                    quantity: dto.quantity,
                    unitPrice: tier.price,
                    discountAmount,
                    voucherCode,
                    idempotencyKey: dto.idempotencyKey,
                });
                if (bookingResult.isErr()) return err(bookingResult.error);

                const booking = bookingResult.value;

                await this.bookingTxRepo.incrementReserved(dto.ticketTierId, dto.quantity, tx);

                const savedRow = await this.bookingTxRepo.saveInTx({
                    ...booking.toPersistence(),
                    unitPrice: String(booking.unitPrice),
                    totalAmount: String(booking.totalAmount),
                    discountAmount: String(booking.discountAmount),
                    finalAmount: String(booking.finalAmount),
                }, tx);

                return ok(toBookingProps(savedRow));
            });

            if (result.isErr()) return err(result.error);

            await bookingQueue.add(
                "process-payment",
                { bookingId: result.value.id },
                {
                    delay: 2_000,
                    attempts: 3,
                    backoff: { type: "exponential", delay: 1_000 },
                    jobId: `payment-${result.value.id}`,
                },
            );

            await bookingQueue.add(
                "auto-cancel",
                { bookingId: result.value.id },
                {
                    delay: 15 * 60 * 1_000,
                    jobId: `auto-cancel-${result.value.id}`,
                },
            );

            return ok(result.value);
        } catch (e: any) {
            if (e?.code === "23505") {
                const existing = await this.bookingRepo.findByIdempotencyKey(dto.idempotencyKey);
                if (existing) return ok(toBookingProps(existing));
            }
            throw e;
        }
    }

    // ─── Customer: Xem booking của mình ───────────────────────────────────────
    async getMyBookings(userId: string, page: number, limit: number) {
        const { rows, total } = await this.bookingRepo.findByUserId(userId, page, limit);
        return {
            bookings: rows.map(r => Booking.fromRow(toBookingProps(r)).toPersistence()),
            total, page, limit,
        };
    }

    async getBookingById(id: string, userId: string, isAdmin: boolean): Promise<Result<BookingProps, DomainError>> {
        const row = await this.bookingRepo.findById(id);
        if (!row) return err(DomainErrors.notFound("Booking"));

        const booking = Booking.fromRow(toBookingProps(row));
        // Customer chỉ xem được booking của mình
        if (!isAdmin && booking.userId !== userId) {
            return err(DomainErrors.forbidden("You can only view your own bookings"));
        }
        return ok(booking.toPersistence());
    }

    // ─── Customer: Huỷ booking của mình ───────────────────────────────────────
    async cancelMyBooking(id: string, userId: string): Promise<Result<BookingProps, DomainError>> {
        const row = await this.bookingRepo.findById(id);
        if (!row) return err(DomainErrors.notFound("Booking"));

        const booking = Booking.fromRow(toBookingProps(row));
        if (booking.userId !== userId) {
            return err(DomainErrors.forbidden("You can only cancel your own bookings"));
        }

        const cancelResult = booking.cancel();
        if (cancelResult.isErr()) return err(cancelResult.error);

        if (booking.needsInventoryRelease()) {
            await db.transaction(async (tx) => {
                await this.bookingTxRepo.decrementSold(booking.ticketTierId, booking.quantity, tx);
                await this.bookingRepo.updateStatus(id, "cancelled");
            });
        } else {
            await this.bookingRepo.updateStatus(id, "cancelled");
        }

        const updated = await this.bookingRepo.findById(id);
        return ok(toBookingProps(updated!));
    }

    // ─── Ops: Xem tất cả bookings ─────────────────────────────────────────────
    async listAllBookings(filter: ListBookingsFilter) {
        const { rows, total } = await this.bookingRepo.findAll(filter);
        return {
            bookings: rows.map(r => Booking.fromRow(toBookingProps(r)).toPersistence()),
            total,
            page: filter.page,
            limit: filter.limit,
        };
    }

    // ─── Ops: Update status thủ công ──────────────────────────────────────────
    async updateBookingStatus(
        id: string,
        dto: UpdateBookingStatusDto,
    ): Promise<Result<BookingProps, DomainError>> {
        const row = await this.bookingRepo.findById(id);
        if (!row) return err(DomainErrors.notFound("Booking"));

        const booking = Booking.fromRow(toBookingProps(row));

        let transitioned: Booking;
        switch (dto.status) {
            case "confirmed": {
                const r = booking.confirm();
                if (r.isErr()) return err(r.error);
                transitioned = r.value;
                break;
            }
            case "cancelled": {
                const r = booking.cancel();
                if (r.isErr()) return err(r.error);
                transitioned = r.value;
                if (booking.needsInventoryRelease()) {
                    await db.transaction(async (tx) => {
                        await this.bookingTxRepo.decrementSold(booking.ticketTierId, booking.quantity, tx); // 👈 đổi
                    });
                }
                break;
            }
            case "failed": {
                const r = booking.fail();
                if (r.isErr()) return err(r.error);
                transitioned = r.value;
                break;
            }
        }

        const updated = await this.bookingRepo.updateStatus(id, dto.status);
        if (!updated) return err(DomainErrors.notFound("Booking"));
        return ok(toBookingProps(updated));
    }

    // ─── Ops: Flag / unflag booking ───────────────────────────────────────────
    async flagBooking(id: string, reason: string): Promise<Result<BookingProps, DomainError>> {
        const row = await this.bookingRepo.findById(id);
        if (!row) return err(DomainErrors.notFound("Booking"));

        const booking = Booking.fromRow(toBookingProps(row));
        const flagResult = booking.flag(reason);
        if (flagResult.isErr()) return err(flagResult.error);

        const updated = await this.bookingRepo.updateStatus(id, booking.status, {
            isFlagged: true,
            flagReason: reason,
        });
        return ok(toBookingProps(updated!));
    }

    async unflagBooking(id: string): Promise<Result<BookingProps, DomainError>> {
        const row = await this.bookingRepo.findById(id);
        if (!row) return err(DomainErrors.notFound("Booking"));

        const updated = await this.bookingRepo.updateStatus(id, row.status, {
            isFlagged: false,
            flagReason: null,
        });
        return ok(toBookingProps(updated!));
    }
}