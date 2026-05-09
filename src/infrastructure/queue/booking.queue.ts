import { Queue } from "bullmq";
import { bullRedis } from "@/infrastructure/redis";

export const bookingQueue = new Queue("booking", {
    connection: bullRedis,
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
    },
});