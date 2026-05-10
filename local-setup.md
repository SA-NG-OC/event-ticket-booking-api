# Thiết lập & Chạy Dự án trên Máy Cá Nhân

> Concert Booking Platform — Backend

---

## Yêu cầu môi trường

- Node.js >= 20
- Docker + Docker Compose

---

## Thiết lập lần đầu

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

**Swagger UI:** http://localhost:3000/api-docs

---

## API Collection (Bruno)

Thư mục `bruno/` chứa toàn bộ request collection.

### Cài Bruno

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