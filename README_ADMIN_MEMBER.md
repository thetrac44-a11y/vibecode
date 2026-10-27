# HUONG DAN NHIEM VU: THANH VIEN 2 — CONG QUAN TRI DON HANG OMS & AI TELESALE (ADMIN PORTAL)

Tai lieu nay danh rieng cho **Thanh vien 2** phu trach toan bo he thong Quan tri Don hang Thuong mai Dien tu (OMS), Doanh thu va Tro ly Telesale AI.

---

## 1. THONG TIN CHUNG & PHAM VI CONG VIEC

- **Nhanh Git lam viec:** `feat/admin-portal`
- **Cac file chinh can code:**
  - `public/js/admin.js` (Logic quan tri, tinh KPI, duyet don, goi AI Telesale, xuat CSV)
  - `public/admin.html` (Giao dien Dashboard quan tri vien)
  - `server.js` (Cac route API quan tri bat dau bang `/api/admin/*` hoac yeu cau quyen admin/staff)
- **Cac file chi doc tham khao (khong sua):**
  - `db.js` (Tang truy xuat CSDL Supabase PostgreSQL do Leader viet san)
  - `supabase_schema.sql` (Cau truc 8 bang CSDL PostgreSQL)

---

## 2. CHECKLIST 5 HANG MUC CONG VIEC CAN HOAN THANH

Tim tu khoa `TODO [ADMIN PORTAL - THANH VIEN 2]` trong code de den dung vi tri can viet.

### HANG MUC 1: Tinh Toan 4 Chi So KPI Doanh Thu Theo Thoi Gian Thuc

1. **Ham `updateKPIs()` trong `public/js/admin.js`:**
   - **Dau vao:** Mang toan bo don hang `allOrders` duoc tai ve tu `GET /api/orders`.
   - **Logic tinh toan:**
     - Duyet qua tung don hang trong `allOrders`:
       - Neu `order.status === 'completed'` hoac `order.paymentStatus === 'paid'`: cong vao **Doanh Thu Thuc Nhan** (`#kpi-paid-revenue`).
       - Neu `order.status === 'paid_processing'` hoac `order.status === 'pending_payment'`: cong vao **Doanh Thu Cho Duyet** (`#kpi-pending-revenue`) va tang bien dem **Don Can Duyet Tien** (`#kpi-pending-count`) them 1.
       - Tong so don hang tren he thong: `allOrders.length` (`#kpi-total-orders`).
   - **Dinh dang tien te:** Dinh dang theo chuan Viet Nam (vi du: `5.420.000d`).

---

### HANG MUC 2: Bang Quan Ly Don Hang & Bo Loc Da Chieu

1. **Ham `getFilteredOrders()` trong `public/js/admin.js`:**
   - Loc mang `allOrders` ket hop dong thoi ca 3 tieu chi:
     1. Tu khoa tim kiem (`#filter-search`): Tim khong phan biet hoa thuong tren Ma don, Ten khach hang, So dien thoai, Email, Ten mien va Ma coupon.
     2. Trang thai don (`#filter-status`): Tat ca, Cho duyet tien (`paid_processing`), Cho thanh toan (`pending_payment`), Da kich hoat (`completed`), Da huy (`cancelled`).
     3. Nguoi phu trach (`#filter-assignee`): Tat ca, Chua phan cong, hoac theo ID nhan vien cu the.

2. **Ham `renderOrdersTable()` trong `public/js/admin.js`:**
   - Render danh sach don hang da loc vao the `#admin-orders-tbody`.
   - Moi dong gom cac cot:
     - Ma don / Thoi gian tao don.
     - Thong tin khach hang (Ho ten, So dien thoai).
     - Goi Hosting & Ten mien dang ky.
     - Add-ons mua kem & Ma coupon ap dung.
     - Tong tien thanh toan.
     - Huy hieu trang thai (Mau xanh ngoc neu da kich hoat, mau vang neu cho duyet tien, mau xam neu cho thanh toan).
     - Nguoi phu trach xu ly.
     - Nut thao tac: Nut "Chi tiet & Duyet" mo Modal xu ly; neu la Admin thi co them nut "Xoa" don.

---

### HANG MUC 3: Modal Xu Ly Don, Duyet Tien VietQR & Cap IP Hosting

1. **Ham `openOrderDetailModal(orderId)` trong `public/js/admin.js`:**
   - Mo modal `#order-detail-modal`, do thong tin chi tiet don hang vao `#detail-summary-box`.
   - Hien thi anh ma VietQR doi soat thanh toan vao `#detail-qr-img`.
   - Render toan bo lich su vet xu ly don hang vao `#detail-timeline-list`.
   - Neu don hang chua duyet (`status !== 'completed'`), hien thi nut "Xac Nhan Da Nhan Tien & Kich Hoat Dich Vu".

2. **API `PATCH /api/orders/:id` trong `server.js`:**
   - Cho phep Admin hoac Staff cap nhat trang thai don, ghi chu noi bo hoac phan cong nhan vien xu ly.
   - **Nghiep vu dac biet khi duyet tien (`status === 'completed'`):**
     - Chuyen `paymentStatus = 'paid'`.
     - Tu dong cap phat IP Hosting (`103.221.220.xxx`), cap Nameservers (`ns1.hostingadvisor.vn`, `ns2.hostingadvisor.vn`) va link trang quan tri cPanel.
     - Ghi vet lich su vao mang `timeline` gom thoi gian, nguoi thuc hien va hanh dong cap IP.

---

### HANG MUC 4: Tro Ly Gemini AI Soan Kich Ban Telesale 3 Buoc

1. **API `POST /api/advice/sales-script` trong `server.js`:**
   - **Dau vao:** `orderId` tu body, xac thuc quyen qua token Admin/Staff.
   - **Tim don hang:** Lay thong tin don hang tu database qua `db.getOrderById(orderId)`.
   - **Prompt gui Gemini:**
     - Dong vai Giam doc Kinh doanh Ha tang Hosting & Ten mien.
     - Phan tich goi cuoc khach da chon, ten mien, add-ons va tong tien de soan kịch ban goi dien 3 buoc ro rang bang tieng Viet (khong dung emoji):
       - **Buoc 1 (Chao hoi & Xac nhan don hang):** Goi dung ten khach, ma don, goi cuoc va so tien.
       - **Buoc 2 (Tu van ky thuat & Ho tro kich hoat):** Huong dan thanh toan VietQR hoac thong bao da ban giao thong so IP Hosting.
       - **Buoc 3 (Gia tang gia tri & Up-sell):** De xuat mua them Backup tu dong hang ngay, bao ve thuong hieu ten mien hoac gia han chu ky dai han.
   - **Fallback:** Co san kich ban mau mac dinh khi mat mang.

2. **Nut `#btn-generate-sales-script` trong `public/js/admin.js`:**
   - Khi click, hien thi trang thai "AI dang soan...", goi API tren va hien thi kich ban 3 buoc vao the `#detail-sales-script-box`.

---

### HANG MUC 5: Xuat Bao Cao Tai Chinh CSV & Quan Tri He Thong

1. **Ham `exportOrdersToCSV()` trong `public/js/admin.js`:**
   - Lay toan bo don hang dang duoc loc tren bang.
   - Xay dung cac dong CSV gom day du cac cot: Ma don, Thoi gian, Khach hang, SDT, Email, Goi Hosting, Chu ky, Ten mien, Add-ons, Coupon, Tien giam, Tong thanh toan, Trang thai, Nguoi phu trach.
   - **Dac biet quan trong:** Phai them ky tu Byte Order Mark `\uFEFF` o dau file CSV de khi mo bang Microsoft Excel tren Windows khong bao gio bi loi font tieng Viet co dau.
   - Tu dong kich hoat tai file ve may voi ten `bao-cao-don-hang-oms-YYYY-MM-DD.csv`.

2. **Cac bang Quan tri He thong (danh rieng cho cap Admin):**
   - **Quan ly Nhan su (Staff):** Form them nhan vien moi (`POST /api/admin/users`) voi mat khau băm SHA-256 va nut xoa nhan vien.
   - **Quan ly Ma giam gia (Coupon):** Form them ma giam gia moi theo % hoac tien co dinh (`POST /api/admin/coupons`) va nut xoa ma cu.
   - **Cau hinh Ngan hang VietQR:** Form cap nhat Ma ngan hang, So tai khoan va Ten chu tai khoan (`PUT /api/admin/settings`), tu dong sinh ma QR xem truoc ngay tai giao dien.
   - **Kiem duyet Danh gia:** Xem danh sach danh gia khach hang tu Supabase va nut xoa nhan xet spam (`DELETE /api/admin/reviews/:id`).

---

## 3. KICH BAN DEMO KHI THUYET TRINH TRUOC BAN GIAM KHAO

Thanh vien 2 se dong vai **Giam doc Van hanh & Ke toan (Admin)** phoi hop nhip nhang ngay sau khi Thanh vien 1 vua dat don hang:
1. Mo trang `admin.html`, dang nhap bang tai khoan `admin` / `admin123@password`.
2. Chi len goc trai topbar gioi thieu nhan xanh: `DB: Supabase PostgreSQL (Cloud SQL)` de chung minh du lieu dang luu tru tren may chu dam may that chu khong phai bien tam.
3. Chi vao 4 the KPI:
   - "Doanh thu cho duyet va so don can duyet vua tu dong tang len ngay khi khach hang (Thanh vien 1) vua bam dat don o man hinh ben kia."
4. Mo dong don hang vua tao, bam nut "Chi tiet & Duyet":
   - Cho BGK xem anh ma VietQR doi soat thanh toan va timeline nhat ky don hang.
   - Bam nut "AI Soan Kich Ban Goi Dien": Chi cho BGK thay Gemini AI vua phan tich thong tin don de sinh ngay 3 buoc goi dien cham soc khach hang cho nhan vien sales.
   - Bam nut "Xac Nhan Da Nhan Tien & Kich Hoat Dich Vu": Don hang chuyen sang mau xanh Paid, he thong tu dong cap ngay dia chi IP Hosting `103.221.220.xxx` va ghi vet timeline nguoi duyet.
5. Bam nut "Xuat Bao Cao CSV": Mo file Excel len chung minh font tieng Viet ro rang, so lieu tai chinh minh bach.
6. Cuon xuong phan Quan ly He thong: Thay doi thu So tai khoan ngan hang VietQR hoac tao 1 ma giam gia moi de chung minh tinh nang quan tri dong 100%.

---

## 4. CHECKLIST TU KIEM TRA TRUOC KHI TAO PULL REQUEST (PR)

- [ ] Kiem tra cu phap code: chay `node --check server.js` va `node --check public/js/admin.js` khong bao loi.
- [ ] Dang nhap thu bang ca tai khoan `admin` (toan quyen) va tao thu 1 tai khoan `staff` de kiem tra xem phan quyen RBAC co hoat dong dung khong.
- [ ] Bam thu nut "Xuat Bao Cao CSV" va mo file bang Excel xem co bi loi font khong.
- [ ] Bam thu nut AI Telesale xem co sinh kich ban khong.
- [ ] Khong dung bat ky icon hoac emoji nao trong code va giao dien.
- [ ] Push code len nhanh `feat/admin-portal` va bao Leader review code.
