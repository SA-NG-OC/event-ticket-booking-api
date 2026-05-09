import { ok, err, Result, DomainErrors, DomainError } from "@/shared/result";

export type UserRole = "customer" | "admin";

export interface UserProps {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}

export class User {
    private constructor(private readonly props: UserProps) { }

    get id() { return this.props.id; }
    get email() { return this.props.email; }
    get passwordHash() { return this.props.passwordHash; }
    get name() { return this.props.name; }
    get role() { return this.props.role; }
    get createdAt() { return this.props.createdAt; }
    get updatedAt() { return this.props.updatedAt; }

    static fromRow(row: UserProps): User {
        return new User(row);
    }

    static create(params: {
        id: string;
        email: string;
        passwordHash: string;
        name: string;
        role?: UserRole;
    }): Result<User, DomainError> {
        if (!params.email.includes("@")) {
            return err(DomainErrors.validation("Invalid email format"));
        }
        if (params.name.trim().length < 2) {
            return err(DomainErrors.validation("Name must be at least 2 characters"));
        }
        if (params.passwordHash.length === 0) {
            return err(DomainErrors.validation("Password hash cannot be empty"));
        }

        return ok(new User({
            id: params.id,
            email: params.email.toLowerCase().trim(),
            passwordHash: params.passwordHash,
            name: params.name.trim(),
            role: params.role ?? "customer",
            createdAt: new Date(),
            updatedAt: new Date(),
        }));
    }

    // ── Domain behaviour ──────────────────────────────────────────────────────
    isAdmin(): boolean {
        return this.props.role === "admin";
    }

    // Return plain object để persist — không expose props trực tiếp
    toPersistence(): UserProps {
        return { ...this.props };
    }
}