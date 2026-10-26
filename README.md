# HostingAdvisor OMS (v3.3 E-Commerce) — Bộ Khung Khởi Tạo Dự Án (Team Starter Kit)

Đây là **Bộ Khung Dự Án Chuẩn (Project Skeleton)** do Team Leader thiết lập sẵn nhằm thống nhất kiến trúc thư mục, cấu trúc cơ sở dữ liệu **Supabase PostgreSQL**, giao diện HTML/Tailwind CSS và định nghĩa tên hàm/API cho toàn đội.

---

## 1. Hướng dẫn Cài đặt & Chạy thử trên máy cá nhân

1. **Kéo dự án về máy (Clone):**
   ```bash
   git clone https://github.com/thetrac44-a11y/vibecode.git
   cd vibecode
   ```
2. **Cài đặt thư viện Node.js:**
   ```bash
   npm install
   ```
3. **Tạo file cấu hình môi trường `.env`:**
   - Sao chép file `.env.example` thành `.env` (Nhận `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY` từ Leader trong nhóm chat nội bộ).
4. **Khởi động Server:**
   ```bash
   npm start
   ```
   - Cổng Mua sắm Khách hàng: `http://localhost:3000/index.html`
   - Cổng Quản trị Đơn hàng OMS: `http://localhost:3000/admin.html` (Tài khoản Admin mặc định: `admin` / `admin123@password`)

---

## 2. Những phần Leader đã dựng sẵn trong Bộ Khung (Không tự ý đổi tên ID / File)

- **`db.js` & `supabase_schema.sql`:** Tầng kết nối tự động tới **Cloud SQL: Supabase PostgreSQL** (kèm cơ chế tự động Fallback về `db.json` nếu chạy offline). Các thành viên chỉ cần gọi các hàm có sẵn như `db.getCatalogData()`, `db.createOrder()`, `db.getAllOrders()`, `db.getReviews()`...
- **`public/js/plans.js`, `domains.js`, `addons.js`, `faq.js`, `config.js`:** Dữ liệu gốc chuẩn của 6 gói Hosting/VPS, 4 đuôi tên miền, 3 dịch vụ mua kèm và câu hỏi FAQ.
- **`public/index.html` & `public/admin.html`:** Khung giao diện chuẩn Responsive cùng toàn bộ `id="..."` đã khớp sẵn với file JS.
- **Hệ thống Xác thực & Phân quyền RBAC (`server.js`):** Đã tích hợp sẵn mã hóa mật khẩu băm một chiều `SHA-256 + Salt` và Middleware kiểm tra JWT Token (`admin`, `staff`, `customer`).

---

## 3. Bảng Phân Công Nhiệm Vụ Cho Thành Viên (Tìm từ khóa `TODO` trong code)

Mỗi thành viên tạo một nhánh Git riêng theo cú pháp `git checkout -b ten-nhanh` trước khi code:

### Nhiệm vụ 1: Thuật toán Đề xuất Gói & Tích hợp Gemini AI Tư vấn
- **Nhánh Git:** `git checkout -b feat/task-1-ai-advisor`
- **File phụ trách:** `public/js/app.js` & `server.js`
- **Công việc cần hoàn thành (Tìm `TODO [NHIỆM VỤ 1]`):**
  1. Trong `public/js/app.js`: Viết thuật toán chấm điểm `recommendPlans(needs)` để chọn ra đúng **01 gói phù hợp nhất + 02 gói thay thế** dựa trên Loại web, Lưu lượng, Ngân sách và Tên miền.
  2. Trong `public/js/app.js`: Hoàn thiện hàm `renderComparisonTable()` để vẽ bảng so sánh trực quan giữa 3 gói được đề xuất.
  3. Trong `server.js`: Hoàn thiện API `POST /api/advice` gọi **Gemini 2.5 Flash** để sinh lời giải thích dễ hiểu cho chủ shop + cơ chế Fallback tự động khi mất mạng.

### Nhiệm vụ 2: Giỏ hàng E-Commerce, Mã giảm giá Coupon, VietQR & Hóa đơn PDF
- **Nhánh Git:** `git checkout -b feat/task-2-checkout-vietqr`
- **File phụ trách:** `public/js/app.js` & `server.js`
- **Công việc cần hoàn thành (Tìm `TODO [NHIỆM VỤ 2]`):**
  1. Trong `public/js/app.js`: Hoàn thiện hàm `calculateCartTotal()` tính chiết khấu chu kỳ 12/24/36 tháng (giảm 10% - 20%), cộng phí Tên miền (miễn phí nếu `freeDomain === true`), cộng phí Add-ons và tạo URL mã **VietQR Napas động**.
  2. Trong `server.js`: Hoàn thiện các API `POST /api/coupons/validate`, `POST /api/orders` và `POST /api/orders/:id/confirm-payment`.
  3. Trong `public/js/app.js`: Hoàn thiện hàm `openInvoiceModal(order)` hiển thị Hóa đơn điện tử (E-Invoice) có dấu mộc `ĐÃ THANH TOÁN (PAID)` và in ra PDF qua `window.print()`.

### Nhiệm vụ 3: Cổng Quản trị Đơn hàng OMS, Duyệt tiền cấp IP & AI Telesale
- **Nhánh Git:** `git checkout -b feat/task-3-admin-oms`
- **File phụ trách:** `public/js/admin.js` & `server.js`
- **Công việc cần hoàn thành (Tìm `TODO [NHIỆM VỤ 3]`):**
  1. Trong `public/js/admin.js`: Hoàn thiện hàm `updateKPIs()` tính 4 thẻ KPI doanh thu và hàm `renderOrdersTable()` kèm bộ lọc tìm kiếm theo Mã đơn/SĐT/Trạng thái/Nhân sự.
  2. Trong `server.js` & `public/js/admin.js`: Hoàn thiện nghiệp vụ duyệt thanh toán (`PATCH /api/orders/:id`), tự động cấp phát địa chỉ IP Hosting (`103.221.220.xxx`) + DNS và ghi vết `timeline`.
  3. Trong `server.js`: Hoàn thiện API `POST /api/advice/sales-script` dùng Gemini AI soạn **Kịch bản gọi điện Telesale 3 bước** cho nhân viên chăm sóc khách hàng.
  4. Trong `public/js/admin.js`: Hoàn thiện hàm `exportOrdersToCSV()` xuất báo cáo tài chính ra file Excel/CSV chuẩn UTF-8 BOM.

### Nhiệm vụ 4: Hệ thống Đánh giá Khách hàng Phân trang, FAQ & Tra cứu Đơn hàng
- **Nhánh Git:** `git checkout -b feat/task-4-reviews-faq`
- **File phụ trách:** `public/js/app.js` & `server.js`
- **Công việc cần hoàn thành (Tìm `TODO [NHIỆM VỤ 4]`):**
  1. Trong `public/js/app.js` & `server.js`: Hoàn thiện chức năng gửi đánh giá thực tế (`POST /api/reviews` lưu trên Supabase) và hàm `renderCustomerReviews()` có **Phân trang cố định 3 đánh giá/trang** kèm tính Điểm trung bình.
  2. Trong `public/js/app.js`: Hoàn thiện hàm `renderFAQAccordion()` đóng/mở danh sách câu hỏi thường gặp.
  3. Trong `server.js` & `public/js/app.js`: Hoàn thiện API `GET /api/orders/my-orders` giúp khách hàng tra cứu lịch sử đơn hàng và xem thông số IP Hosting theo Số điện thoại hoặc Tài khoản.

---

## 4. Quy trình Nộp code (Pull Request) cho Leader duyệt

```bash
git add .
git commit -m "Hoan thanh nhiem vu X: Mo ta ngan gon"
git push -u origin feat/task-X-...
```
Sau khi push nhánh lên GitHub, tạo **Pull Request (PR)** vào nhánh `main` để Leader kiểm tra và ghép code.
