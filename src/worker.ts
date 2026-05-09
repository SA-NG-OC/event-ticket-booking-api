import "dotenv/config";

import { bullRedis } from "@/infrastructure/redis";

import { startBookingWorker } from "@/infrastructure/queue/booking.worker";
import { bookingQueueEvents } from "./infrastructure/queue/booking.scheduler";

async function bootstrap() {
    console.log("Starting worker...");

    await bullRedis.connect();

    // init queue events
    bookingQueueEvents;

    // start worker
    const worker = startBookingWorker();

    console.log("Booking worker started");

    // graceful shutdown
    const shutdown = async () => {
        console.log("Shutting down worker...");

        await worker.close();
        await bookingQueueEvents.close();
        await bullRedis.quit();

        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

bootstrap().catch((err) => {
    console.error("Worker bootstrap failed:", err);
    process.exit(1);
});