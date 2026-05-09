import { Router } from "express";
import { UserRepository } from "../infrastructure/user.repository";
import { validate } from "@/shared/middleware/validate.middleware";
import { authenticate } from "@/shared/middleware/auth.middleware";
import { AuthService } from "../application/auth.service";
import { AuthController } from "./auth.controller";
import { LoginSchema, RegisterSchema } from "./auth.schema";

const authRoutes = Router();

// Dependency wiring (manual DI — không cần container với scope này)
const userRepo = new UserRepository();
const authSvc = new AuthService(userRepo);
const authCtrl = new AuthController(authSvc);

authRoutes.post("/register", validate(RegisterSchema), authCtrl.register);
authRoutes.post("/login", validate(LoginSchema), authCtrl.login);
authRoutes.get("/me", authenticate, authCtrl.me);

export { authRoutes };