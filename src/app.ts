import "dotenv/config";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { config } from "@/config";
import { errorMiddleware } from "@/shared/middleware/error.middleware";
import { openApiDocument } from "@/docs/swagger";
import { redis } from "@/infrastructure/redis";
import { authRoutes } from "./modules/auth/interface/auth.routes";

// ── Routes (sẽ import dần khi code từng module) ──────────────────────────────
// import { concertRoutes } from "@/modules/concert/interface/concert.routes";
// import { bookingRoutes } from "@/modules/booking/interface/booking.routes";
// import { voucherRoutes } from "@/modules/voucher/interface/voucher.routes";
// import { opsRoutes }     from "@/modules/ops/interface/ops.routes";

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API Routes ────────────────────────────────────────────────────────────────
// app.use("/api/v1/concerts",  concertRoutes);
// app.use("/api/v1/bookings",  bookingRoutes);
// app.use("/api/v1/vouchers",  voucherRoutes);
// app.use("/api/v1/ops",       opsRoutes);
app.use("/auth", authRoutes);

// ── Swagger UI ────────────────────────────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Global Error Handler (phải đặt CUỐI CÙNG) ────────────────────────────────
app.use(errorMiddleware);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
    await redis.connect();

    app.listen(config.PORT, () => {
        console.log(`Server running at http://localhost:${config.PORT}`);
        console.log(`Swagger UI   at http://localhost:${config.PORT}/api-docs`);
    });
}

bootstrap().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});

export { app }; 