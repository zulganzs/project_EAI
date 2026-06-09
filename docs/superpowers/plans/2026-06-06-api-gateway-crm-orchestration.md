# Agile Plan — Eka (API Gateway + CRM + Orchestration Assets)

## 0. Ringkasan Peran Eka
Eka memegang domain **API Gateway (Node.js)** sebagai *integration entry point* + **CRM (Reservasi Meja) service** serta artefak integrasi yang bersifat lintas tim agar semua komponen bisa jalan satu perintah (docker-compose) dan tidak hardcode konfigurasi.

Fokus utama: memastikan **API-led integration** berjalan (routing sinkron via REST), dan sistem siap dinilai dari sisi **containerization, konfigurasi .env, dokumentasi endpoint, serta arsitektur EIP (Gateway + Content-Based Router)**.

---

## 1. Sprint Setup

### Durasi & Metode
Menggunakan Agile (mini-sprint) selama **1 minggu kerja efektif** pada progress minggu kedua, dengan target *incremental delivery* harian.

### Sprint Goal
Pada akhir sprint, sistem memiliki:

- **API Gateway** yang merutekan request ke POS/Inventory/CRM berdasarkan path/content (Content-Based Router).
- **CRM Reservasi** berjalan sebagai microservice mandiri dengan DB sendiri.
- **docker-compose.yml** yang dapat menjalankan seluruh stack (gateway + rabbitmq + semua service + semua DB) dengan satu perintah.
- Konfigurasi terpusat via **.env / env var** (tanpa hardcode endpoint/kredensial).

### Definition of Done (DoD) Eka
Sebuah item dianggap selesai jika:

- berjalan lokal dan di container,
- health check tersedia (minimal `/health`),
- tidak hardcode host/port/credential,
- endpoint terdokumentasi ringkas (README atau OpenAPI minimal),
- sudah diuji minimal melalui curl/Postman.

---

## 2. Scope Tugas Eka (Week 2)

### In Scope

- Node.js **API Gateway**
- Implementasi **routing** (Content-Based Router) untuk:
  - `/api/pos/**` → POS service
  - `/api/inventory/**` → Inventory service
  - `/api/crm/**` → CRM service
- *Optional* transform ringan di gateway bila diperlukan (mis. header trace id, correlation id)
- CRM service (Node.js + React UI CRM) untuk reservasi table
- Database terpisah untuk CRM (MySQL, sesuai konteks tim)
- `.env.example` lintas stack + standarisasi nama env
- `docker-compose.yml` integrasi seluruh container + volumes
- Dokumentasi endpoint gateway dan CRM

### Out of Scope

- Logika POS (Zul), Inventory (Jabriel), Accounting C# + DLQ/Idempotency (Galih)
- Implementasi subscriber RabbitMQ pada Inventory/Accounting

---

## 3. Backlog Eka (Prioritas Tinggi → Rendah)

| ID | Backlog Item | Output | Prioritas | Estimasi |
|---|---|---|---:|---:|
| E-01 | Standarisasi kontrak route & base URL antar service | doc singkat + env keys | Tinggi | 0.5 hari |
| E-02 | Scaffold API Gateway Node.js | repo + struktur folder | Tinggi | 0.5 hari |
| E-03 | Implementasi Content-Based Router (path-based) | routing rules + proxy | Tinggi | 1 hari |
| E-04 | Tambah observability dasar (trace/correlation id) | middleware | Sedang | 0.5 hari |
| E-05 | CRM Backend (reservasi CRUD minimal) | REST API + DB schema | Tinggi | 1 hari |
| E-06 | CRM Frontend React (UI sederhana) | halaman list + create | Sedang | 1 hari |
| E-07 | Dockerfile Gateway + Dockerfile CRM | 2 Dockerfile | Tinggi | 0.5 hari |
| E-08 | Docker Compose master (orchestration) | `docker-compose.yml` + volumes | Tinggi | 1 hari |
| E-09 | Dokumentasi endpoint & cara run | README / OpenAPI minimal | Tinggi | 0.5 hari |
| E-10 | Integrasi test end-to-end via Gateway | bukti uji + checklist | Tinggi | 0.5 hari |

---

## 4. Sprint Plan Harian (Paralel-Friendly)

### Day 1 — Kontrak Integrasi & Skeleton
Target: semua tim bisa jalan paralel tanpa menunggu alamat service final.

Pekerjaan:

- Tentukan standar route gateway (prefix) dan port default per service.
- Buat **.env.example** awal berisi host/port service, RabbitMQ, dan DB.
- Buat skeleton API Gateway Node.js:
  - `/health`
  - middleware logging
  - placeholder route mapping

Output:

- repo gateway siap,
- dokumen mapping route (singkat) dibagikan ke tim.

### Day 2 — Gateway Routing (EIP: Content-Based Router)
Target: request dapat diteruskan ke service lain lewat satu pintu.

Pekerjaan:

- Implementasi routing berbasis path:
  - `/api/pos/*` → `POS_BASE_URL`
  - `/api/inventory/*` → `INVENTORY_BASE_URL`
  - `/api/crm/*` → `CRM_BASE_URL`
- Pastikan request method + headers + body diteruskan dengan benar.
- Tambahkan timeout dan error mapping (gateway → client).

Output:

- API Gateway dapat mem-forward request ke dummy endpoint atau mock.

### Day 3 — CRM Backend (Reservasi)
Target: CRM service mandiri dengan DB sendiri.

Pekerjaan:

- Desain schema MySQL untuk reservasi (minimal):
  - `reservation_id` (UUID atau auto)
  - `customer_name`
  - `phone` (optional)
  - `party_size`
  - `reservation_time`
  - `table_number` (optional)
  - `status` (BOOKED/CANCELLED/COMPLETED)
  - `created_at`
- Endpoint minimal:
  - `POST /api/crm/reservations`
  - `GET /api/crm/reservations`
  - `GET /api/crm/reservations/:id`
  - `PATCH /api/crm/reservations/:id` (ubah status)
  - `/health`

Output:

- CRM backend dapat berjalan dan CRUD minimal berfungsi.

### Day 4 — CRM Frontend React
Target: UI CRM fungsional untuk demo.

Pekerjaan:

- UI list reservasi.
- Form create reservasi.
- Update status (minimal tombol cancel/complete).
- Arahkan request melalui API Gateway (bukan langsung ke CRM) untuk menunjukkan pola Gateway.

Output:

- Demo reservasi via browser → API Gateway → CRM backend → DB.

### Day 5 — Containerization & Compose
Target: "one command run" untuk penilaian.

Pekerjaan:

- Buat Dockerfile untuk Gateway dan CRM.
- Buat `docker-compose.yml` master:
  - network internal
  - service gateway
  - service crm + db crm
  - rabbitmq + management
  - integrasi dengan service pos/inventory/accounting (service lain bisa dummy dulu jika belum final)
  - volumes untuk DB dan RabbitMQ
- Pastikan env var tidak hardcode.
- Tambahkan healthcheck di compose bila memungkinkan.

Output:

- `docker compose up -d` menyalakan stack inti.

### Day 6 — Dokumentasi & Hardening
Target: meningkatkan nilai dokumentasi dan kemudahan replikasi.

Pekerjaan:

- Tambahkan README bagian:
  - daftar service + port
  - contoh curl via gateway
  - env var penting
- Tambahkan OpenAPI/Swagger minimal (boleh berupa json/yaml statis) untuk gateway dan CRM.
- Rapikan error response gateway agar jelas saat service downstream mati.

Output:

- dokumentasi siap untuk deliverable.

### Day 7 — Final Integration Test (dengan Tim)
Target: memastikan tidak ada blocking sebelum demo video.

Pekerjaan:

- Uji:
  - UI POS → Gateway → POS (oleh Zul) minimal endpoint
  - UI CRM → Gateway → CRM
  - Gateway tidak akses DB service lain
- Verifikasi:
  - `.env` lengkap
  - route mapping sesuai
  - container build bersih

Output:

- checklist "siap demo" + bukti screenshot/log.

---

## 5. Artefak Teknis yang Harus Disiapkan Eka

### 5.1 Environment Variables (Rekomendasi Minimal)

```bash
# Gateway
GATEWAY_PORT=3000
POS_BASE_URL=http://pos:3001
INVENTORY_BASE_URL=http://inventory:3002
CRM_BASE_URL=http://crm:3003

# CRM DB
CRM_DB_HOST=crm-mysql
CRM_DB_PORT=3306
CRM_DB_NAME=crm_db
CRM_DB_USER=root
CRM_DB_PASSWORD=secret

# RabbitMQ (dipakai lintas service)
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_MANAGEMENT_PORT=15672
```

Catatan: Nama host mengikuti nama service di docker-compose agar resolvable via network internal.

### 5.2 Kontrak Endpoint Gateway

- `/health`
- `/api/pos/*` → forward ke POS
- `/api/inventory/*` → forward ke Inventory
- `/api/crm/*` → forward ke CRM

### 5.3 EIP yang "Terlihat" di Implementasi Eka

- **Gateway**: API Gateway sebagai single entry point.
- **Content-Based Router**: routing berdasarkan path/tipe request.
- (Opsional) **Message Endpoint** (di sisi gateway jika menambahkan endpoint publish ke broker, tapi ini tidak wajib karena POS sudah publish langsung).

---

## 6. Risiko & Mitigasi

Jika service POS/Inventory belum stabil, gateway masih bisa diuji menggunakan dummy endpoint atau mock container, sehingga pekerjaan Eka tidak tertahan.

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Base URL/port service lain berubah | routing gateway rusak | semua diatur via `.env`, tidak hardcode |
| Gateway proxy body parsing bermasalah | request POST gagal | gunakan forward raw body/stream bila perlu; uji dengan payload POS |
| CRM UI butuh waktu lama | demo terlambat | UI minimal: list + create + update status |
| Compose kompleks dan conflict port | sulit run | definisikan port eksternal hanya untuk gateway dan rabbitmq management |

---

## 7. Output Deliverable Eka
Pada akhir sprint, Eka menyerahkan:

- Kode API Gateway (Node.js) + Dockerfile
- Kode CRM backend (Node.js) + Dockerfile
- CRM frontend React (UI sederhana)
- `docker-compose.yml` master (atau kontribusi signifikan pada file master)
- `.env.example` + daftar env var
- README/OpenAPI minimal untuk gateway dan CRM
- Bukti testing (curl/Postman + screenshot rabbitmq management bila relevan)

---

## 8. Checklist Cepat untuk Penilaian UAS

- Gateway benar-benar jadi satu pintu masuk (UI mengakses via gateway).
- CRM punya DB sendiri dan tidak diakses langsung oleh service lain.
- Semua konfigurasi endpoint/kredensial via env.
- Docker compose up bisa menjalankan stack.
- Ada diagram arsitektur (bisa dibuat tim, tapi Eka bantu memastikan mapping sesuai implementasi).
