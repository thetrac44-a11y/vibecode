/**
 * server.js — BỘ KHUNG DỰ ÁN (PROJECT SKELETON / STARTER KIT)
 * Hệ thống Tư vấn Hosting/Domain AI & Quản trị Đơn hàng Thương mại Điện tử (OMS)
 *
 * [ĐÃ CÓ SẴN TRONG KHUNG CỦA LEADER]:
 * - Kết nối Cloud SQL: Supabase PostgreSQL thông qua db.js (kèm Fallback db.json)
 * - Bảo mật mật khẩu băm SHA-256 + Salt & Xác thực phân quyền JWT RBAC (Admin / Staff / Customer)
 * - API Danh mục gốc (/api/catalog) và API Đăng nhập / Đăng ký (/api/auth/*)
 *
 * [PHẦN VIỆC PHÂN CÔNG CHO CÁC THÀNH VIÊN TRONG ĐỘI — TÌM TỪ KHÓA "TODO"]:
 * - NHIỆM VỤ 1 (Thành viên 1): Hoàn thiện API Tư vấn AI (/api/advice)
 * - NHIỆM VỤ 2 (Thành viên 2): Hoàn thiện API Kiểm tra Mã giảm giá (/api/coupons/validate) & Đặt hàng VietQR (/api/orders)
 * - NHIỆM VỤ 3 (Thành viên 3): Hoàn thiện API Quản trị Đơn hàng OMS (/api/orders/:id) & AI Telesale (/api/advice/sales-script)
 * - NHIỆM VỤ 4 (Thành viên 4): Hoàn thiện API Đánh giá Khách hàng (/api/reviews) & Tra cứu đơn hàng (/api/orders/my-orders)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'hosting_advisor_v33_ecommerce_secret_2026';

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// 1. BẢO MẬT MẬT KHẨU (SHA-256 + SALT) & KHỞI TẠO DATABASE (DO LEADER THIẾT LẬP)
// ============================================================================

function hashPassword(plainPassword, salt = null) {
  const actualSalt = salt || crypto.randomBytes(8).toString('hex');
  const hash = crypto
    .createHmac('sha256', actualSalt)
    .update(String(plainPassword))
    .digest('hex');
  return `sha256$${actualSalt}$${hash}`;
}

function verifyPassword(plainPassword, storedPassword) {
  if (!storedPassword) return false;
  if (String(storedPassword).startsWith('sha256$')) {
    const parts = String(storedPassword).split('$');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    return hashPassword(plainPassword, salt) === storedPassword;
  }
  return String(plainPassword) === String(storedPassword);
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

db.initDatabase(hashPassword).catch((err) => {
  console.error('[DB] Lỗi khởi tạo Database:', err.message);
});

// ============================================================================
// 2. MIDDLEWARE XÁC THỰC JWT & PHÂN QUYỀN RBAC (DO LEADER THIẾT LẬP)
// ============================================================================

function extractUserFromHeader(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function authenticateToken(req, res, next) {
  const decoded = extractUserFromHeader(req);
  if (!decoded) {
    return res.status(401).json({ ok: false, error: 'Vui lòng đăng nhập để thực hiện thao tác này.' });
  }
  req.user = decoded;
  next();
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        ok: false,
        error: 'Bạn không có quyền truy cập chức năng này (Yêu cầu quyền: ' + allowedRoles.join(', ') + ').'
      });
    }
    next();
  };
}

// ============================================================================
// 3. API TRẠNG THÁI DATABASE, DANH MỤC GỐC & ĐĂNG NHẬP (DO LEADER THIẾT LẬP)
// ============================================================================

app.get('/api/db-status', (req, res) => {
  return res.json({ ok: true, ...db.getDbStatus() });
});

app.get('/api/catalog', async (req, res) => {
  try {
    const [catalog, reviews] = await Promise.all([db.getCatalogData(), db.getReviews()]);
    return res.json({
      ok: true,
      dbStatus: db.getDbStatus(),
      settings: catalog.settings,
      plans: catalog.plans,
      domain_pricing: catalog.domain_pricing,
      addons: catalog.addons,
      reviews
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi tải danh mục: ' + err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, fullName, phone, email } = req.body || {};
    if (!username || !password || !fullName || !phone) {
      return res.status(400).json({ ok: false, error: 'Vui lòng điền đầy đủ thông tin đăng ký.' });
    }
    const cleanUsername = String(username).trim().toLowerCase();
    const existing = await db.getUserByUsername(cleanUsername);
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Tên đăng nhập này đã tồn tại.' });
    }
    const newUser = await db.createUser({
      id: `USR-${Date.now().toString().slice(-6)}`,
      username: cleanUsername,
      password: hashPassword(String(password)),
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      email: String(email || '').trim(),
      role: 'customer',
      createdAt: new Date().toISOString()
    });
    const token = jwt.sign(sanitizeUser(newUser), JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ ok: true, token, user: sanitizeUser(newUser) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = await db.getUserByUsername(String(username || '').trim().toLowerCase());
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ ok: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    }
    const token = jwt.sign(sanitizeUser(user), JWT_SECRET, { expiresIn: '7d' });
    return res.json({ ok: true, token, user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const user = await db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ ok: false, error: 'Không tìm thấy người dùng.' });
  return res.json({ ok: true, user: sanitizeUser(user) });
});

app.get('/api/users/staff', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  const allUsers = await db.getAllUsers();
  const staff = allUsers.filter((u) => u.role === 'admin' || u.role === 'staff').map(sanitizeUser);
  return res.json({ ok: true, staff });
});

// ============================================================================
// NHIỆM VỤ 1 (THÀNH VIÊN 1): TÍCH HỢP GEMINI AI TƯ VẤN GÓI HOSTING & TÊN MIỀN
// ============================================================================

async function callGeminiText(promptText) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 420 }
    })
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

app.post('/api/advice', async (req, res) => {
  // TODO [USER PORTAL - THÀNH VIÊN 1]:
  // 1. Lấy các tham số từ req.body: websiteTypeLabel, trafficLabel, budgetLabel, recommendedPlanName, recommendedPlanPrice, domainQuery
  // 2. Xây dựng câu lệnh Prompt đóng vai Chuyên gia Hạ tầng Web giải thích ngắn gọn 3-4 câu vì sao gói được chọn là tối ưu + khuyên chu kỳ 24/36 tháng + tư vấn đuôi tên miền .vn/.com.
  // 3. Gọi hàm callGeminiText(prompt) để lấy phản hồi từ Gemini AI.
  // 4. Viết đoạn văn bản Fallback dự phòng khi không có mạng hoặc hết hạn mức API.
  const { recommendedPlanName = 'Business', recommendedPlanPrice = '129.000đ/tháng' } = req.body || {};
  return res.json({
    ok: true,
    source: 'todo-skeleton',
    advice: `[TODO - Nhiệm vụ 1]: Hãy hoàn thiện logic gọi Gemini AI tại route POST /api/advice trong server.js cho gói ${recommendedPlanName} (${recommendedPlanPrice}).`
  });
});

// ============================================================================
// NHIỆM VỤ 2 (THÀNH VIÊN 2): KIỂM TRA MÃ GIẢM GIÁ, TẠO ĐƠN HÀNG & MÃ VIETQR
// ============================================================================

app.post('/api/coupons/validate', async (req, res) => {
  // TODO [USER PORTAL - THÀNH VIÊN 1]:
  // 1. Lấy { code, rawTotal, subTotal } từ req.body
  // 2. Tìm mã giảm giá trong danh sách await db.getCoupons()
  // 3. Nếu type === 'percent' thì tính % giảm; nếu type === 'fixed' thì trừ số tiền cố định
  // 4. Trả về { ok: true, code, description, discountAmount, finalAmount }
  return res.status(400).json({
    ok: false,
    error: '[TODO - Nhiệm vụ 2]: Hãy hoàn thiện API kiểm tra mã giảm giá tại POST /api/coupons/validate trong server.js'
  });
});

app.post('/api/orders', async (req, res) => {
  // TODO [USER PORTAL - THÀNH VIÊN 1]:
  // 1. Kiểm tra Họ tên (customerName) và Số điện thoại (phone) người mua
  // 2. Tính tiền Gói Hosting theo chu kỳ 12/24/36 tháng (giảm 10% cho 24T, 20% cho 36T)
  // 3. Tính tiền Tên miền (miễn phí nếu plan.freeDomain === true) và tiền các dịch vụ mua kèm (Add-ons)
  // 4. Tạo link ảnh VietQR động theo cấu hình ngân hàng trong catalog.settings
  // 5. Lưu đơn hàng mới lên Supabase qua await db.createOrder(...) và trả về { ok: true, order }
  return res.status(400).json({
    ok: false,
    error: '[TODO - Nhiệm vụ 2]: Hãy hoàn thiện API tạo đơn hàng & sinh mã VietQR tại POST /api/orders trong server.js'
  });
});

app.post('/api/orders/:id/confirm-payment', async (req, res) => {
  // TODO [USER PORTAL - THÀNH VIÊN 1]:
  // Tìm đơn hàng theo req.params.id qua db.getOrderById(id), cập nhật trạng thái thanh toán,
  // cấp phát IP Hosting mẫu (103.221.220.xxx) và lưu lại qua await db.updateOrder(order)
  return res.status(400).json({
    ok: false,
    error: '[TODO - Nhiệm vụ 2]: Hãy hoàn thiện API xác nhận thanh toán tại POST /api/orders/:id/confirm-payment'
  });
});

// ============================================================================
// NHIỆM VỤ 3 (THÀNH VIÊN 3): CỔNG QUẢN TRỊ ĐƠN HÀNG OMS & AI TELESALE
// ============================================================================

app.get('/api/orders', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  const orders = await db.getAllOrders();
  return res.json({ ok: true, orders });
});

app.patch('/api/orders/:id', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  // TODO [ADMIN PORTAL - THÀNH VIÊN 2]:
  // 1. Tìm đơn hàng qua await db.getOrderById(req.params.id)
  // 2. Cho phép Admin phân công nhân sự phụ trách (assignedTo)
  // 3. Khi duyệt trạng thái status === 'completed', đổi paymentStatus = 'paid' và sinh thông số IP Hosting + DNS
  // 4. Ghi thêm vết lịch sử vào mảng order.timeline và lưu qua await db.updateOrder(order)
  return res.status(400).json({
    ok: false,
    error: '[TODO - Nhiệm vụ 3]: Hãy hoàn thiện API duyệt đơn & cấp IP tại PATCH /api/orders/:id trong server.js'
  });
});

app.delete('/api/orders/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const removed = await db.deleteOrderById(req.params.id);
  if (!removed) return res.status(404).json({ ok: false, error: 'Không tìm thấy đơn hàng.' });
  return res.json({ ok: true, deletedOrder: removed });
});

app.post('/api/advice/sales-script', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  // TODO [ADMIN PORTAL - THÀNH VIÊN 2]:
  // Lấy thông tin đơn hàng theo orderId, tạo Prompt gửi Gemini AI để sinh Kịch bản gọi điện Telesale 3 bước
  // (Bước 1: Chào hỏi & Xác nhận đơn -> Bước 2: Tư vấn kỹ thuật & Thanh toán -> Bước 3: Up-sell Backup/Tên miền)
  return res.json({
    ok: true,
    source: 'todo-skeleton',
    script: '[TODO - Nhiệm vụ 3]: Hãy hoàn thiện logic gọi Gemini AI soạn kịch bản Telesale 3 bước tại POST /api/advice/sales-script.'
  });
});

// Các API Quản trị Hệ thống dành cho Admin (Nhân sự, Coupon, Ngân hàng VietQR)
app.post('/api/admin/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { username, password, fullName, phone, email, role } = req.body || {};
  if (!username || !password || !fullName) return res.status(400).json({ ok: false, error: 'Thiếu thông tin nhân sự.' });
  const newStaff = await db.createUser({
    id: `USR-${Date.now().toString().slice(-6)}`,
    username: String(username).trim().toLowerCase(),
    password: hashPassword(String(password)),
    fullName: String(fullName).trim(),
    phone: String(phone || '').trim(),
    email: String(email || '').trim(),
    role: role === 'admin' ? 'admin' : 'staff',
    createdAt: new Date().toISOString()
  });
  return res.status(201).json({ ok: true, user: sanitizeUser(newStaff) });
});

app.delete('/api/admin/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const removed = await db.deleteUserById(req.params.id);
  return res.json({ ok: true, deletedUser: sanitizeUser(removed) });
});

app.get('/api/admin/coupons', authenticateToken, requireRole(['admin']), async (req, res) => {
  return res.json({ ok: true, coupons: await db.getCoupons() });
});

app.post('/api/admin/coupons', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { code, type, value, description } = req.body || {};
  const c = await db.upsertCoupon({
    code: String(code || '').trim().toUpperCase(),
    type: type === 'fixed' ? 'fixed' : 'percent',
    value: Number(value) || 10,
    description: String(description || '').trim()
  });
  return res.status(201).json({ ok: true, coupon: c, coupons: await db.getCoupons() });
});

app.delete('/api/admin/coupons/:code', authenticateToken, requireRole(['admin']), async (req, res) => {
  await db.deleteCouponByCode(req.params.code);
  return res.json({ ok: true, coupons: await db.getCoupons() });
});

app.put('/api/admin/settings', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { bankId, accountNo, accountName } = req.body || {};
  const s = await db.updateBankSettings({
    bankId: String(bankId || 'MB').trim().toUpperCase(),
    accountNo: String(accountNo || '').trim(),
    accountName: String(accountName || '').trim().toUpperCase()
  });
  return res.json({ ok: true, settings: s });
});

// ============================================================================
// NHIỆM VỤ 4 (THÀNH VIÊN 4): ĐÁNH GIÁ KHÁCH HÀNG & TRA CỨU ĐƠN HÀNG THEO SĐT
// ============================================================================

app.get('/api/reviews', async (req, res) => {
  return res.json({ ok: true, reviews: await db.getReviews() });
});

app.post('/api/reviews', async (req, res) => {
  // TODO [USER PORTAL - THÀNH VIÊN 1]:
  // 1. Kiểm tra hợp lệ: Họ tên (customerName) và Nội dung nhận xét (comment) không được để trống
  // 2. Tạo object đánh giá mới và lưu lên Supabase qua await db.createReview(...)
  // 3. Trả về { ok: true, review }
  return res.status(400).json({
    ok: false,
    error: '[TODO - Nhiệm vụ 4]: Hãy hoàn thiện API lưu đánh giá khách hàng tại POST /api/reviews trong server.js'
  });
});

app.delete('/api/admin/reviews/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  await db.deleteReviewById(req.params.id);
  return res.json({ ok: true, reviews: await db.getReviews() });
});

app.get('/api/orders/my-orders', async (req, res) => {
  // TODO [USER PORTAL - THÀNH VIÊN 1]:
  // Lọc danh sách đơn hàng từ await db.getAllOrders() theo user đang đăng nhập HOẶC theo số điện thoại req.query.phone
  return res.json({ ok: true, orders: [] });
});

app.listen(PORT, () => {
  console.log(`[STARTER KIT] Server đang chạy tại: http://localhost:${PORT}`);
});

