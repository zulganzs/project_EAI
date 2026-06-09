# Agile Plan — Jabriel (Inventory Service + Event Subscriber + Choreography)

## 0. Ringkasan Peran Jabriel
Jabriel bertanggung jawab pada domain **Inventory (bahan baku kitchen)** sebagai microservice mandiri (Node.js + MySQL) dan bertindak sebagai **RabbitMQ event subscriber** untuk menjalankan pola **Event-Driven Choreography**.

Fokus utama Jabriel adalah memastikan business event dari POS (`TRANSAKSI_SELESAI`) memicu **pemotongan stok otomatis** secara real-time tanpa integrasi database langsung antar sistem.

---

## 1. Sprint Setup

### Durasi & Metode
Agile mini-sprint selama **1 minggu kerja efektif** (progress minggu kedua) dengan target keluaran harian yang bisa langsung diuji.

### Sprint Goal
Pada akhir sprint, Inventory service:

- menyediakan REST API untuk CRUD bahan baku dan melihat stok,
- memiliki DB sendiri (MySQL Inventory),
- subscribe event transaksi dari RabbitMQ,
- melakukan mapping CDM → kebutuhan inventory (menu → recipe/bom → bahan baku),
- mengurangi stok bahan baku secara otomatis saat event diterima,
- berjalan via Docker dan konfigurasi via env.

### Definition of Done (DoD) Jabriel
Satu backlog item dianggap selesai jika:

- bisa dijalankan lokal dan di container,
- endpoint/kredensial tidak hardcode,
- ada langkah uji jelas (publish event → stok berubah),
- ada bukti log/screenshot untuk demo.

---

## 2. Scope Tugas Jabriel (Week 2)

### In Scope

- Inventory backend Node.js (REST)
- Inventory DB MySQL (schema + init)
- RabbitMQ subscriber untuk event `TRANSAKSI_SELESAI`
- Logic pemotongan stok otomatis
- Mapping menu → komposisi bahan (recipe/BOM) minimal
- React UI sederhana untuk inventory (view stok + update stok)
- Dockerfile Inventory service

### Out of Scope

- Publisher POS (Zul)
- Accounting consumer + DLQ/idempotency (Galih)
- API Gateway routing (Eka)

---

## 3. Requirements (yang harus terlihat untuk penilaian)

### 3.1 Enterprise Integration Patterns (EIP) yang Dipenuhi Jabriel

- **Publish-Subscribe**: Inventory mendengar event yang sama dengan Accounting.
- **Message Channel**: konsumsi pesan dari queue/exchange.
- **Message Endpoint/Adapter**: subscriber Node.js.
- **Message Translator** (opsional ringan): CDM → internal inventory update model.

### 3.2 Core Business Rule
Ketika event `TRANSAKSI_SELESAI` diterima, Inventory harus:

- membaca `items[]` dari payload CDM,
- menerjemahkan item menu menjadi daftar bahan baku (recipe/BOM),
- mengurangi stok masing-masing bahan sesuai quantity,
- menyimpan perubahan ke DB Inventory,
- mencatat log transaksi stok (audit) agar bisa dibuktikan saat demo.

---

## 4. Backlog Jabriel (Prioritas Tinggi → Rendah)

| ID | Backlog Item | Output | Prioritas | Estimasi |
|---|---|---|---:|---:|
| J-01 | Finalisasi kontrak CDM & mapping item → recipe | doc mapping | Tinggi | 0.5 hari |
| J-02 | Scaffold Inventory backend Node.js | struktur project | Tinggi | 0.5 hari |
| J-03 | Desain schema MySQL Inventory | schema + init | Tinggi | 0.5 hari |
| J-04 | CRUD bahan baku + endpoint stok | REST API | Tinggi | 1 hari |
| J-05 | Model recipe/BOM sederhana | tabel recipe + seed | Tinggi | 0.5 hari |
| J-06 | RabbitMQ subscriber (consume) | consumer jalan | Tinggi | 1 hari |
| J-07 | Logic potong stok dari event | stock deduction | Tinggi | 1 hari |
| J-08 | Audit log pemotongan stok | table log | Sedang | 0.5 hari |
| J-09 | React UI inventory minimal | list + update | Sedang | 1 hari |
| J-10 | Dockerfile + env config | container build | Tinggi | 0.5 hari |
| J-11 | Integration test + demo steps | bukti uji | Tinggi | 0.5 hari |

---

## 5. Sprint Plan Harian (Paralel-Friendly)

### Day 1 — Kontrak Data & Skeleton Inventory
Target: Inventory bisa dikerjakan tanpa menunggu POS final.

Pekerjaan:

- Sepakati minimal field CDM yang dipakai Inventory:
  - `transaction_id`, `timestamp`, `items[{menu_id/menu_name, qty}]`, `trace_id`.
- Tentukan mapping awal menu → bahan baku (recipe/BOM) untuk demo (contoh 2–3 menu).
- Scaffold project backend Inventory.

Output:

- doc mapping recipe demo (mis. Steak → daging 1, kentang 1).
- project inventory siap.

### Day 2 — Schema DB + CRUD Bahan Baku
Target: inventory bisa dikelola via API.

Pekerjaan:

- Buat schema MySQL:
  - `ingredients(id, name, unit, stock_qty, updated_at)`
  - `recipes(id, menu_id, menu_name)` (opsional)
  - `recipe_items(recipe_id, ingredient_id, qty_per_menu)`
  - `stock_movements(id, ingredient_id, change_qty, reason, transaction_id, created_at)`
- Buat endpoint minimal:
  - `GET /health`
  - `GET /api/inventory/ingredients`
  - `POST /api/inventory/ingredients`
  - `PATCH /api/inventory/ingredients/:id` (update stok)

Output:

- CRUD berjalan (Postman/curl) dan data masuk DB.

### Day 3 — Recipe/BOM & Seed Data Demo
Target: ada basis mapping untuk potong stok otomatis.

Pekerjaan:

- Seed data ingredient + recipe demo:
  - Steak (menu_id M001) → daging 1, kentang 1
  - Nasi Goreng (M002) → beras 1, telur 1
- Buat helper service untuk resolve `items[]` menjadi list perubahan stok.

Output:

- query recipe menghasilkan daftar kebutuhan bahan untuk satu menu.

### Day 4 — RabbitMQ Subscriber
Target: Inventory bisa menerima event.

Pekerjaan:

- Implement RabbitMQ connection dan consumer.
- Parse payload CDM dan log event.
- Pastikan ack dilakukan setelah proses sukses.

Output:

- publish message dummy → inventory menerima.

### Day 5 — Otomatis Potong Stok (Choreography)
Target: nilai integrasi end-to-end terlihat.

Pekerjaan:

- Implement logic:
  - ambil `items[]`
  - resolve recipe
  - kurangi `ingredients.stock_qty`
  - tulis `stock_movements` (audit)
- Tangani edge cases minimal:
  - stok tidak cukup → log warning (untuk demo, boleh tetap potong sampai minus atau tolak, tapi harus konsisten dan didokumentasi)

Output:

- event masuk → stok bahan berkurang otomatis.

### Day 6 — React UI Inventory Minimal
Target: UI untuk demo dan verifikasi cepat.

Pekerjaan:

- UI list ingredients + stock_qty.
- tombol/field update stok.
- (opsional) tab "stock movements" untuk melihat log.
- Semua request sebaiknya lewat API Gateway (jika siap) agar memperkuat pola Gateway.

Output:

- stok bisa dilihat dan diverifikasi perubahan setelah event.

### Day 7 — Dockerization + Integration Test dengan Tim
Target: siap untuk demo video.

Pekerjaan:

- Buat Dockerfile inventory.
- Pastikan DB dan data persisten via volume.
- Uji integrasi:
  - POS publish event → Inventory potong stok
  - tampilkan RabbitMQ management metrics
  - tampilkan stok sebelum/sesudah

Output:

- checklist demo + bukti screenshot/log.

---

## 6. Environment Variables (Rekomendasi Minimal)

```bash
# Inventory Service
INVENTORY_PORT=3002
INVENTORY_DB_HOST=inventory-mysql
INVENTORY_DB_PORT=3306
INVENTORY_DB_NAME=inventory_db
INVENTORY_DB_USER=root
INVENTORY_DB_PASSWORD=secret

# RabbitMQ
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
INVENTORY_EXCHANGE=flowca.events
INVENTORY_ROUTING_KEY=transaction.completed
INVENTORY_QUEUE=inventory_queue
```

---

## 7. Testing Scenarios (Wajib untuk Bukti Nilai)

### 7.1 Happy Path
- Stok daging = 10.
- Publish event transaksi dengan item Steak qty 1.
- Expected: stok daging turun jadi 9, ada 1 row `stock_movements`.

### 7.2 Multi-item
- Publish event dengan 2 item menu berbeda.
- Expected: semua bahan terkait ter-update sesuai recipe.

### 7.3 Idempotency (Opsional)
Walau idempotency utama ada di Accounting, Inventory juga bisa menambah bonus jika:

- menyimpan `transaction_id` terakhir di tabel `processed_events` dan skip duplikat.

Jika tidak sempat, minimal tetap konsisten: duplikat event akan mengurangi stok dua kali (jelaskan di laporan sebagai limitasi).

---

## 8. Deliverable Jabriel
Jabriel menyerahkan:

- source code Inventory backend + RabbitMQ subscriber
- schema/init MySQL inventory + seed recipe demo
- React UI inventory minimal
- Dockerfile Inventory
- dokumentasi cara uji (steps demo)
- bukti: stok sebelum/sesudah + log consumer

---

## 9. Ringkasan Eksekusi
Prioritas Jabriel adalah membuat bukti integrasi kuat: **event `TRANSAKSI_SELESAI` → inventory otomatis potong stok** (choreography). UI boleh minimal, tapi logic event subscriber + pemotongan stok harus stabil dan bisa didemokan dengan jelas.
