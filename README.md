# HostingAdvisor — AI Tư Vấn Hosting/Domain & Nền Tảng Thương Mại Điện Tử Quản Trị Đơn Hàng (OMS)

**Bản v3.3 (E-Commerce Edition)** — Sản phẩm dự thi **VIBE-CODING 2026 (Đề số 1 - Bảng A)**.

---

## 1. Kiến trúc & Điểm nổi bật

1. **Mua bán trực tiếp & Trợ lý Mua sắm AI (AI Buying Assistant):**
   - Xem toàn bộ danh mục 6 gói Hosting & Tên miền (`Shared Hosting`, `Cloud Hosting`, `VPS`) để bấm **Mua Ngay** trực tiếp, hoặc dùng **Trợ lý AI Gemini (`gemini-2.5-flash`)** khảo sát nhu cầu, gợi ý 01 gói phù hợp nhất + 02 gói thay thế kèm tư vấn tên miền và bảng so sánh 3 gói.
2. **Dịch vụ mua kèm (Add-ons / Cross-sell):**
   - Tích chọn Bảo vệ ẩn danh Whois (`50.000đ/năm`), Sao lưu tự động hằng ngày (`30.000đ/tháng`), Địa chỉ IP riêng (`80.000đ/tháng`).
3. **Hệ thống Mã giảm giá (Coupon Code):**
   - Nhập mã khuyến mãi `VIBE2026` (giảm 15%) hoặc `CHUSHOP` (giảm 50.000đ), tự động trừ tiền và cập nhật mã VietQR tức thì.
4. **Cơ chế thanh toán VietQR động & Hóa đơn điện tử (E-Invoice):**
   - Tự động sinh mã QR ngân hàng kèm đúng số tiền và mã đơn `ORD-2026-XXX`.
   - Xem & In Hóa đơn điện tử (`INV-2026-XXX`) có dấu xác nhận `ĐÃ THANH TOÁN (PAID)` hoặc `CHỜ THANH TOÁN (UNPAID)`.
5. **Phân quyền RBAC 3 cấp độ (`admin`, `staff`, `customer`) & Cổng Quản Trị OMS (`admin.html`):**
   - 4 thẻ KPI Doanh thu (Thực nhận, Chờ duyệt, Đơn cần duyệt, Tổng đơn).
   - Duyệt nhận tiền chuyển khoản, tự động cấp IP Hosting & Nameservers.
   - **AI Trợ lý Telesale:** Bấm 1 nút AI tự động soạn kịch bản gọi điện chốt đơn 3 bước.
   - Phân công nhân viên, lọc đơn hàng, xuất báo cáo tài chính CSV chuẩn UTF-8.

---

## 2. Hướng dẫn Khởi chạy Ứng dụng

```bash
# 1. Cài đặt thư viện
npm install

# 2. Tạo file cấu hình môi trường .env (đã tạo sẵn)
cp .env.example .env

# 3. Khởi chạy server
npm start
```

- **Cổng Mua Sắm Khách Hàng:** `http://localhost:3000/index.html`
- **Cổng Quản Trị Đơn Hàng (OMS):** `http://localhost:3000/admin.html`

### Tài khoản & Mã giảm giá Demo:
- **Admin (Toàn quyền):** `admin` / `admin123@password`
- **Staff (Nhân viên):** `staff` / `staff123@password`
- **Khách hàng mẫu:** `hoangyen` / `123456@password`
- **Mã giảm giá:** `VIBE2026` (giảm 15%), `CHUSHOP` (giảm 50.000đ)
