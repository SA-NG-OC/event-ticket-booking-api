# Concert Booking Platform — Backend

Backend API cho nền tảng đặt vé xem hòa nhạc trực tuyến, bao gồm customer-facing booking flows và internal ops dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| Framework | Express |
| ORM | Drizzle ORM |
| Database | PostgreSQL 16 |
| Queue / Worker | BullMQ + Redis 7 |
| Validation | Zod |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| API Docs | Swagger UI (`/api-docs`) |
| Testing | Vitest + Supertest |
| API Collection | Bruno |
| Architecture | DDD-lite (Domain / Application / Infrastructure / Interface) |

---

## Yêu cầu môi trường

- Node.js >= 20
- Docker + Docker Compose

---

## Thiết lập local lần đầu

### 1. Clone và cài dependencies

```bash
git clone <repo-url>
cd event-ticket-booking-api
npm install
```

### 2. Tạo file môi trường

```bash
cp .env.example .env
```

Kiểm tra lại các giá trị trong `.env` — mặc định đã khớp với Docker Compose:

```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=5433
DB_USER=concert_user
DB_PASSWORD=concert_pass
DB_NAME=concert_db
DATABASE_URL=postgresql://concert_user:concert_pass@localhost:5433/concert_db

TEST_DB_HOST=localhost
TEST_DB_PORT=5434
TEST_DB_NAME=concert_test_db
TEST_DATABASE_URL=postgresql://concert_user:concert_pass@localhost:5434/concert_test_db

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=supersecretkey
JWT_EXPIRES_IN=7d
```

### 3. Khởi động infrastructure (PostgreSQL + Redis)

```bash
docker compose up -d
```

Kiểm tra health:

```bash
docker compose ps
# postgres và redis phải ở trạng thái "healthy"
```

### 4. Chạy migration

```bash
npm run db:migrate
```

### 5. Seed dữ liệu mẫu

```bash
npm run db:seed
```

### 6. Chạy dev server

```bash
# Chạy API server + BullMQ worker cùng lúc (recommended)
npm run dev:all

# Hoặc chạy riêng lẻ
npm run dev          # API server tại http://localhost:3000
npm run dev:worker   # BullMQ worker (xử lý payment + auto-cancel)
```

**Swagger UI:** coi tại http://localhost:3000/api-docs sau khi chạy dự án, hoặc file merged-swagger.yml

---

## Chạy Tests

### Thiết lập test DB (chỉ cần làm 1 lần)

```bash
# Khởi động PostgreSQL test riêng biệt (port 5434)
docker compose -f docker-compose.test.yml up -d

# Chạy migration lên test DB
npm run db:migrate:test
```

### Chạy test

```bash
# Chạy toàn bộ test suite
npm test

# Watch mode — tự re-run khi save file
npm run test:watch

# Với coverage report
npm run test:coverage

# Chạy 1 file test cụ thể
npm test tests/integration/booking.test.ts
npm test tests/integration/voucher.test.ts
```

> **Lưu ý:** Integration tests dùng real PostgreSQL (port 5434) và real Redis. Đảm bảo cả hai đang chạy trước khi chạy test.

### Xem test DB bằng Drizzle Studio

```bash
npm run studio:test
# Mở http://localhost:4984
```

---

## API Collection (Bruno)

Thư mục `bruno/` chứa toàn bộ request collection.

### Cài Bruno

Tải tại [usebruno.com](https://www.usebruno.com/) hoặc:

```bash
# macOS
brew install bruno

# Windows / Linux: download tại usebruno.com
```

### Import và chạy

1. Mở Bruno → **Open Collection** → chọn thư mục `bruno/`
2. Chọn environment **Local**
3. Chạy theo thứ tự:
   - `auth/login` → cập nhật token nếu cần
   - Các request khác dùng `{{accessToken}}` hoặc `{{accessTokenAdmin}}` tự động

> Script `after-response` trong mỗi `.bru` file sẽ tự lưu token — không cần copy thủ công.

---

## Cấu trúc project

```
├── docs/
│   ├── paths/
│   │   ├── auth.yml
│   │   ├── bookings.yml
│   │   ├── concerts.yml
│   │   └── vouchers.yml
│   └── swagger.yml
├── src/
│   ├── config/
│   ├── docs/
│   ├── infrastructure/
│   │   ├── db/
│   │   ├── queue/
│   │   └── redis/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── interface/
│   │   ├── concert/
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   │   ├── concert.repository.ts
│   │   │   │   └── concert.mapper.ts     # toTierProps (+ toConcertProps nếu có)
│   │   │   └── interface/
│   │   ├── booking/
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   │   └── booking.service.ts    # import từ mapper, không còn inline helpers
│   │   │   ├── infrastructure/
│   │   │   │   ├── booking.repository.ts
│   │   │   │   └── booking.mapper.ts     # toBookingProps
│   │   │   └── interface/
│   │   └── voucher/
│   │       ├── domain/
│   │       ├── application/
│   │       ├── infrastructure/
│   │       │   ├── voucher.repository.ts
│   │       │   └── voucher.mapper.ts     # toVoucherProps
│   │       └── interface/
│   ├── shared/
│   │   ├── errors/
│   │   ├── middleware/
│   │   └── result.ts
│   ├── tests/
│   │   ├── integration/
│   │   │   ├── auth.test.ts
│   │   │   ├── concert.test.ts
│   │   │   ├── booking.test.ts
│   │   │   └── voucher.test.ts
│   │   └── setup/
│   │       ├── global.ts
│   │       └── each.ts
│   ├── app.ts
│   └── worker.ts
├── .env
├── .env.example
...
```

---

## Coding Conventions

### Thêm một API mới — checklist theo thứ tự

```
1. domain/         — Entity method hoặc interface update
2. domain/         — IRepository: thêm method signature nếu cần
3. infrastructure/ — Repository: implement method mới
4. application/    — Service: business logic, gọi repo, trả Result<T>
5. interface/      — Zod schema validation
6. interface/      — Controller method (unwrap Result → HTTP response)
7. interface/      — Route: wire middleware + controller
8. docs/           — Cập nhật YAML file tương ứng
9. tests/          — Viết test case
```

### Pattern nhất quán trong mọi module

**Repository** — chỉ CRUD, trả raw DB row:
```typescript
// Đúng
async findById(id: string): Promise<UserRow | undefined>

// Sai — repo không throw DomainError
async findById(id: string): Promise<Result<User, DomainError>>
```

**Service** — nhận raw row từ repo, reconstruct entity, xử lý business logic:
```typescript
const row = await this.repo.findById(id);
if (!row) return err(DomainErrors.notFound("Resource")); // service quyết định lỗi gì

const entity = MyEntity.fromRow(row);                    // reconstruct entity
const result = entity.someTransition();                  // domain logic
if (result.isErr()) return err(result.error);

const updated = await this.repo.update(id, result.value.toPersistence());
return ok(updated);
```

**Entity** — constructor private, chỉ tạo qua static factory:
```typescript
// ✅ Tạo mới — có validation, trả Result
const result = MyEntity.create({ ... });   // Result<MyEntity, DomainError>

// ✅ Reconstruct từ DB — không validate lại
const entity = MyEntity.fromRow(dbRow);   // MyEntity (không fail)

// ✅ State transition — trả Result để caller xử lý
const next = entity.someTransition();     // Result<MyEntity, DomainError>
```

**Controller** — không có try/catch, không có business logic:
```typescript
myAction = async (req: Request, res: Response) => {
  const result = await this.service.doSomething(req.body);
  if (result.isErr()) {
    res.status(domainErrorToStatus(result.error))
       .json({ success: false, ...result.error });
    return;
  }
  res.status(201).json({ success: true, data: result.value });
};
```

### Numeric fields từ Drizzle

PostgreSQL `numeric` column trả về `string` từ pg driver. Convention trong project:

```typescript
// Khi đọc từ DB row → entity
price: Number(row.price)

// Khi persist entity → DB
price: String(entity.price)
```

### Error HTTP mapping

| DomainError type | HTTP status |
|---|---|
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `VALIDATION` | 400 |
| `BUSINESS_RULE` | 422 |
| `FORBIDDEN` | 403 |
| `UNAUTHORIZED` | 401 |

---

## Scripts tham khảo nhanh

```bash
npm run dev:all          # Chạy server + worker (dev)
npm run db:generate      # Tạo migration mới từ schema changes
npm run db:migrate       # Apply migration lên dev DB
npm run db:seed          # Seed dữ liệu mẫu
npm run db:studio        # Drizzle Studio cho dev DB
npm run db:migrate:test  # Apply migration lên test DB
npm run studio:test      # Drizzle Studio cho test DB (port 4984)
npm test                 # Chạy toàn bộ test
npm run test:coverage    # Test + coverage report
```
