import { UserRow, NewUserRow } from "@/infrastructure/db/schema/users";

export interface IUserRepository {
    findById(id: string): Promise<UserRow | undefined>;
    findByEmail(email: string): Promise<UserRow | undefined>;
    save(data: NewUserRow): Promise<UserRow>;
    existsByEmail(email: string): Promise<boolean>;
}