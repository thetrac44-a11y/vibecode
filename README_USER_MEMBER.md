# HUONG DAN NHIEM VU: THANH VIEN 1 — CONG MUA SAM KHÁCH HANG (USER PORTAL & AI ADVISOR)

Tai lieu nay danh rieng cho **Thanh vien 1** phu trach toan bo phan Khach hang va Tro ly mua sam AI trong du an HostingAdvisor.

---

## 1. THONG TIN CHUNG & PHAM VI CONG VIEC

- **Nhanh Git lam viec:** `feat/user-portal`
- **Cac file chinh can code:**
  - `public/js/app.js` (Logic giao dien, thuat toan goi, gio hang, VietQR, danh gia)
  - `public/index.html` (Cau truc giao dien khach hang)
  - `server.js` (Cac route API phuc vu khach hang)
- **Cac file chi doc tham khao (khong sua):**
  - `public/js/plans.js` (Danh muc 6 goi Hosting/VPS chuan)
  - `public/js/domains.js` (Bang gia 4 duoi ten mien)
  - `public/js/addons.js` (Danh muc 3 dich vu mua kem)
  - `public/js/faq.js` (Danh sach cau hoi thuong gap)
  - `db.js` (Tang truy xuat CSDL Supabase PostgreSQL do Leader viet san)

---

## 2. CHECKLIST 4 HANG MUC CONG VIEC CAN HOAN THANH

Tim tu khoa `TODO [USER PORTAL - THANH VIEN 1]` trong code de den dung vi tri can viet.

### HANG MUC 1: Thuat Toan Cham Diem De Xuat 3 Goi & Bang So Sanh

1. **Ham `recommendPlans(needs)` trong `public/js/app.js`:**
   - **Dau vao:** Doi tuong `needs` gom:
     - `needs.siteType`: Loai website (`'blog'`, `'company'`, `'ecommerce'`, `'webapp'`).
     - `needs.traffic`: Luu luong (`'low'` < 1.000, `'medium'` 1.000 - 10.000, `'high'` 10.000 - 50.000, `'very_high'` > 50.000).
     - `needs.budget`: Ngan sach khach hang (so tien VND/thang).
     - `needs.needDomain`: Khach co can mua ten mien khong (`true`/`false`).
   - **Logic xu ly:**
     - Duyet qua danh sach 6 goi trong `window.PLANS_DATA`.
     - Tinh diem phu hop cho tung goi dua vao do chenh lech gia voi ngan sach, kha nang chiu tai luu luong va tinh nang tang kem ten mien (`plan.freeDomain`).
     - Sap xep diem giam dan.
   - **Dau ra:** Tra ve mang dung **03 goi dat diem cao nhat** (Goi vi tri 0 la goi phu hop nhat, 2 goi tiep theo la phuong an thay the).

2. **Ham `renderComparisonTable(planIds, bestPlanId)` trong `public/js/app.js`:**
   - Ve bang so sanh truc quan giua 3 goi duoc de xuat vao `#comparison-thead` va `#comparison-tbody`.
   - Cac dong so sanh gom: Gia theo thang, Dung luong o cung NVMe, Bang thong, Luot truy cap khuyen nghi, Uu dai ten mien, Doi tuong phu hop va Nut "Chon Mua".
   - Lam noi bat cot cua goi `bestPlanId` bang vien xanh va nhan "Goi toi uu nhat".

---

### HANG MUC 2: Tich Hop Gemini AI Tu Van Goi & Ten Mien

1. **API `POST /api/advice` trong `server.js`:**
   - **Dau vao:** Nhap tu body gom: `websiteTypeLabel`, `trafficLabel`, `budgetLabel`, `recommendedPlanName`, `recommendedPlanPrice`, `domainQuery`.
   - **Prompt gui Gemini:**
     - Dong vai Chuyen gia Kien truc Ha tang Hosting & Ten mien.
     - Viet dung 3-4 cau tieng Viet ngan gon, chuyen nghiep, khong dung emoji:
       1. Giai thich vi sao cau hinh goi nay dap ung tot loai web va luu luong cua khach.
       2. Khuyen khach chon chu ky 24 hoac 36 thang de tiet kiem 10%-20% va tich chon them Daily Backup.
       3. Tu van khach dang ky duoi ten mien .vn hoac .com de bao ve thuong hieu.
   - **Fallback tu dong:** Neu Gemini loi hoac mat mang, phai tra ve doan van ban mau mac dinh hop ly de giao dien khong bao gio bi trang hoac bao loi.

2. **Ham `getAIAdvice(needs, top3Plans)` trong `public/js/app.js`:**
   - Goi fetch toi `POST /api/advice` de lay cau tra loi.
   - Tra ve object de ham `renderAIResults()` hien thi len the ket qua tu van.

---

### HANG MUC 3: Gio Hang E-Commerce, Ma Giam Gia, VietQR & Hoa Don PDF

1. **Ham `calculateCartTotal(...)` trong `public/js/app.js`:**
   - **Chu ky thanh toan:** 12 thang (nguyen gia), 24 thang (giam 10%), 36 thang (giam 20%).
   - **Tien ten mien:** Neu goi co `plan.freeDomain === true` thi tinh 0d; neu khong tinh theo bang gia duoi ten mien khach chon.
   - **Tien Add-ons:** Tinh tong tien cac dich vu cong them khach tich chon (Daily Backup, Dedicated IP, Whois Privacy).
   - **Ma giam gia:** Tru so tien giam theo % hoac tien mat co dinh.
   - **URL VietQR dong:** Tao link anh QR theo chuan:
     `https://img.vietqr.io/image/{bankId}-{accountNo}-compact2.png?amount={finalTotal}&addInfo={orderCode}&accountName={accountName}`

2. **API `POST /api/coupons/validate` trong `server.js`:**
   - Kiem tra ma khach nhap voi danh sach coupon trong database (`db.getCoupons()`).
   - Tinh so tien giam va tra ve so tien thanh toan cuoi cung.

3. **API `POST /api/orders` trong `server.js` & Su kien Dat Hang trong `public/js/app.js`:**
   - Bat buoc khach nhap Ho ten va So dien thoai.
   - Luu don hang moi vao CSDL qua `db.createOrder(...)`.
   - Luu song song thong tin vao `localStorage.getItem('leads')` de phuc vu barem cham thi co ban.

4. **Ham `openInvoiceModal(order)` trong `public/js/app.js`:**
   - Hien thi Hoa don dien tu (E-Invoice) vao khung `#invoice-content-area`.
   - Dong moc "DA THANH TOAN (PAID)" mau xanh neu don da duyet, hoac "CHO THANH TOAN (UNPAID)" mau do neu chua duyet.
   - Co nut in hoa don goi `window.print()` va nut dong hoa don ghim co dinh tren cung.

---

### HANG MUC 4: Danh Gia Khach Hang Phan Trang & FAQ & Tra Cuu Don

1. **Ham `renderCustomerReviews(reviews)` trong `public/js/app.js`:**
   - Lay danh sach danh gia tu CSDL qua `GET /api/reviews`.
   - Tinh diem danh gia trung binh (vi du: 5.0 / 5) va tong so luot danh gia hien thi len `#reviews-summary-bar`.
   - **Phan trang co dinh:** Moi trang chi hien thi dung 3 the danh gia tren 1 hang ngang.
   - Ve thanh dieu huong `#reviews-pagination-bar` co nut "Trang truoc", cac nut so trang (1, 2, 3...) va "Trang sau".

2. **Form gui danh gia `#customer-review-form` trong `public/js/app.js`:**
   - Cho khach gui Ho ten, Ten Shop, Goi da dung, Diem danh gia (1-5 sao) va Nhan xet.
   - Goi `POST /api/reviews` de luu thang len Supabase.

3. **Ham `renderFAQAccordion()` trong `public/js/app.js`:**
   - Render danh sach cau hoi tu `window.FAQ_DATA`.
   - Bat su kien click de dong/mo tung cau hoi (Accordion).

4. **Ham `openMyOrdersModal()` trong `public/js/app.js`:**
   - Cho phep khach nhap So dien thoai vao o tra cuu de xem lai toan bo don hang da dat va thong so IP Hosting da duoc cap.

---

## 3. KICH BAN DEMO KHI THUYET TRINH TRUOC BAN GIAM KHAO

Thanh vien 1 se dong vai **Khach hang / Chu Shop online** va thao tac truc tiep:
1. Mo trang chu `index.html`, chon loai web "Ban hang", luu luong "1.000 - 10.000 luot", ngan sach "150.000d", chon can mua ten mien ".vn".
2. Bam nut "Phan Tich Nhu Cau & Goi Y Bang AI" -> Chi vao man hinh gioi thieu:
   - "Day la goi #1 do thuat toan lua chon kem loi giai thich tu Gemini AI."
   - "Day la bang so sanh thong so ky thuat giua 3 goi."
3. Bam nut "Chon Mua & Cau hinh goi" tren goi Business:
   - Chon chu ky 24 thang -> gia tu dong giam 10%.
   - Nhap ma giam gia `VIBE2026` -> giam tiep 15%.
   - Nhap Ho ten va So dien thoai.
   - Bam "Xac Nhan Dat Don" -> Ma VietQR dong xuat hien dung voi so tien va so tai khoan ngan hang.
   - Bam "Toi Da Chuyen Khoan Thanh Cong" -> Don hang chuyen sang trang thai cho duyet.
   - Mo Hoa don dien tu E-Invoice xem va mo phong lenh in PDF (`Ctrl + P`).
4. Cuon xuong phan Danh gia: Gui 1 nhan xet moi va chuyen qua lai giua cac trang 1, 2, 3 de chung minh he thong phan trang muot ma.

---

## 4. CHECKLIST TU KIEM TRA TRUOC KHI TAO PULL REQUEST (PR)

- [ ] Kiem tra cu phap code: chay `node --check server.js` va `node --check public/js/app.js` khong bao loi.
- [ ] Mo trinh duyet o che do an danh, tao thu 1 don hang va gui thu 1 danh gia xem co hien thi khong.
- [ ] Kiem tra responsive tren dien thoai (F12 che do Mobile) xem menu va cac Modal co bi lech khong.
- [ ] Khong dung bat ky icon hoac emoji nao trong code.
- [ ] Push code len nhanh `feat/user-portal` va bao Leader review code.
