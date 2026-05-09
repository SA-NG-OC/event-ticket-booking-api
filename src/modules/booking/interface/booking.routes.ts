import { Router } from "express";
import { BookingRepository, BookingTxRepository } from "../infrastructure/booking.repository";
import { ConcertRepository } from "@/modules/concert/infrastructure/concert.repository";
import { validate } from "@/shared/middleware/validate.middleware";
import { authenticate, requireAdmin, requireCustomer } from "@/shared/middleware/auth.middleware";
import { BookingService } from "../application/booking.service";
import { BookingController } from "./booking.controller";
import { BookingIdSchema, CreateBookingSchema, FlagBookingSchema, ListBookingsSchema, UpdateStatusSchema } from "./booking.schema";

const router = Router();

const bookingRepo = new BookingRepository();
const bookingTxRepo = new BookingTxRepository();
const concertRepo = new ConcertRepository();
const bookingSvc = new BookingService(bookingRepo, bookingTxRepo, concertRepo);
const bookingCtrl = new BookingController(bookingSvc);

// ── Customer routes ───────────────────────────────────────────────────────────
router.post("/", authenticate, requireCustomer, validate(CreateBookingSchema), bookingCtrl.createBooking);
router.get("/my", authenticate, requireCustomer, validate(ListBookingsSchema), bookingCtrl.getMyBookings);
router.get("/:id", authenticate, requireCustomer, validate(BookingIdSchema), bookingCtrl.getBookingById);
router.patch("/:id/cancel", authenticate, requireCustomer, validate(BookingIdSchema), bookingCtrl.cancelMyBooking);

// ── Ops / Admin routes ────────────────────────────────────────────────────────
router.get("/", authenticate, requireAdmin, validate(ListBookingsSchema), bookingCtrl.listAllBookings);
router.patch("/:id/status", authenticate, requireAdmin, validate(UpdateStatusSchema), bookingCtrl.updateBookingStatus);
router.patch("/:id/flag", authenticate, requireAdmin, validate(FlagBookingSchema), bookingCtrl.flagBooking);
router.patch("/:id/unflag", authenticate, requireAdmin, validate(BookingIdSchema), bookingCtrl.unflagBooking);

export { router as bookingRoutes };