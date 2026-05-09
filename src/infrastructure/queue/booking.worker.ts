import { Worker, Job } from "bullmq";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/infrastructure/db";
import { bookings } from "@/infrastructure/db/schema/bookings";
import { ticketTiers } from "@/infrastructure/db/schema/concerts";

import { bullRedis } from "@/infrastructure/redis";

interface PaymentJobData {
    bookingId: string;
}

interface AutoCancelData {
    bookingId: string;
}

async function handleProcessPayment(job: Job<PaymentJobData>) {
    const { bookingId } = job.data;

    const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
    });

    if (!booking || booking.status !== "pending") {
        return;
    }

    const isSuccess = Math.random() < 0.9;

    if (isSuccess) {
        await db.transaction(async (tx) => {
            const result = await tx
                .update(bookings)
                .set({
                    status: "confirmed",
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(bookings.id, bookingId),
                        eq(bookings.status, "pending"),
                    ),
                )
                .returning({ id: bookings.id });

            if (result.length === 0) {
                console.log(`Booking already processed: ${bookingId}`);
                return;
            }

            await tx
                .update(ticketTiers)
                .set({
                    reservedQty: sql`GREATEST(0, reserved_qty - ${booking.quantity})`,
                    soldQty: sql`sold_qty + ${booking.quantity}`,
                    updatedAt: new Date(),
                })
                .where(eq(ticketTiers.id, booking.ticketTierId));
        });

        console.log(`Payment confirmed: ${bookingId}`);
    } else {
        await db.transaction(async (tx) => {
            const updated = await tx
                .update(bookings)
                .set({
                    status: "failed",
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(bookings.id, bookingId),
                        eq(bookings.status, "pending"),
                    ),
                )
                .returning({ id: bookings.id });

            if (updated.length === 0) {
                return;
            }

            await tx
                .update(ticketTiers)
                .set({
                    reservedQty: sql`GREATEST(0, reserved_qty - ${booking.quantity})`,
                    updatedAt: new Date(),
                })
                .where(eq(ticketTiers.id, booking.ticketTierId));
        });

        console.log(`Payment failed: ${bookingId}`);
    }
}

async function handleAutoCancel(job: Job<AutoCancelData>) {
    const { bookingId } = job.data;

    const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
    });

    if (!booking || booking.status !== "pending") {
        return;
    }

    await db.transaction(async (tx) => {
        const updated = await tx
            .update(bookings)
            .set({
                status: "cancelled",
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(bookings.id, bookingId),
                    eq(bookings.status, "pending"),
                ),
            )
            .returning({
                id: bookings.id,
            });

        if (updated.length === 0) {
            return;
        }

        await tx
            .update(ticketTiers)
            .set({
                reservedQty: sql`
                    GREATEST(
                        0,
                        reserved_qty - ${booking.quantity}
                    )
                `,
                updatedAt: new Date(),
            })
            .where(eq(ticketTiers.id, booking.ticketTierId));
    });

    console.log(`Booking auto-cancelled: ${bookingId}`);
}

export function startBookingWorker() {
    const worker = new Worker(
        "booking",
        async (job) => {
            switch (job.name) {
                case "process-payment":
                    return handleProcessPayment(job);

                case "auto-cancel":
                    return handleAutoCancel(job);

                default:
                    console.warn(`Unknown job: ${job.name}`);
            }
        },
        {
            connection: bullRedis,
            concurrency: 10,
        },
    );

    worker.on("completed", (job) => {
        console.log(`Job completed: ${job.id}`);
    });

    worker.on("failed", (job, err) => {
        console.error(`Job failed ${job?.id}:`, err.message);
    });

    return worker;
}