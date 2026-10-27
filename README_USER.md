# CAM NANG LAP TRINH CHI TIET: PHAN QUYEN KHACH HANG (USER PORTAL & AI ADVISOR)

Tai lieu nay la cam nang huong dan lap trinh chi tiet tung buoc (Step-by-step Developer Guide) danh rieng cho lap trinh vien phu trach **Cong Mua Sam Khach Hang (User Portal)** trong du an HostingAdvisor.

---

## MUC LUC
1. Kien truc Phan quyen Khach hang (Customer Role & Authentication)
2. Ban do Du lieu Supabase PostgreSQL lien quan den Khach hang
3. Huong dan chi tiet Chuc nang 1: Khao sat Nhu cau & Thuat toan Cham diem 3 Goi
4. Huong dan chi tiet Chuc nang 2: Tro ly Gemini AI Tu van Goi & Ten mien
5. Huong dan chi tiet Chuc nang 3: Gio hang E-Commerce, VietQR & Hoa don dien tu
6. Huong dan chi tiet Chuc nang 4: He thong Danh gia Khach hang co Phan trang (Supabase)
7. Huong dan chi tiet Chuc nang 5: Tra cuu Don hang theo So dien thoai
8. Danh muc API Backend can lam viec & Ket noi Database qua db.js
9. Checklist Tu kiem tra truoc khi ban giao code

---

## 1. KIEN TRUC PHAN QUYEN KHACH HANG (AUTHENTICATION & RBAC)

### 1.1. Hai trang thai cua nguoi dung phia Client:
- **Khach vang lai (Guest):** Chua dang nhap tai khoan.
  - Duoc phep: Xem danh muc goi, su dung AI khao sat nhu cau, dat mua truc tiep (dien Ho ten, SDT, Email ngay tai Checkout), tra cuu don hang theo SDT, gui danh gia thuc te.
  - Khong duoc thay: Nut "Cong Quan Tri" tren thanh Header.
- **Khach da dang nhap (Logged-in Customer - role = 'customer'):**
  - Duoc luu JWT Token tai `localStorage.getItem('ha_token')`.
  - Tren Header hien thi "Chao, [Ho ten]" kem nut "Thoat".
  - Khi mo hop thoai Thanh toan (Checkout) hoac gui Danh gia, thong tin Ho ten, SDT, Email tu dong duoc dien san.
  - Tuyet doi KHONG duoc phep hien thi nut "Cong Quan Tri" (`#nav-admin-link` phai co class `hidden`).

### 1.2. Xu ly Token & Giao dien Header trong `public/js/app.js`:
```javascript
function updateNavbarAuthUI() {
  const guestBox = document.getElementById('nav-guest-box');
  const userBox = document.getElementById('nav-user-box');
  const greeting = document.getElementById('nav-user-greeting');
  const adminLink = document.getElementById('nav-admin-link');

  if (currentAuthUser && currentAuthToken) {
    guestBox?.classList.add('hidden');
    userBox?.classList.remove('hidden');
    userBox?.classList.add('flex');
    if (greeting) greeting.textContent = `Chao, ${currentAuthUser.fullName}`;

    // Chi role admin hoac staff moi hien nut Cong Quan Tri
    if (currentAuthUser.role === 'admin' || currentAuthUser.role === 'staff') {
      adminLink?.classList.remove('hidden');
    } else {
      adminLink?.classList.add('hidden');
    }
  } else {
    guestBox?.classList.remove('hidden');
    userBox?.classList.add('hidden');
    userBox?.classList.remove('flex');
    adminLink?.classList.add('hidden');
  }
}
```

---

## 2. BAN DO DU LIEU SUPABASE POSTGRESQL LIEN QUAN DEN USER PORTAL

Toan bo du lieu dong duoc Backend Express (`server.js`) lay tu Supabase PostgreSQL thong qua tang `db.js`. Lap trinh vien phia User Portal lam viec voi cac bang sau:

1. **Bang `public.plans`:** Danh muc 6 goi Hosting/VPS.
   - Cac truong: `id`, `name`, `category`, `price_monthly`, `cpu`, `ram`, `storage`, `bandwidth`, `domains`, `ssl_free`, `best_for`.
2. **Bang `public.domain_pricing`:** Bang gia 4 duoi ten mien (`.com`, `.vn`, `.com.vn`, `.shop`).
   - Cac truong: `tld`, `reg_price`, `renew_price`, `badge`.
3. **Bang `public.addons`:** 3 dich vu mua kem (Whois Privacy, Daily Backup, Dedicated IP).
   - Cac truong: `id`, `name`, `price`, `billing`, `description`.
4. **Bang `public.coupons`:** Danh sach ma giam gia dang hoat dong (`VIBE2026`, `CHUSHOP`).
   - Cac truong: `code`, `type` ('percent' hoac 'fixed'), `value`, `description`.
5. **Bang `public.orders`:** Noi luu tru moi don hang khach dat mua.
   - Cac truong: `id`, `invoice_id`, `customer_name`, `phone`, `email`, `plan_id`, `plan_name`, `billing_cycle_months`, `domain_name`, `addons`, `coupon_applied`, `total_amount`, `payment_status`, `status`, `qr_url`, `timeline`.
6. **Bang `public.reviews`:** Noi luu tru danh gia thuc te cua khach.
   - Cac truong: `id`, `customer_name`, `business_name`, `plan_name`, `rating` (1-5), `comment`, `created_at`.
7. **Bang `public.settings`:** Chua thong tin Ngan hang nhan tien VietQR dong (`bank_id`, `account_no`, `account_name`).

---

## 3. HUONG DAN CHI TIET CHUC NANG 1: KHAO SAT NHU CAU & THUAT TOAN CHAM DIEM 3 GOI

### 3.1. Thu thap du lieu khao sat tu Form (`#needs-form`):
Khi nguoi dung bam nut "Phan Tich Nhu Cau & Goi Y Bang AI", lay cac gia tri sau:
- Loai web: `document.querySelector('input[name="siteType"]:checked')?.value` (gia tri: `'blog'`, `'company'`, `'ecommerce'`, `'webapp'`).
- Luu luong: `document.getElementById('traffic')?.value` (gia tri: `'low'`, `'medium'`, `'high'`, `'very_high'`).
- Ngan sach: `Number(document.getElementById('budget')?.value) || 150000`.
- Can ten mien: `Boolean(document.getElementById('needDomain')?.checked)`.
- Ten mien mong muon: `document.getElementById('desiredDomain')?.value.trim()`.
- Duoi uu tien: `document.getElementById('preferredExtension')?.value || '.vn'`.

Gom thanh doi tuong `needs = { siteType, traffic, budget, needDomain, desiredDomain, preferredExtension }`.

### 3.2. Viet ham Thuat toan Cham diem `recommendPlans(needs)` trong `public/js/app.js`:
Duyet qua 6 goi trong `window.PLANS_DATA`, tinh diem so (`score`) cho tung goi theo cong thuc:
```javascript
function recommendPlans(needs) {
  const plans = window.PLANS_DATA || [];
  const scored = plans.map((plan) => {
    let score = 50;

    // 1. Diem phu hop loai website
    if (needs.siteType === 'ecommerce' && (plan.id === 'business' || plan.id === 'shop-pro')) score += 35;
    if (needs.siteType === 'blog' && (plan.id === 'starter' || plan.id === 'basic')) score += 30;
    if (needs.siteType === 'company' && (plan.id === 'basic' || plan.id === 'business')) score += 30;
    if (needs.siteType === 'webapp' && plan.type === 'VPS') score += 40;

    // 2. Diem phu hop luu luong
    if (needs.traffic === 'low' && plan.recommendedVisits <= 10000) score += 20;
    if (needs.traffic === 'medium' && plan.recommendedVisits >= 10000 && plan.recommendedVisits <= 30000) score += 25;
    if (needs.traffic === 'high' && plan.recommendedVisits >= 30000 && plan.recommendedVisits <= 80000) score += 25;
    if (needs.traffic === 'very_high' && plan.recommendedVisits >= 80000) score += 30;

    // 3. Diem phu hop ngan sach
    const budgetDiff = Math.abs(plan.pricePerMonth - needs.budget);
    if (budgetDiff <= 30000) score += 20;
    else if (plan.pricePerMonth <= needs.budget) score += 10;
    else score -= 15;

    // 4. Diem uu dai ten mien
    if (needs.needDomain && plan.freeDomain) score += 15;

    return { ...plan, score };
  });

  // Sap xep diem giam dan, lay dung 3 goi cao diem nhat
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}
```

### 3.3. Viet ham `renderComparisonTable(planIds, bestPlanId)` trong `public/js/app.js`:
Hien thi bang so sanh chi tiet giua 3 goi duoc de xuat gom:
- Tieu de cot: Ten goi, gia thang. Cot cua `bestPlanId` co vien xanh va nhan "Goi toi uu nhat".
- Cac hang tieu chi: Luu tru, Bang thong, Luot truy cap/thang, Uu dai ten mien, Ho tro ky thuat.
- Hang cuoi cung: Nut "Chon Mua & Cau Hinh Goi" gan su kien mo Modal Checkout (`openCheckoutModal(plan.id)`).

---

## 4. HUONG DAN CHI TIET CHUC NANG 2: TRO LY GEMINI AI TU VAN GOI & TEN MIEN

### 4.1. Viet API `POST /api/advice` trong `server.js`:
- **Method:** `POST`
- **URL:** `/api/advice`
- **Request Body (JSON):**
  ```json
  {
    "websiteTypeLabel": "Website Ban Hang / E-Commerce",
    "trafficLabel": "1.000 - 10.000 luot/thang",
    "budgetLabel": "150.000d/thang",
    "recommendedPlanName": "Business",
    "recommendedPlanPrice": "129.000d/thang",
    "domainQuery": "shopthoitrang.vn"
  }
  ```
- **Xu ly tren Server:**
  Xay dung prompt chuyen gia va gui toi Google Gemini 2.5 Flash thong qua endpoint:
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
  Yeu cau: Viet dung 3-4 cau tieng Viet de hieu, chuyen nghiep, khong dung bieu tuong cam xuc/emoji.
- **Co che Fallback tu dong (Bat buoc phai co):** Neu mat ket noi mang hoac loi API key, server tra ve doan giai thich du phong mau de giao dien van hien thi dep mat:
  ```javascript
  const fallbackAdvice = `Voi mo hinh ${websiteTypeLabel} va luu luong ${trafficLabel}, goi ${recommendedPlanName} (${recommendedPlanPrice}) cung cap o cung NVMe toc do cao va RAM doc lap giup trang tai nhanh duoi 1 giay. Ban nen uu tien dang ky chu ky 24 hoac 36 thang de duoc giam 10% den 20% chi phi, dong thoi tich chon them Sao luu tu dong hang ngay de bao ve du lieu. Ve thuong hieu, dang ky duoi ten mien .vn hoac .com se tang toi da uy tin cho doanh nghiep.`;
  ```
- **Response Body (JSON):**
  ```json
  {
    "ok": true,
    "source": "gemini",
    "advice": "Noi dung loi tu van cua AI..."
  }
  ```

---

## 5. HUONG DAN CHI TIET CHUC NANG 3: GIO HANG E-COMMERCE, VIETQR & HOA DON DIEN TU

### 5.1. Viet ham tinh toan tien gio hang `calculateCartTotal(...)` trong `public/js/app.js`:
```javascript
function calculateCartTotal(planPriceMonthly, cycleMonths, domainExtension, isPlanFreeDomain, selectedAddons, discountAmount, desiredDomain = '', orderCode = 'TAMTINH') {
  const cycle = [12, 24, 36].includes(Number(cycleMonths)) ? Number(cycleMonths) : 12;
  let cycleDiscountRatio = 0;
  if (cycle === 24) cycleDiscountRatio = 0.1; // Giam 10%
  if (cycle === 36) cycleDiscountRatio = 0.2; // Giam 20%

  const rawHosting = Number(planPriceMonthly || 0) * cycle;
  const hostingTotal = Math.round(rawHosting * (1 - cycleDiscountRatio));

  // Tinh tien ten mien
  let domainTotal = 0;
  const cleanDomain = String(desiredDomain || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (cleanDomain && domainExtension) {
    const extObj = (window.DOMAIN_PRICING || []).find((d) => d.extension === domainExtension);
    const extPrice = extObj ? extObj.price : 280000;
    domainTotal = isPlanFreeDomain ? 0 : extPrice; // Neu goi tang ten mien thi tinh 0d
  }

  // Tinh tien Add-ons
  let addonsTotal = 0;
  const addonItems = [];
  if (Array.isArray(selectedAddons)) {
    for (const addonId of selectedAddons) {
      const addon = (window.ADDONS_DATA || []).find((a) => a.id === addonId);
      if (addon) {
        const price = addon.billingType === 'monthly' ? addon.price * cycle : addon.price;
        addonsTotal += price;
        addonItems.push({ ...addon, computedPrice: price });
      }
    }
  }

  const subTotal = hostingTotal + domainTotal + addonsTotal;
  const validDiscount = Math.min(subTotal, Math.max(0, Number(discountAmount) || 0));
  const finalTotal = Math.max(0, subTotal - validDiscount);

  // Sinh link anh VietQR dong theo Ngan hang duoc cau hinh tu CSDL
  const bankId = window.APP_CONFIG?.BANK_ID || 'MB';
  const accountNo = window.APP_CONFIG?.ACCOUNT_NO || '0988123456';
  const accountName = window.APP_CONFIG?.ACCOUNT_NAME || 'CONG TY TNHH HOSTING ADVISOR';
  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${finalTotal}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(accountName)}`;

  return { cycle, cycleDiscountRatio, hostingTotal, domainTotal, addonsTotal, addonItems, subTotal, discountAmount: validDiscount, finalTotal, qrUrl };
}
```

### 5.2. Kiem tra ma giam gia qua API `POST /api/coupons/validate`:
- Nguoi dung nhap ma `VIBE2026` hoac `CHUSHOP` vao `#checkout-coupon-input`.
- Gui POST len server kem `rawTotal`. Server kiem tra trong CSDL:
  - Neu `coupon.type === 'percent'`: `discount = subTotal * value / 100`.
  - Neu `coupon.type === 'fixed'`: `discount = Math.min(subTotal, value)`.
- Cap nhat lai gia giam va goi lai `refreshCheckoutSummary()`.

### 5.3. Khoi tao Don hang qua API `POST /api/orders`:
- Khi khach bam **"1. Xac Nhan Dat Don & Lay Ma Don Hang"**:
  - Kiem tra bat buoc nhap Ho ten (`#checkout-cust-name`) va So dien thoai (`#checkout-cust-phone`).
  - Gui payload len `POST /api/orders`:
    ```json
    {
      "customerName": "Nguyen Van A",
      "phone": "0912345678",
      "email": "vana@gmail.com",
      "planId": "business",
      "billingCycleMonths": 24,
      "desiredDomain": "shopthoitrang",
      "domainExtension": ".vn",
      "addonIds": ["addon_backup"],
      "couponCode": "VIBE2026"
    }
    ```
  - Server tao ma don `ORD-2026-XXXXX`, luu vao bang `orders` tren Supabase va tra ve `data.order`.
  - Giao dien: Luu vao `localStorage.getItem('leads')`, an nut 1, hien thi nut **"2. Toi Da Chuyen Khoan Thanh Cong"** va nut **"Xem & In Hoa Don Dien Tu"**.

### 5.4. Xac nhan thanh toan qua API `POST /api/orders/:id/confirm-payment`:
- Khi khach bam nut "2. Toi Da Chuyen Khoan Thanh Cong", server chuyen don hang sang trang thai `completed` (`paid`), tu dong cap phat IP Hosting (`103.221.220.xxx`) va ghi vet `timeline`.

### 5.5. Hien thi Hoa don dien tu trong `openInvoiceModal(order)`:
- Do thong tin vao `#invoice-content-area`.
- Hien thi moc `DA THANH TOAN (PAID)` hoac `CHO THANH TOAN (UNPAID)`.
- Thanh dieu khien tren cung co nut **"In Hoa Don / Luu PDF"** (`window.print()`) va nut **"Dong Hoa Don"**. Khung chua duoc ghim `sticky top-0` va gioi han chieu cao `max-h-[88vh] overflow-y-auto` de khong bao gio bi tran khoi man hinh.

---

## 6. HUONG DAN CHI TIET CHUC NANG 4: HE THONG DANH GIA CO PHAN TRANG (SUPABASE)

### 6.1. Hien thi danh gia co phan trang trong `renderCustomerReviews(reviews, targetPage)`:
- Mang `allReviewsList` duoc tai tu server qua `GET /api/reviews`.
- **Thanh thong ke `#reviews-summary-bar`:** Tinh diem trung binh = `(tong diem) / (tong so danh gia)`, hien thi vi du: `Diem trung binh: 5.0 / 5.0 | Tong cong 7 danh gia`.
- **Phan trang 3 the / trang:**
  ```javascript
  const REVIEWS_PER_PAGE = 3;
  const totalPages = Math.ceil(allReviewsList.length / REVIEWS_PER_PAGE);
  const startIdx = (currentPage - 1) * REVIEWS_PER_PAGE;
  const pageItems = allReviewsList.slice(startIdx, startIdx + REVIEWS_PER_PAGE);
  ```
- Render 3 the danh gia vao `#reviews-list-container`.
- Render thanh dieu huong `#reviews-pagination-bar` gom nut "Trang truoc", cac nut so trang `1`, `2`, `3`... va nut "Trang sau".

### 6.2. Form gui danh gia thuc te `#customer-review-form`:
- Bat su kien `submit`: Kiem tra bat buoc Ho ten va Nhan xet.
- Gui `POST /api/reviews` len server:
  ```json
  {
    "customerName": "Trac The",
    "businessName": "Shop Lily",
    "planName": "Goi Business Hosting",
    "rating": 5,
    "comment": "Web chay cuc ky muot ma, khach dat hang am am!"
  }
  ```
- Sau khi thanh cong, goi lai `renderCustomerReviews()` va nhay ve Trang 1 de hien thi ngay nhan xet moi.

---

## 7. HUONG DAN CHI TIET CHUC NANG 5: TRA CUU DON HANG THEO SO DIEN THOAI

### 7.1. Ham `openMyOrdersModal(phoneOverride)` trong `public/js/app.js`:
- Mo modal `#my-orders-modal`.
- Khi khach nhap So dien thoai vao `#lookup-order-phone` va bam "Tra Cuu Don Hang", goi API:
  `GET /api/orders/my-orders?phone=0912345678`
- Hien thi danh sach cac don hang da dat cua so dien thoai nay kem theo:
  - Trang thai thanh toan (Paid / Unpaid).
  - Thong so IP Hosting va DNS (neu don da duoc kich hoat).
  - Nut "Xem Hoa Don" de mo lai file Hoa don dien tu.

---

## 8. DANH MUC API BACKEND PHUC VU USER PORTAL

| Method | Endpoint | Yeu cau Header | Chuc nang |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/catalog` | Khong | Lay toan bo goi cước, bang gia ten mien, add-ons, settings ngan hang va reviews tu Supabase |
| `POST` | `/api/auth/register` | Khong | Dang ky tai khoan khach hang moi |
| `POST` | `/api/auth/login` | Khong | Dang nhap khach hang lay JWT Token |
| `GET` | `/api/auth/me` | `Bearer <token>` | Kiem tra phien dang nhap hien tai |
| `POST` | `/api/advice` | Khong | Gemini AI tu van goi cuoc va ten mien theo nhu cau khao sat |
| `POST` | `/api/coupons/validate` | Khong | Kiem tra hop le va tinh so tien giam cua ma coupon |
| `POST` | `/api/orders` | Tuy chon token | Khoi tao don hang moi, luu vao Supabase qua `db.createOrder()` |
| `POST` | `/api/orders/:id/confirm-payment` | Tuy chon token | Xac nhan da thanh toan VietQR va kich hoat cap IP Hosting |
| `GET` | `/api/orders/my-orders?phone=...` | Tuy chon token | Tra cuu danh sach don hang theo SDT hoac theo tai khoan |
| `GET` | `/api/reviews` | Khong | Lay danh sach danh gia thuc te tu Supabase |
| `POST` | `/api/reviews` | Tuy chon token | Gui danh gia thuc te moi len Supabase qua `db.createReview()` |

---

## 9. CHECKLIST TU KIEM TRA TRUOC KHI BAN GIAO CODE CHO LEADER

- [ ] Chay lenh `node --check server.js` va `node --check public/js/app.js` khong duoc xuat hien bat ky loi cu phap nao.
- [ ] Mo trinh duyet an danh tai `http://localhost:3000/index.html`:
  - [ ] Nhan nut "Phan Tich Nhu Cau & Goi Y Bang AI" xem the goi so 1 va bang so sanh co hien ra khong.
  - [ ] Nhan nut "Chon Mua" tren 1 goi, ap ma `VIBE2026`, dien Ho ten, SDT -> xem ma VietQR co hien dung so tien va so tai khoan khong.
  - [ ] Nhan xac nhan don hang -> kiem tra hoa don dien tu co dong moc xanh PAID khong va thu lenh in `Ctrl + P`.
  - [ ] Gui 1 danh gia thu xem co xuat hien o trang 1 va phan trang co hoat dong khong.
  - [ ] Nhap SDT vua dat hang vao muc Tra Cuu Don xem co ra thong tin khong.
- [ ] Kiem tra che do Mobile (F12): Cac modal khong bi tran vien, nut dong ghim co dinh tren cung.
- [ ] Tuyet doi khong chen icon hoac emoji vao code va giao dien.
- [ ] Ban giao code tren nhanh `feat/user-portal` de Leader kiem tra.
