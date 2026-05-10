import "dotenv/config";

import express from "express";
import swaggerUi from "swagger-ui-express";

import { config } from "@/config";

import { redis } from "@/infrastructure/redis";

import { loadOpenApiDocument } from "@/docs/swagger";

import { errorMiddleware } from "@/shared/middleware/error.middleware";

import { authRoutes } from "@/modules/auth/interface/auth.routes";
import { concertRoutes } from "@/modules/concert/interface/concert.routes";
import { bookingRoutes } from "./modules/booking/interface/booking.routes";
import { voucherRoutes } from "./modules/voucher/interface/voucher.routes";

// import { bookingRoutes } from "@/modules/booking/interface/booking.routes";
// import { voucherRoutes } from "@/modules/voucher/interface/voucher.routes";
// import { opsRoutes } from "@/modules/ops/interface/ops.routes";

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

app.use(
    express.urlencoded({
        extended: true,
    }),
);

// ── Swagger ───────────────────────────────────────────────────────────────────
const openApiDocument = loadOpenApiDocument();

app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument),
);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);

app.use("/concerts", concertRoutes);

app.use("/bookings", bookingRoutes);
app.use("/vouchers", voucherRoutes);
// app.use("/ops", opsRoutes);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    return res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
    });
});

// ── Global Error Handler (LUÔN đặt cuối cùng) ────────────────────────────────
app.use(errorMiddleware);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
    try {
        // connect redis app client
        await redis.connect();

        console.log("Redis connected");

        // start express server
        const server = app.listen(config.PORT, () => {
            console.log(
                `Server running at http://localhost:${config.PORT}`,
            );

            console.log(
                `Swagger UI available at http://localhost:${config.PORT}/api-docs`,
            );
        });

        // graceful shutdown
        const shutdown = async () => {
            console.log("Shutting down API server...");

            await redis.quit();

            server.close(() => {
                console.log("HTTP server closed");

                process.exit(0);
            });
        };

        process.on("SIGINT", shutdown);

        process.on("SIGTERM", shutdown);
    } catch (error) {
        console.error("Failed to bootstrap app:", error);

        process.exit(1);
    }
}

bootstrap();

export { app };