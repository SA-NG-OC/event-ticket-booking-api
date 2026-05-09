import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { users, UserRow, NewUserRow } from "@/infrastructure/db/schema/users";
import { IUserRepository } from "../domain/user.repository.interface";

export class UserRepository implements IUserRepository {
    async findById(id: string): Promise<UserRow | undefined> {
        return db.query.users.findFirst({ where: eq(users.id, id) });
    }

    async findByEmail(email: string): Promise<UserRow | undefined> {
        return db.query.users.findFirst({
            where: eq(users.email, email.toLowerCase().trim()),
        });
    }

    async save(data: NewUserRow): Promise<UserRow> {
        const [row] = await db
            .insert(users)
            .values(data)
            .onConflictDoUpdate({
                target: users.id,
                set: {
                    name: data.name,
                    passwordHash: data.passwordHash,
                    updatedAt: new Date(),
                },
            })
            .returning();
        return row;
    }

    async existsByEmail(email: string): Promise<boolean> {
        const row = await db.query.users.findFirst({
            where: eq(users.email, email.toLowerCase().trim()),
        });
        return !!row;
    }
}