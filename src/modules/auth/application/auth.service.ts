import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { ok, err, Result, DomainErrors, DomainError } from "@/shared/result";
import { config } from "@/config";
import { User } from "../domain/user.entity";
import { IUserRepository } from "../domain/user.repository.interface";

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export class AuthService {
  constructor(private readonly userRepo: IUserRepository) { }

  async register(dto: RegisterDto): Promise<Result<AuthTokens, DomainError>> {
    const exists = await this.userRepo.existsByEmail(dto.email);
    if (exists) return err(DomainErrors.conflict("Email already registered"));

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Service gọi Entity.create() — domain validation xảy ra ở đây
    const userResult = User.create({
      id: uuidv4(),
      email: dto.email,
      passwordHash,
      name: dto.name,
    });
    if (userResult.isErr()) return err(userResult.error);

    const user = userResult.value;

    // Repo chỉ nhận plain data để persist
    try {
      const row = await this.userRepo.save(user.toPersistence());
      // Service reconstruct Entity từ row trả về
      const savedUser = User.fromRow(row);
      return ok(this._generateTokens(savedUser));
    } catch (e: any) {
      if (e?.code === "23505") {
        return err(DomainErrors.conflict("Email already registered"));
      }
      return err(DomainErrors.businessRule("Failed to save user"));
    }
  }

  async login(dto: LoginDto): Promise<Result<AuthTokens, DomainError>> {
    const row = await this.userRepo.findByEmail(dto.email);

    // Repo trả undefined → Service quyết định đây là domain error gì
    if (!row) {
      return err(DomainErrors.unauthorized("Invalid email or password"));
    }

    // Service reconstruct Entity để dùng domain methods
    const user = User.fromRow(row);

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      return err(DomainErrors.unauthorized("Invalid email or password"));
    }

    return ok(this._generateTokens(user));
  }

  private _generateTokens(user: User): AuthTokens {
    const payload = { sub: user.id, role: user.role };
    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    });
    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }
}