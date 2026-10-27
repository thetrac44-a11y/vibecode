# HostingAdvisor OMS (v3.3 E-Commerce) — Bộ Khung Khởi Tạo Dự Án (Team 3 Người)

Đây là **Bộ Khung Dự Án Chuẩn (Project Skeleton)** do **Team Leader** thiết lập sẵn nhằm thống nhất kiến trúc thư mục, cơ sở dữ liệu **Cloud SQL: Supabase PostgreSQL**, hệ thống bảo mật phân quyền **RBAC (JWT + SHA-256)** và dữ liệu danh mục gốc.

Dự án được thiết kế tách biệt hoàn toàn thành **02 Cổng độc lập (`index.html` / `app.js` và `admin.html` / `admin.js`)**, giúp **2 thành viên trong đội code song song trên 2 file khác nhau mà không bao giờ bị xung đột (`git conflict`)**.

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
   - Sao chép file `.env.example` thành `.env` (Nhận `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY` từ Leader).
4. **Khởi động Server:**
   ```bash
   npm start
   ```
   - **Cổng Mua sắm Khách hàng (User Portal):** `http://localhost:3000/index.html`
   - **Cổng Quản trị Đơn hàng (Admin OMS Portal):** `http://localhost:3000/admin.html` (Tài khoản Admin gốc: `admin` / `admin123@password`)

---

## 2. Phân Công Nhiệm Vụ Cho Đội (Leader + 02 Thành Viên)

### Vai trò 0: Team Leader (Đã hoàn thành sẵn trong Khung)
- Thiết kế kiến trúc tổng thể & CSDL **Supabase PostgreSQL** (`supabase_schema.sql`, `db.js`, `db.json`).
- Xây dựng hệ thống xác thực **JWT & Phân quyền RBAC 3 cấp** (`admin`, `staff`, `customer`), mã hóa mật khẩu một chiều `SHA-256 + Salt`.
- Chuẩn hóa bộ dữ liệu gốc (`plans.js`, `domains.js`, `addons.js`, `faq.js`, `config.js`) và khung giao diện chuẩn Responsive.

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

### Thành Viên 2: Phụ trách Cổng Quản Trị Đơn Hàng OMS (Admin Portal & AI Telesale)
- **Nhánh làm việc Git:**
  ```bash
  git checkout -b feat/admin-portal
  ```
- **File làm việc chính:** `public/js/admin.js`, `public/admin.html` và phần API Admin trong `server.js` (Tìm từ khóa `TODO [ADMIN PORTAL]`).
- **Danh sách các hạng mục cần hoàn thành:**
  1. **Thống kê 4 Chỉ số KPI Doanh thu (`updateKPIs` trong `public/js/admin.js`):**
     - Tính tự động theo thời gian thực: (1) Doanh thu thực nhận (`paid`), (2) Doanh thu chờ duyệt, (3) Số đơn cần duyệt tiền và (4) Tổng số đơn hàng trên hệ thống.
  2. **Bảng Quản lý Đơn hàng & Bộ lọc Đa chiều (`renderOrdersTable` & `getFilteredOrders` trong `public/js/admin.js`):**
     - Hiển thị danh sách đơn hàng từ Supabase và lọc tức thì theo từ khóa (Mã đơn, Tên khách, SĐT, Tên miền), lọc theo Trạng thái đơn và lọc theo Nhân viên phụ trách.
  3. **Nghiệp vụ Duyệt thanh toán VietQR, Cấp phát IP Hosting & Phân công nhân sự (`openOrderDetailModal` trong `public/js/admin.js` & `PATCH /api/orders/:id` trong `server.js`):**
     - Khi bấm **"Xác Nhận Đã Nhận Tiền & Kích Hoạt Dịch Vụ"**, tự động chuyển trạng thái đơn sang `completed` (`paid`), cấp phát địa chỉ IP Hosting (`103.221.220.xxx`) + cặp Nameservers và ghi nhật ký vào mảng `timeline`.
     - Cho phép Admin phân công đơn hàng cho nhân viên `Staff` và ghi chú nội bộ.
  4. **AI Trợ lý Telesale 3 Bước & Xuất Báo cáo Tài chính CSV (`POST /api/advice/sales-script` & `exportOrdersToCSV`):**
     - Kết nối Gemini AI phân tích gói cước/tên miền/add-ons của từng đơn hàng để soạn **Kịch bản gọi điện Telesale 3 bước** cho nhân viên tư vấn.
     - Xuất danh sách đơn hàng ra file báo cáo **CSV (chuẩn UTF-8 BOM)** mở trực tiếp trên Microsoft Excel.
  5. **Quản trị Hệ thống dành cho Admin (`renderStaffManagementList`, `renderCouponsManagementList`, `renderReviewsManagementList`):**
     - Quản lý tạo/xóa tài khoản nhân viên `Staff`, tạo/xóa mã giảm giá `Coupon`, cập nhật số tài khoản ngân hàng VietQR và kiểm duyệt xóa đánh giá spam.

---

## 3. Quy trình Gộp Code (Git Merge) Không Xung Đột

- **Thành viên 1** chỉ sửa trong `public/js/app.js`, `public/index.html` và khu vực `// === KHU VỰC USER PORTAL ===` trong `server.js`.
- **Thành viên 2** chỉ sửa trong `public/js/admin.js`, `public/admin.html` và khu vực `// === KHU VỰC ADMIN PORTAL ===` trong `server.js`.
- Sau khi hoàn thành, mỗi người push nhánh của mình lên GitHub và tạo **Pull Request** vào nhánh `main` để Leader kiểm tra và gộp code:
  ```bash
  git add .
  git commit -m "Hoan thanh module duoc phan cong"
  git push -u origin HEAD
  ```
