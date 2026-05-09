import { QueueEvents } from "bullmq";
import { bullRedis } from "@/infrastructure/redis";

export const bookingQueueEvents = new QueueEvents("booking", {
    connection: bullRedis,
});

bookingQueueEvents.on("completed", ({ jobId }) => {
    console.log(`Queue Event: Job completed ${jobId}`);
});

bookingQueueEvents.on("failed", ({ jobId, failedReason }) => {
    console.error(`Queue Event: Job failed ${jobId}`, failedReason);
});

bookingQueueEvents.on("stalled", ({ jobId }) => {
    console.warn(`Queue Event: Job stalled ${jobId}`);
});