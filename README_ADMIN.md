# CAM NANG LAP TRINH CHI TIET: PHAN QUYEN QUAN TRI VIEN (ADMIN OMS PORTAL & AI TELESALE)

Tai lieu nay la cam nang huong dan lap trinh chi tiet tung buoc (Step-by-step Developer Guide) danh rieng cho lap trinh vien phu trach **Cong Quan Tri Don Hang & Doanh Thu (Admin OMS Portal)** trong du an HostingAdvisor.

---

## MUC LUC
1. Kien truc Phan quyen Quan tri (Admin & Staff RBAC, JWT, Mat khau SHA-256)
2. Ban do Du lieu Supabase PostgreSQL lien quan den Admin OMS
3. Huong dan chi tiet Chuc nang 1: Tinh toan 4 Chi so KPI Doanh thu theo Thoi gian thuc
4. Huong dan chi tiet Chuc nang 2: Bang Quan ly Don hang & Bo loc Tim kiem Da chieu
5. Huong dan chi tiet Chuc nang 3: Modal Xu ly Don, Duyet tien VietQR & Cap phat IP Hosting
6. Huong dan chi tiet Chuc nang 4: Tro ly Gemini AI Soan Kich ban Telesale 3 Buoc
7. Huong dan chi tiet Chuc nang 5: Xuat Bao cao Tai chinh CSV chuan UTF-8 BOM
8. Huong dan chi tiet Chuc nang 6: Khu vuc Quan tri He thong danh rieng cho Admin
9. Danh muc API Backend can lam viec & Ket noi Database qua db.js
10. Checklist Tu kiem tra truoc khi ban giao code

---

## 1. KIEN TRUC PHAN QUYEN QUAN TRI (ADMIN & STAFF RBAC)

### 1.1. Hai cap bac quan tri tren he thong:
He thong ap dung mo hinh Phan quyen dua tren vai tro (Role-Based Access Control - RBAC) gom:
- **Cap 1 — Admin (Toan quyen quan tri):**
  - Xem va loc toan bo don hang tren he thong.
  - Duyet thanh toan, cap phat IP Hosting, xoa don hang rac.
  - Phan cong don hang cho tung nhan vien phu trach (`assignedTo`).
  - Toan quyen quan tri he thong: Tao/xoa nhan vien Staff, tao/xoa ma giam gia Coupon, cap nhat so tai khoan ngan hang VietQR, xoa danh gia spam.
- **Cap 2 — Staff (Nhan vien cham soc khach hang / Telesale):**
  - Dang nhap vao cong quan tri bang tai khoan duoc Admin cap.
  - Xem va loc don hang, xem chi tiet ma VietQR de doi soat ngan hang.
  - Su dung Tro ly AI de sinh kịch ban goi dien Telesale 3 buoc.
  - Cap nhat ghi chu xu ly noi bo va xac nhan don hang.
  - Khong duoc phep thay va khong duoc sua cac bang Quan tri He thong (khung `#admin-system-panel` tu dong bi an).
- **Cap 3 — Customer:** Khong duoc phep dang nhap vao `admin.html`. Neu dang nhap se bi bao loi: "Tai khoan Khach hang khong duoc phep truy cap Cong Quan Tri OMS".

### 1.2. Bao mat Mat khau mot chieu (Salted SHA-256):
Moi mat khau quan tri luu trong CSDL deu duoc bam qua thu vien `crypto` chuan cua Node.js:
`hash = sha256$random_salt$hmac_hash`. Khong luu mat khau goc (plain-text) de bao dam an toan tuyet doi.

### 1.3. Xu ly Phien dang nhap & Dong bo Giao dien trong `public/js/admin.js`:
```javascript
function syncAdminScreenUI() {
  const loginScreen = document.getElementById('admin-login-screen');
  const dashboardScreen = document.getElementById('admin-dashboard-screen');
  const systemPanel = document.getElementById('admin-system-panel');
  const userBar = document.getElementById('admin-user-bar');
  const userNameEl = document.getElementById('admin-user-name');
  const roleBadgeEl = document.getElementById('admin-role-badge');

  if (adminUser && adminToken) {
    loginScreen?.classList.add('hidden');
    dashboardScreen?.classList.remove('hidden');
    userBar?.classList.remove('hidden');
    userBar?.classList.add('flex');

    // Chi role admin moi duoc thay khu vuc Quan tri He thong
    if (adminUser.role === 'admin') {
      systemPanel?.classList.remove('hidden');
    } else {
      systemPanel?.classList.add('hidden');
    }

    if (userNameEl) userNameEl.textContent = adminUser.fullName;
    if (roleBadgeEl) {
      roleBadgeEl.textContent = adminUser.role.toUpperCase();
      roleBadgeEl.className = adminUser.role === 'admin'
        ? 'text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-900'
        : 'text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-brand-500 text-white';
    }
  } else {
    loginScreen?.classList.remove('hidden');
    dashboardScreen?.classList.add('hidden');
    systemPanel?.classList.add('hidden');
    userBar?.classList.add('hidden');
    userBar?.classList.remove('flex');
  }
}
```

---

## 2. BAN DO DU LIEU SUPABASE POSTGRESQL LIEN QUAN DEN ADMIN OMS

Backend Express (`server.js`) cung cap du lieu cho Admin thong qua tang `db.js`. Lap trinh vien quan tri lam viec truc tiep voi cac bang:

1. **Bang `public.users`:** Danh sach tai khoan he thong.
   - Cac truong: `id`, `username`, `password_hash`, `full_name`, `phone`, `email`, `role` (`'admin'`, `'staff'`, `'customer'`), `created_at`.
   - Ham goi tu `db.js`: `db.getAllUsers()`, `db.createUser()`, `db.deleteUserById()`.
2. **Bang `public.orders`:** Toan bo don hang cua khach.
   - Cac truong: `id`, `invoice_id`, `user_id`, `customer_name`, `phone`, `email`, `plan_id`, `plan_name`, `billing_cycle_months`, `domain_name`, `addons`, `coupon_applied`, `total_amount`, `payment_status`, `status`, `qr_url`, `service_details`, `assigned_to`, `assigned_to_name`, `notes`, `timeline`, `created_at`.
   - Ham goi tu `db.js`: `db.getAllOrders()`, `db.getOrderById()`, `db.updateOrder()`, `db.deleteOrderById()`.
3. **Bang `public.settings`:** CSDL cau hinh Ngan hang nhan tien VietQR.
   - Cac truong: `id` (= 1), `bank_id`, `account_no`, `account_name`, `updated_at`.
   - Ham goi tu `db.js`: `db.updateBankSettings()`.
4. **Bang `public.coupons`:** Danh sach ma giam gia khuyen mai.
   - Cac truong: `code`, `type`, `value`, `description`.
   - Ham goi tu `db.js`: `db.getCoupons()`, `db.upsertCoupon()`, `db.deleteCouponByCode()`.
5. **Bang `public.reviews`:** Danh sach danh gia khach hang de Admin kiem duyet.
   - Cac truong: `id`, `customer_name`, `business_name`, `plan_name`, `rating`, `comment`.
   - Ham goi tu `db.js`: `db.getReviews()`, `db.deleteReviewById()`.

---

## 3. HUONG DAN CHI TIET CHUC NANG 1: TINH TOAN 4 CHI SO KPI DOANH THU

### 3.1. Viet ham `updateKPIs()` trong `public/js/admin.js`:
Duyet qua mang `allOrders` (lay tu `GET /api/orders`) de tinh toan cac chi so:
```javascript
function updateKPIs() {
  let paidRevenue = 0;      // Doanh thu thuc nhan
  let pendingRevenue = 0;   // Doanh thu cho duyet
  let pendingCount = 0;     // So luong don can duyet tien

  for (const o of allOrders) {
    const amt = Number(o.totalAmount) || 0;
    if (o.status === 'completed' || o.paymentStatus === 'paid') {
      paidRevenue += amt;
    } else if (o.status === 'paid_processing' || o.status === 'pending_payment') {
      pendingRevenue += amt;
      pendingCount += 1;
    }
  }

  document.getElementById('kpi-paid-revenue').textContent = formatVND(paidRevenue);
  document.getElementById('kpi-pending-revenue').textContent = formatVND(pendingRevenue);
  document.getElementById('kpi-pending-count').textContent = String(pendingCount);
  document.getElementById('kpi-total-orders').textContent = String(allOrders.length);
}
```

---

## 4. HUONG DAN CHI TIET CHUC NANG 2: BANG QUAN LY DON HANG & BO LOC TIM KIEM

### 4.1. Viet ham loc don hang `getFilteredOrders()` trong `public/js/admin.js`:
Ket hop dong thoi ca 3 bo loc tren giao dien:
```javascript
function getFilteredOrders() {
  const searchVal = (document.getElementById('filter-search')?.value || '').trim().toLowerCase();
  const statusVal = document.getElementById('filter-status')?.value || 'all';
  const assigneeVal = document.getElementById('filter-assignee')?.value || 'all';

  return allOrders.filter((o) => {
    // 1. Loc theo trang thai
    if (statusVal !== 'all' && o.status !== statusVal) return false;

    // 2. Loc theo nguoi phu trach
    if (assigneeVal === 'unassigned' && o.assignedTo) return false;
    if (assigneeVal !== 'all' && assigneeVal !== 'unassigned' && o.assignedTo !== assigneeVal) return false;

    // 3. Loc theo tu khoa tim kiem
    if (searchVal) {
      const haystack = [
        o.id,
        o.customerName,
        o.phone,
        o.email,
        o.domainName,
        o.planName,
        o.couponApplied
      ].join(' ').toLowerCase();
      if (!haystack.includes(searchVal)) return false;
    }
    return true;
  });
}
```

### 4.2. Viet ham `renderOrdersTable()` trong `public/js/admin.js`:
Render ket qua loc vao the `#admin-orders-tbody`.
- Cot Ma don / Thoi gian: Hien thi `o.id` mau xanh dam va `new Date(o.createdAt).toLocaleString('vi-VN')`.
- Cot Khach hang: Hien thi `o.customerName` va `o.phone`.
- Cot Goi & Ten mien: Hien thi `Goi ${o.planName} (${o.billingCycleMonths}T)` va `o.domainName || 'Khong kem ten mien'`.
- Cot Tong tien: Hien thi `formatVND(o.totalAmount)` in dam.
- Cot Trang thai:
  - `completed` hoac `paid`: Huy hieu xanh la "Da kich hoat (Paid)".
  - `paid_processing`: Huy hieu vang "Cho duyet tien (Da CK)".
  - `pending_payment`: Huy hieu xam "Cho thanh toan".
- Cot Thao tac: Nut "Chi tiet & Duyet" (class `btn-open-detail`) va nut "Xoa" (chi hien khi `adminUser.role === 'admin'`).

---

## 5. HUONG DAN CHI TIET CHUC NANG 3: MODAL CHI TIET DON, DUYET TIEN & CAP IP HOSTING

### 5.1. Viet ham `openOrderDetailModal(orderId)` trong `public/js/admin.js`:
- Tim don hang: `const order = allOrders.find(o => o.id === orderId)`.
- Do thong tin chi tiet khach hang vao `#detail-summary-box`.
- Doi soat ma VietQR: Hien thi link anh VietQR vao `#detail-qr-img` va so tien vao `#detail-qr-amount`.
- Render dong thoi vet nhat ky `order.timeline` vao `#detail-timeline-list`.
- **Nut Duyet thanh toan (`#btn-approve-payment`):**
  - Neu don da thanh toan: An nut duyet, hien thi thong bao "Don hang nay da duoc kich hoat".
  - Neu don chua thanh toan: Hien thi nut "Xac Nhan Da Nhan Tien & Kich Hoat Dich Vu".

### 5.2. Viet API `PATCH /api/orders/:id` trong `server.js`:
- **Method:** `PATCH`
- **URL:** `/api/orders/:id`
- **Header:** `Authorization: Bearer <adminToken>`
- **Request Body (JSON):**
  ```json
  {
    "status": "completed",
    "assignedTo": "USR-002",
    "notes": "Da kiem tra sao ke ngan hang khop so tien"
  }
  ```
- **Xu ly nghiep vu tren Server:**
  1. Kiem tra quyen Admin/Staff. Neu cap nhat `assignedTo` ma khong phai Admin thi chan loi 403.
  2. Neu `status === 'completed'`:
     - Chuyen `order.paymentStatus = 'paid'`.
     - Tu dong cap phat IP Hosting neu chua co:
       ```javascript
       const randomOctet = Math.floor(Math.random() * 200) + 20;
       order.serviceDetails = {
         hostingIp: `103.221.220.${randomOctet}`,
         nameServers: ['ns1.hostingadvisor.vn', 'ns2.hostingadvisor.vn'],
         controlPanelUrl: 'https://cp.hostingadvisor.vn:2083',
         activatedAt: new Date().toISOString()
       };
       ```
     - Ghi nhat ky vao `order.timeline`: `action: 'Da xac nhan nhan du tien VietQR & Kich hoat dich vu (IP: ...)', by: req.user.fullName`.
  3. Luu don hang cap nhat vao Supabase qua `await db.updateOrder(order)`.
  4. Tra ve `{ ok: true, order: updated }`.

---

## 6. HUONG DAN CHI TIET CHUC NANG 4: TRO LY GEMINI AI SOAN KICH BAN TELESALE 3 BUOC

### 6.1. Viet API `POST /api/advice/sales-script` trong `server.js`:
- **Method:** `POST`
- **URL:** `/api/advice/sales-script`
- **Header:** `Authorization: Bearer <adminToken>`
- **Request Body (JSON):** `{ "orderId": "ORD-2026-001" }`
- **Xu ly tren Server:**
  - Lay thong tin don tu Supabase qua `db.getOrderById(orderId)`.
  - Xay dung prompt gui Gemini AI:
    ```
    Ban la Giam doc Kinh doanh Ha tang Hosting & Ten mien. Hay soan kich ban goi dien Telesale ngan gon 3 buoc cho nhan vien tu van:
    - Ten khach hang: ${order.customerName} (SDT: ${order.phone})
    - Ma don: ${order.id} | Trang thai: ${order.status} (${order.paymentStatus})
    - Goi dang ky: ${order.planName} (${order.billingCycleMonths} thang)
    - Ten mien: ${order.domainName || 'Chua kem ten mien'}
    - Tong thanh toan: ${order.totalAmount}d

    Yeu cau trinh bay dung 3 buoc ro rang, lich su, bang tieng Viet (tuyet doi khong dung icon/emoji):
    Buoc 1 (Chao hoi & Xac nhan don hang): ...
    Buoc 2 (Tu van ky thuat & Huong dan thanh toan VietQR hoac ban giao IP): ...
    Buoc 3 (De xuat Up-sell mua them Daily Backup hoac ten mien bao ve thuong hieu): ...
    ```
  - Goi hàm `callGeminiText(prompt)` va tra ve `{ ok: true, script: aiScript }`.
  - Neu Gemini loi, tra ve doan kich ban fallback mau chuan.

### 6.2. Bat su kien Nut `#btn-generate-sales-script` trong `public/js/admin.js`:
- Khi click: Hien thi text "AI dang soan...", gui request toi API tren, sau do do noi dung kich ban vao `#detail-sales-script-box`.

---

## 7. HUONG DAN CHI TIET CHUC NANG 5: XUAT BAO CAO TAI CHINH CSV CHUAN UTF-8 BOM

### 7.1. Viet ham `exportOrdersToCSV()` trong `public/js/admin.js`:
```javascript
function exportOrdersToCSV() {
  const rowsData = getFilteredOrders();
  if (rowsData.length === 0) {
    alert('Khong co don hang nao de xuat CSV.');
    return;
  }

  const headers = [
    'Ma Don', 'Thoi Gian', 'Khach Hang', 'So Dien Thoai', 'Email',
    'Goi Hosting', 'Chu Ky (Thang)', 'Ten Mien', 'Add-ons',
    'Ma Giam Gia', 'Tien Giam', 'Tong Thanh Toan', 'Trang Thai TT', 'Trang Thai Don', 'Phu Trach'
  ];

  const rows = rowsData.map((o) => {
    const addonsStr = Array.isArray(o.addons) ? o.addons.map((a) => a.name).join(' + ') : '';
    return [
      o.id, o.createdAt, o.customerName, o.phone, o.email,
      o.planName, o.billingCycleMonths, o.domainName, addonsStr,
      o.couponApplied || '', o.discountAmount || 0, o.totalAmount,
      o.paymentStatus, o.status, o.assignedToName || 'Chua phan cong'
    ].map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`);
  });

  // Dac biet quan trong: \uFEFF la Byte Order Mark de Excel tren Windows hien thi dung tieng Viet
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `bao-cao-don-hang-oms-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

---

## 8. HUONG DAN CHI TIET CHUC NANG 6: KHU VUC QUAN TRI HE THONG (ADMIN)

Khu vuc `#admin-system-panel` gom 4 panel danh rieng cho cap Admin:

1. **Panel 1 — Quan ly Nhan su (Staff):**
   - Form `#form-create-staff`: Nhap Username, Mat khau, Ho ten, SDT -> goi `POST /api/admin/users` (mat khau duoc băm SHA-256 truoc khi luu vao Supabase).
   - Danh sach `#staff-list-container`: Hien thi nhan vien kem nut "Xoa" -> goi `DELETE /api/admin/users/:id`.
2. **Panel 2 — Quan ly Ma giam gia (Coupon):**
   - Form `#form-create-coupon`: Nhap Ma (VD: `HE2026`), Loai (percent hoac fixed), Gia tri, Mo ta -> goi `POST /api/admin/coupons`.
   - Danh sach `#coupon-list-container`: Hien thi danh sach coupon dang chay kem nut "Xoa" -> goi `DELETE /api/admin/coupons/:code`.
3. **Panel 3 — Cau hinh Ngan hang VietQR:**
   - Form `#form-bank-settings`: Chon Ngan hang tu danh sach 17 ngan hang Napas (`MB`, `VCB`, `TCB`...), nhap So tai khoan va Ten chu tai khoan -> goi `PUT /api/admin/settings`.
   - Ngay ben duoi co anh QR xem truoc (`#admin-bank-qr-preview`) de kiem tra app ngan hang co nhan dung tai khoan khong.
4. **Panel 4 — Kiem duyet Danh gia khach hang (Reviews):**
   - Hien thi danh sach nhan xet khach hang tu Supabase vao `#admin-reviews-list`.
   - Moi the co nut "Xoa" -> goi `DELETE /api/admin/reviews/:id` de xoa cac danh gia spam.

---

## 9. DANH MUC API BACKEND PHUC VU ADMIN OMS PORTAL

| Method | Endpoint | Yeu cau Header | Chuc nang |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Khong | Dang nhap Admin/Staff (chan khach thuong) |
| `GET` | `/api/users/staff` | `Bearer <token>` | Lay danh sach nhan su Staff de phan cong |
| `GET` | `/api/orders` | `Bearer <token>` | Lay toan bo don hang tren he thong tu Supabase |
| `PATCH` | `/api/orders/:id` | `Bearer <token>` | Duyet tien VietQR, cap IP Hosting/DNS, ghi vet timeline |
| `DELETE` | `/api/orders/:id` | `Bearer <token>` (Admin) | Xoa don hang vinh vien khoi CSDL |
| `POST` | `/api/advice/sales-script` | `Bearer <token>` | Gemini AI soan kich ban goi dien Telesale 3 buoc |
| `POST` | `/api/admin/users` | `Bearer <token>` (Admin) | Tao tai khoan nhan vien Staff moi |
| `DELETE` | `/api/admin/users/:id` | `Bearer <token>` (Admin) | Thu hoi / Xoa tai khoan nhan vien |
| `GET` | `/api/admin/coupons` | `Bearer <token>` (Admin) | Lay danh sach coupon khuyen mai |
| `POST` | `/api/admin/coupons` | `Bearer <token>` (Admin) | Them hoac cap nhat ma coupon |
| `DELETE` | `/api/admin/coupons/:code` | `Bearer <token>` (Admin) | Xoa ma giam gia khoi CSDL |
| `PUT` | `/api/admin/settings` | `Bearer <token>` (Admin) | Cap nhat so tai khoan ngan hang VietQR |
| `DELETE` | `/api/admin/reviews/:id` | `Bearer <token>` (Admin) | Xoa danh gia spam khoi CSDL Supabase |

---

## 10. CHECKLIST TU KIEM TRA TRUOC KHI BAN GIAO CODE CHO LEADER

- [ ] Chay lenh `node --check server.js` va `node --check public/js/admin.js` khong duoc bao loi cu phap.
- [ ] Dang nhap tai khoan `admin` / `admin123@password`:
  - [ ] Kiem tra 4 the KPI co tinh dung so tien va so don khong.
  - [ ] Thu go tim kiem vao o search, doi trang thai loc xem bang co loc dung khong.
  - [ ] Mo 1 don hang cho duyet, bam "AI Soan Kich Ban Goi Dien" xem co hien ra 3 buoc khong.
  - [ ] Bam "Xac Nhan Da Nhan Tien" xem don co chuyen sang Paid va co duoc cap IP `103.221.220.xxx` khong.
  - [ ] Bam "Xuat Bao Cao CSV" -> mo file Excel len kiem tra font tieng Viet co dau co bi loi khong.
  - [ ] Thu tao 1 nhan vien Staff moi, dang xuat roi dang nhap bang tai khoan Staff do xem cac panel Admin co bi an dung quyen khong.
  - [ ] Thu doi so tai khoan ngan hang -> kiem tra ma QR preview co doi theo khong.
- [ ] Tuyet doi khong chen icon hoac emoji vao code va giao dien.
- [ ] Ban giao code tren nhanh `feat/admin-portal` de Leader kiem tra.
