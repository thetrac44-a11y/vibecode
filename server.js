/**
 * server.js
 * Backend Thương mại Điện tử (E-Commerce) & Quản trị Đơn hàng (OMS) — Bản Production + Supabase PostgreSQL
 * - Kết nối Cloud SQL: Supabase PostgreSQL thông qua tầng dữ liệu db.js (có tự động Seed & Fallback db.json)
 * - Bảo mật mật khẩu băm một chiều (SHA-256 + Salt) bằng module crypto chuẩn Node.js
 * - Cung cấp API Danh mục động (/api/catalog), Quản trị Nhân sự (/api/admin/users),
 *   Quản trị Mã giảm giá (/api/admin/coupons), Cấu hình Ngân hàng VietQR (/api/admin/settings)
 * - Hỗ trợ khách đặt hàng trực tiếp hoặc qua tài khoản đăng nhập + Tra cứu đơn theo Số điện thoại
 * - Dual Gemini AI Proxy: Tư vấn Gói/Tên miền (/api/advice) & Kịch bản Telesale 3 bước (/api/advice/sales-script)
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
// 1. BẢO MẬT MẬT KHẨU (SHA-256 + SALT) & KHỞI TẠO DATABASE
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

// Khởi tạo kết nối Database (Supabase PostgreSQL hoặc Local db.json)
db.initDatabase(hashPassword).catch((err) => {
  console.error('[DB] Lỗi khởi tạo Database:', err.message);
});

// ============================================================================
// 2. MIDDLEWARE XÁC THỰC JWT & PHÂN QUYỀN RBAC (3 ROLES)
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
// 3. API TRẠNG THÁI DATABASE & DANH MỤC ĐỘNG (GET /api/db-status, GET /api/catalog)
// ============================================================================

app.get('/api/db-status', (req, res) => {
  return res.json({
    ok: true,
    ...db.getDbStatus()
  });
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
    return res.status(500).json({ ok: false, error: 'Lỗi tải danh mục từ Database: ' + err.message });
  }
});

// ============================================================================
// LEAD MANAGEMENT APIS (Quan ly Khach Hang Tiem Nang / Tu Van)
// ============================================================================

// POST /api/leads — Khach hang (bao gom guest) gui yeu cau tu van
app.post('/api/leads', async (req, res) => {
  try {
    const {
      customerName, phone, email,
      siteType, traffic, budget, needDomain, desiredDomain, preferredExtension,
      recommendedPlan, aiAdvice
    } = req.body || {};

    if (!customerName || String(customerName).trim().length < 2) {
      return res.status(400).json({ ok: false, error: 'Vui long nhap Ho ten (toi thieu 2 ky tu)' });
    }
    if (!phone || String(phone).trim().length < 9) {
      return res.status(400).json({ ok: false, error: 'Vui long nhap So dien thoai hop le' });
    }

    const leadId = crypto.randomUUID();
    const newLead = {
      id: leadId,
      customer_name: String(customerName).trim(),
      phone: String(phone).trim(),
      email: String(email || '').trim(),
      site_type: String(siteType || '').trim(),
      traffic: String(traffic || '').trim(),
      budget: Number(budget) || 0,
      need_domain: Boolean(needDomain),
      desired_domain: String(desiredDomain || '').trim(),
      preferred_extension: String(preferredExtension || '.vn').trim(),
      recommended_plan: String(recommendedPlan || '').trim(),
      ai_advice: String(aiAdvice || '').trim().slice(0, 2000),
      status: 'new',
      assigned_to: '',
      assigned_to_name: 'Chua phan cong',
      notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const created = await db.createLead(newLead);
    return res.json({ ok: true, lead: created });
  } catch (err) {
    console.error('POST /api/leads error:', err.message);
    return res.status(500).json({ ok: false, error: 'Loi he thong khi luu yeu cau tu van' });
  }
});

// GET /api/leads — Admin/Staff lay danh sach leads
app.get('/api/leads', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const leads = await db.getAllLeads();
    return res.json({ ok: true, leads });
  } catch (err) {
    console.error('GET /api/leads error:', err.message);
    return res.status(500).json({ ok: false, error: 'Loi lay danh sach tu van' });
  }
});

// PATCH /api/leads/:id — Admin/Staff cap nhat trang thai lead (Staff co RBAC nghiem ngat)
app.patch('/api/leads/:id', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedTo, assignedToName, notes, action } = req.body || {};

    let targetAssignedTo = assignedTo;
    let targetAssignedToName = assignedToName;

    // RBAC: Staff khong duoc phan cong cho nguoi khac, chi duoc tu nhan lead ve minh
    if (req.user.role === 'staff') {
      if (action === 'claim' || assignedTo === req.user.id) {
        targetAssignedTo = req.user.id;
        targetAssignedToName = req.user.fullName || req.user.username;
      } else {
        // Giu nguyen nguoi phu trach cu, khong cho phep Staff doi sang user khac
        targetAssignedTo = undefined;
        targetAssignedToName = undefined;
      }
    }

    const validStatuses = ['new', 'contacted', 'converted', 'lost'];
    const updated = await db.updateLead({
      id,
      status: validStatuses.includes(status) ? status : undefined,
      assignedTo: targetAssignedTo,
      assignedToName: targetAssignedToName,
      notes: notes !== undefined ? String(notes || '') : undefined
    });
    return res.json({ ok: true, lead: updated });
  } catch (err) {
    console.error('PATCH /api/leads/:id error:', err.message);
    return res.status(500).json({ ok: false, error: 'Loi cap nhat trang thai tu van' });
  }
});

// POST /api/leads/:id/convert-to-order — Chuyen lead thanh don hang thuc te trong OMS
app.post('/api/leads/:id/convert-to-order', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { id } = req.params;
    const allLeads = await db.getAllLeads();
    const lead = allLeads.find(l => l.id === id);
    if (!lead) {
      return res.status(404).json({ ok: false, error: 'Khong tim thay lead tu van' });
    }

    const catalog = await db.getCatalogData();
    const plans = catalog.plans || [];
    let matchedPlan = plans.find(p => (p.name || '').toLowerCase() === (lead.recommended_plan || '').toLowerCase())
                   || plans.find(p => p.id === lead.recommended_plan)
                   || plans[0];

    const orderId = 'ORD-2026-' + Math.floor(10000 + Math.random() * 90000);
    const invoiceId = 'INV-2026-' + Math.floor(1000 + Math.random() * 9000);
    const planMonthlyPrice = Number(matchedPlan.price_monthly || matchedPlan.priceMonthly || 199000);
    const totalAmount = planMonthlyPrice * 12;

    const bank = catalog.bankSettings || {};
    const bankId = bank.bankId || 'MB';
    const accountNo = bank.accountNo || '0988123456';
    const accountName = bank.accountName || 'CONG TY TNHH HOSTING ADVISOR';
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${totalAmount}&addInfo=${encodeURIComponent(orderId)}&accountName=${encodeURIComponent(accountName)}`;

    const newOrder = await db.createOrder({
      id: orderId,
      invoiceId,
      userId: null,
      customerName: lead.customer_name,
      phone: lead.phone,
      email: lead.email || '',
      planId: matchedPlan.id,
      planName: matchedPlan.name,
      billingCycleMonths: 12,
      domainName: lead.desired_domain ? (lead.desired_domain + (lead.preferred_extension || '.vn')) : '',
      domainYears: lead.desired_domain ? 1 : 0,
      addons: [],
      couponApplied: null,
      hostingAmount: totalAmount,
      domainAmount: 0,
      addonsAmount: 0,
      discountAmount: 0,
      totalAmount,
      paymentMethod: 'vietqr',
      paymentStatus: 'unpaid',
      status: 'pending_payment',
      qrUrl,
      serviceDetails: null,
      assignedTo: req.user.id,
      assignedToName: req.user.fullName || req.user.username,
      notes: `Chuyen doi tu Lead tu van [${lead.id}]. Nhu cau: ${lead.site_type || 'Kinh doanh'}`,
      timeline: [
        {
          time: new Date().toISOString(),
          action: `Chuyen doi tu Lead tu van boi ${req.user.fullName || req.user.username}`,
          by: req.user.fullName || req.user.username
        }
      ],
      createdAt: new Date().toISOString()
    });

    // Cap nhat trang thai lead sang converted
    await db.updateLead({
      id: lead.id,
      status: 'converted',
      assignedTo: req.user.id,
      assignedToName: req.user.fullName || req.user.username,
      notes: (lead.notes ? lead.notes + ' | ' : '') + `Da tao don hang ${orderId}`
    });

    return res.json({ ok: true, order: newOrder });
  } catch (err) {
    console.error('convert-to-order error:', err.message);
    return res.status(500).json({ ok: false, error: 'Loi chuyen doi thanh don hang' });
  }
});

// DELETE /api/leads/:id — Admin xoa lead
app.delete('/api/leads/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    await db.deleteLeadById(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/leads/:id error:', err.message);
    return res.status(500).json({ ok: false, error: 'Loi xoa yeu cau tu van' });
  }
});

// ============================================================================
// 3B. API ĐÁNH GIÁ THỰC TẾ CỦA KHÁCH HÀNG (REVIEWS CRUD TRÊN SUPABASE)
// ============================================================================

app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await db.getReviews();
    return res.json({ ok: true, reviews });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { customerName, businessName, planName, rating, comment } = req.body || {};
    const tokenUser = extractUserFromHeader(req);
    const dbUser = tokenUser ? await db.getUserById(tokenUser.id) : null;

    const finalName = String(customerName || dbUser?.fullName || '').trim();
    const finalComment = String(comment || '').trim();
    const finalPlan = String(planName || 'Gói Business').trim();
    const numRating = Math.min(5, Math.max(1, Number(rating) || 5));

    if (!finalName || !finalComment) {
      return res.status(400).json({
        ok: false,
        error: 'Vui lòng nhập đầy đủ Họ tên và Nội dung đánh giá thực tế.'
      });
    }

    const newReview = await db.createReview({
      id: `REV-${Date.now().toString().slice(-6)}`,
      customerName: finalName,
      businessName: String(businessName || '').trim(),
      planName: finalPlan,
      rating: numRating,
      comment: finalComment,
      createdAt: new Date().toISOString()
    });

    return res.status(201).json({ ok: true, review: newReview });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi gửi đánh giá: ' + err.message });
  }
});

app.delete('/api/admin/reviews/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const deleted = await db.deleteReviewById(req.params.id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'Không tìm thấy đánh giá cần xóa.' });
    }
    const reviews = await db.getReviews();
    return res.json({ ok: true, reviews });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================================
// 4. API XÁC THỰC NGƯỜI DÙNG & QUẢN TRỊ NHÂN SỰ
// ============================================================================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, fullName, phone, email } = req.body || {};

    if (!username || !password || !fullName || !phone) {
      return res.status(400).json({
        ok: false,
        error: 'Vui lòng điền đầy đủ Tên đăng nhập, Mật khẩu, Họ tên và Số điện thoại.'
      });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return res.status(400).json({ ok: false, error: 'Tên đăng nhập phải có ít nhất 3 ký tự.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ ok: false, error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    const existing = await db.getUserByUsername(cleanUsername);
    if (existing) {
      return res.status(409).json({
        ok: false,
        error: 'Tên đăng nhập này đã tồn tại. Vui lòng chọn tên đăng nhập khác.'
      });
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

    const payload = {
      id: newUser.id,
      username: newUser.username,
      fullName: newUser.fullName,
      phone: newUser.phone,
      email: newUser.email,
      role: newUser.role
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      ok: true,
      token,
      user: sanitizeUser(newUser)
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi đăng ký tài khoản: ' + err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập Tên đăng nhập và Mật khẩu.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const user = await db.getUserByUsername(cleanUsername);

    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ ok: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    }

    const payload = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      ok: true,
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi đăng nhập: ' + err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'Không tìm thấy tài khoản người dùng.' });
    }
    return res.json({ ok: true, user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/users/staff', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const allUsers = await db.getAllUsers();
    const staffList = allUsers
      .filter((u) => u.role === 'admin' || u.role === 'staff')
      .map(sanitizeUser);
    return res.json({ ok: true, staff: staffList });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Admin tạo tài khoản Nhân sự (Staff / Admin)
app.post('/api/admin/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { username, password, fullName, phone, email, role } = req.body || {};
    if (!username || !password || !fullName) {
      return res.status(400).json({
        ok: false,
        error: 'Vui lòng nhập đầy đủ Tên đăng nhập, Mật khẩu và Họ tên nhân sự.'
      });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const existing = await db.getUserByUsername(cleanUsername);
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Tên đăng nhập này đã tồn tại trên hệ thống.' });
    }

    const targetRole = role === 'admin' ? 'admin' : 'staff';
    const newStaff = await db.createUser({
      id: `USR-${Date.now().toString().slice(-6)}`,
      username: cleanUsername,
      password: hashPassword(String(password)),
      fullName: String(fullName).trim(),
      phone: String(phone || '').trim(),
      email: String(email || '').trim(),
      role: targetRole,
      createdAt: new Date().toISOString()
    });

    return res.status(201).json({ ok: true, user: sanitizeUser(newStaff) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Admin xóa tài khoản nhân sự
app.delete('/api/admin/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) {
      return res.status(400).json({ ok: false, error: 'Không thể tự xóa tài khoản Admin đang đăng nhập.' });
    }
    const removed = await db.deleteUserById(targetId);
    if (!removed) {
      return res.status(404).json({ ok: false, error: 'Không tìm thấy tài khoản cần xóa.' });
    }
    return res.json({ ok: true, deletedUser: sanitizeUser(removed) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================================
// 5. API MÃ GIẢM GIÁ (COUPONS) & CẤU HÌNH NGÂN HÀNG VIETQR (ADMIN)
// ============================================================================

app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, subTotal, rawTotal } = req.body || {};
    if (!code || !String(code).trim()) {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập mã giảm giá.' });
    }

    const coupons = await db.getCoupons();
    const cleanCode = String(code).trim().toUpperCase();
    const coupon = coupons.find((c) => String(c.code).toUpperCase() === cleanCode);

    if (!coupon) {
      return res.status(404).json({ ok: false, error: `Mã giảm giá "${cleanCode}" không tồn tại hoặc đã hết hạn.` });
    }

    const baseAmount = Math.max(0, Number(subTotal ?? rawTotal) || 0);
    let discountAmount = 0;
    if (coupon.type === 'percent') {
      discountAmount = Math.round((baseAmount * Number(coupon.value)) / 100);
    } else if (coupon.type === 'fixed') {
      discountAmount = Math.min(baseAmount, Number(coupon.value));
    }

    return res.json({
      ok: true,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      description: coupon.description,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        description: coupon.description
      },
      discountAmount,
      finalAmount: Math.max(0, baseAmount - discountAmount)
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/coupons', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const coupons = await db.getCoupons();
    return res.json({ ok: true, coupons });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/coupons', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { code, type, value, description } = req.body || {};
    if (!code || !type || !value) {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập Mã coupon, Loại giảm và Giá trị giảm.' });
    }
    const cleanCode = String(code).trim().toUpperCase();
    const numVal = Number(value);
    if (!Number.isFinite(numVal) || numVal <= 0) {
      return res.status(400).json({ ok: false, error: 'Giá trị giảm phải lớn hơn 0.' });
    }

    const newCoupon = await db.upsertCoupon({
      code: cleanCode,
      type: type === 'fixed' ? 'fixed' : 'percent',
      value: numVal,
      description: String(description || (type === 'fixed' ? `Giảm ${numVal.toLocaleString('vi-VN')}đ` : `Giảm ${numVal}%`)).trim()
    });
    const coupons = await db.getCoupons();
    return res.status(201).json({ ok: true, coupon: newCoupon, coupons });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/admin/coupons/:code', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const deleted = await db.deleteCouponByCode(req.params.code);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'Không tìm thấy mã giảm giá.' });
    }
    const coupons = await db.getCoupons();
    return res.json({ ok: true, coupons });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.put('/api/admin/settings', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { bankId, accountNo, accountName } = req.body || {};
    if (!bankId || !accountNo || !accountName) {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập đầy đủ Mã ngân hàng, Số tài khoản và Tên chủ tài khoản.' });
    }
    const updatedSettings = await db.updateBankSettings({
      bankId: String(bankId).trim().toUpperCase(),
      accountNo: String(accountNo).trim(),
      accountName: String(accountName).trim().toUpperCase()
    });
    return res.json({ ok: true, settings: updatedSettings });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================================
// 6. API THƯƠNG MẠI ĐIỆN TỬ & QUẢN TRỊ ĐƠN HÀNG (ORDERS CRUD + VIETQR)
// ============================================================================

function computeCycleDiscountRate(months) {
  const m = Number(months) || 12;
  if (m === 36) return 0.20;
  if (m === 24) return 0.10;
  return 0;
}

function findDomainPrice(domainPricingList, domainName) {
  if (!domainName || !String(domainName).trim()) return 0;
  const clean = String(domainName).trim().toLowerCase();
  const sorted = [...domainPricingList].sort(
    (a, b) => String(b.extension || b.tld || '').length - String(a.extension || a.tld || '').length
  );
  for (const item of sorted) {
    const ext = String(item.extension || item.tld || '').toLowerCase();
    if (ext && clean.endsWith(ext)) {
      return Number(item.price ?? item.regPrice) || 0;
    }
  }
  return 280000;
}

/**
 * POST /api/orders
 * Hỗ trợ cả khách hàng đã đăng nhập VÀ khách mua trực tiếp (điền Họ tên, SĐT, Email ngay tại Checkout)
 */
app.post('/api/orders', async (req, res) => {
  try {
    const {
      planId,
      planChosen,
      billingCycleMonths = 12,
      domainName = '',
      desiredDomain = '',
      domainExtension = '.vn',
      addonIds = [],
      selectedAddons: bodySelectedAddons = [],
      addons = [],
      couponCode = '',
      customerName = '',
      phone = '',
      email = '',
      notes = ''
    } = req.body || {};

    const catalog = await db.getCatalogData();
    const tokenUser = extractUserFromHeader(req);
    const dbUser = tokenUser ? await db.getUserById(tokenUser.id) : null;

    const finalCustomerName = String(customerName || dbUser?.fullName || '').trim();
    const finalPhone = String(phone || dbUser?.phone || '').trim();
    const finalEmail = String(email || dbUser?.email || '').trim();

    if (!finalCustomerName || !finalPhone) {
      return res.status(400).json({
        ok: false,
        error: 'Vui lòng nhập đầy đủ Họ tên và Số điện thoại người mua để khởi tạo đơn hàng & hóa đơn.'
      });
    }

    const targetPlanId = String(planId || planChosen || 'business').trim();
    const plan = catalog.plans.find((p) => p.id === targetPlanId) || catalog.plans[0];
    if (!plan) {
      return res.status(400).json({ ok: false, error: 'Gói cước dịch vụ không hợp lệ.' });
    }

    const cycleMonths = [12, 24, 36].includes(Number(billingCycleMonths)) ? Number(billingCycleMonths) : 12;
    const cycleDiscountRate = computeCycleDiscountRate(cycleMonths);
    const monthlyPrice = Number(plan.pricePerMonth ?? plan.priceMonthly ?? 0);
    const rawHosting = monthlyPrice * cycleMonths;
    const hostingAmount = Math.round(rawHosting * (1 - cycleDiscountRate));

    const cleanDesired = String(desiredDomain || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const resolvedDomain = String(
      domainName || (cleanDesired ? `${cleanDesired}${domainExtension || '.vn'}` : '')
    )
      .trim()
      .toLowerCase();

    const domainAmount =
      resolvedDomain && !plan.freeDomain ? findDomainPrice(catalog.domain_pricing, resolvedDomain) : 0;

    const requestedAddonIds =
      Array.isArray(addonIds) && addonIds.length > 0
        ? addonIds
        : Array.isArray(bodySelectedAddons) && bodySelectedAddons.length > 0
        ? bodySelectedAddons
        : Array.isArray(addons)
        ? addons
        : [];

    const selectedAddons = [];
    let addonsAmount = 0;
    for (const item of requestedAddonIds) {
      const aid = typeof item === 'string' ? item : item?.id;
      const foundAddon = catalog.addons.find((a) => a.id === aid);
      if (foundAddon) {
        const computedPrice =
          foundAddon.billingType === 'monthly'
            ? Number(foundAddon.price) * cycleMonths
            : Number(foundAddon.price);
        selectedAddons.push({
          id: foundAddon.id,
          name: foundAddon.name,
          price: computedPrice
        });
        addonsAmount += computedPrice;
      }
    }

    const subTotal = hostingAmount + domainAmount + addonsAmount;

    let discountAmount = 0;
    let appliedCouponCode = null;
    if (couponCode && String(couponCode).trim()) {
      const cleanCode = String(couponCode).trim().toUpperCase();
      const foundCoupon = catalog.coupons.find((c) => String(c.code).toUpperCase() === cleanCode);
      if (foundCoupon) {
        appliedCouponCode = foundCoupon.code;
        if (foundCoupon.type === 'percent') {
          discountAmount = Math.round((subTotal * Number(foundCoupon.value)) / 100);
        } else if (foundCoupon.type === 'fixed') {
          discountAmount = Math.min(subTotal, Number(foundCoupon.value));
        }
      }
    }

    const totalAmount = Math.max(0, subTotal - discountAmount);

    const uniqueSuffix = Date.now().toString().slice(-5);
    const orderId = `ORD-2026-${uniqueSuffix}`;
    const invoiceId = `INV-2026-${uniqueSuffix}`;
    const nowIso = new Date().toISOString();

    const bankId = catalog.settings?.bankId || process.env.VIETQR_BANK_ID || 'MB';
    const accountNo = catalog.settings?.accountNo || process.env.VIETQR_ACCOUNT_NO || '0988123456';
    const accountName = catalog.settings?.accountName || process.env.VIETQR_ACCOUNT_NAME || 'CONG TY TNHH HOSTING ADVISOR';
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${totalAmount}&addInfo=${encodeURIComponent(orderId)}&accountName=${encodeURIComponent(accountName)}`;

    const newOrder = await db.createOrder({
      id: orderId,
      invoiceId,
      userId: dbUser ? dbUser.id : null,
      customerName: finalCustomerName,
      phone: finalPhone,
      email: finalEmail,
      planId: plan.id,
      planName: plan.name,
      billingCycleMonths: cycleMonths,
      domainName: resolvedDomain,
      domainYears: resolvedDomain ? 1 : 0,
      addons: selectedAddons,
      couponApplied: appliedCouponCode,
      hostingAmount,
      domainAmount,
      addonsAmount,
      discountAmount,
      totalAmount,
      paymentMethod: 'vietqr',
      paymentStatus: 'unpaid',
      status: 'paid_processing',
      qrUrl,
      serviceDetails: null,
      assignedTo: null,
      assignedToName: 'Chưa phân công',
      notes: String(notes || '').trim(),
      timeline: [
        {
          time: nowIso,
          action: `Đã tiếp nhận đơn đặt hàng thành công (Tổng thanh toán: ${totalAmount.toLocaleString('vi-VN')}đ)`,
          by: finalCustomerName
        }
      ],
      createdAt: nowIso
    });

    return res.status(201).json({ ok: true, order: newOrder });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Lỗi tạo đơn hàng: ' + err.message });
  }
});

/**
 * POST /api/orders/:id/confirm-payment
 * Cho phép bấm 1 nút để xác nhận thanh toán & kích hoạt đơn hàng ngay lập tức (không cần chuyển khoản thật)
 */
app.post('/api/orders/:id/confirm-payment', async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await db.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Không tìm thấy đơn hàng.' });
    }

    const nowIso = new Date().toISOString();
    order.status = 'completed';
    order.paymentStatus = 'paid';
    if (!order.serviceDetails) {
      const randomOctet = Math.floor(Math.random() * 200) + 20;
      order.serviceDetails = {
        hostingIp: `103.221.220.${randomOctet}`,
        nameServers: ['ns1.hostingadvisor.vn', 'ns2.hostingadvisor.vn'],
        controlPanelUrl: 'https://cp.hostingadvisor.vn:2083',
        activatedAt: nowIso
      };
    }
    order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
    order.timeline.push({
      time: nowIso,
      action: `Đã xác nhận hoàn tất đơn hàng & cấp phát IP Hosting (${order.serviceDetails.hostingIp})`,
      by: order.customerName
    });
    const updated = await db.updateOrder(order);

    return res.json({ ok: true, order: updated });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/orders/my-orders
 * Hỗ trợ tra cứu theo Token đăng nhập HOẶC theo Số điện thoại (?phone=09...)
 */
app.get('/api/orders/my-orders', async (req, res) => {
  try {
    const allOrders = await db.getAllOrders();
    const tokenUser = extractUserFromHeader(req);
    const queryPhone = String(req.query.phone || '').trim();

    let myOrders = [];
    if (tokenUser) {
      myOrders = allOrders.filter(
        (o) => o.userId === tokenUser.id || (tokenUser.phone && o.phone === tokenUser.phone)
      );
    }
    if (queryPhone) {
      const byPhone = allOrders.filter((o) => String(o.phone).trim() === queryPhone);
      const map = new Map();
      [...myOrders, ...byPhone].forEach((o) => map.set(o.id, o));
      myOrders = Array.from(map.values());
    }

    return res.json({ ok: true, orders: myOrders });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/orders
 * Admin & Staff lấy toàn bộ danh sách đơn hàng OMS
 */
app.get('/api/orders', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const orders = await db.getAllOrders();
    return res.json({ ok: true, orders });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * PATCH /api/orders/:id
 * Admin & Staff duyệt thanh toán VietQR, cấp phát IP Hosting/DNS, phân công & ghi chú
 */
app.patch('/api/orders/:id', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, assignedTo, notes } = req.body || {};

    const order = await db.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Không tìm thấy đơn hàng cần cập nhật.' });
    }

    const nowIso = new Date().toISOString();
    order.timeline = Array.isArray(order.timeline) ? order.timeline : [];

    if (assignedTo !== undefined && assignedTo !== order.assignedTo) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          ok: false,
          error: 'Chỉ Quản trị viên (Admin) mới có quyền phân công nhân sự phụ trách đơn hàng.'
        });
      }
      if (!assignedTo) {
        order.assignedTo = null;
        order.assignedToName = 'Chưa phân công';
        order.timeline.push({
          time: nowIso,
          action: 'Bỏ phân công nhân sự phụ trách',
          by: req.user.fullName
        });
      } else {
        const staffUser = await db.getUserById(assignedTo);
        if (!staffUser) {
          return res.status(400).json({ ok: false, error: 'Nhân sự được chọn không tồn tại.' });
        }
        order.assignedTo = staffUser.id;
        order.assignedToName = staffUser.fullName;
        order.timeline.push({
          time: nowIso,
          action: `Phân công đơn hàng cho: ${staffUser.fullName}`,
          by: req.user.fullName
        });
      }
    }

    if (status && status !== order.status) {
      const oldStatus = order.status;
      order.status = status;

      if (status === 'completed') {
        order.paymentStatus = 'paid';
        if (!order.serviceDetails) {
          const randomOctet = Math.floor(Math.random() * 200) + 20;
          order.serviceDetails = {
            hostingIp: `103.221.220.${randomOctet}`,
            nameServers: ['ns1.hostingadvisor.vn', 'ns2.hostingadvisor.vn'],
            controlPanelUrl: `https://cp.hostingadvisor.vn:2083`,
            activatedAt: nowIso
          };
        }
        order.timeline.push({
          time: nowIso,
          action: `Đã xác nhận nhận đủ tiền VietQR & Kích hoạt dịch vụ (IP: ${order.serviceDetails.hostingIp})`,
          by: req.user.fullName
        });
      } else {
        if (status === 'pending_payment' || status === 'cancelled') {
          order.paymentStatus = 'unpaid';
        }
        order.timeline.push({
          time: nowIso,
          action: `Cập nhật trạng thái đơn: ${oldStatus} -> ${status}`,
          by: req.user.fullName
        });
      }
    }

    if (notes !== undefined && String(notes).trim() !== order.notes) {
      order.notes = String(notes).trim();
      order.timeline.push({
        time: nowIso,
        action: `Cập nhật ghi chú xử lý: "${order.notes || 'Đã xóa ghi chú'}"`,
        by: req.user.fullName
      });
    }

    const updated = await db.updateOrder(order);
    return res.json({ ok: true, order: updated });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * DELETE /api/orders/:id
 * Chỉ Admin mới có quyền xóa vĩnh viễn đơn hàng
 */
app.delete('/api/orders/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const removed = await db.deleteOrderById(req.params.id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: 'Không tìm thấy đơn hàng cần xóa.' });
    }
    return res.json({ ok: true, deletedOrder: removed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================================
// 7. DUAL GEMINI AI PROXY: TƯ VẤN KHÁCH HÀNG & KỊCH BẢN TELESALE ADMIN
// ============================================================================

async function callGeminiText(promptText) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'paste_your_gemini_api_key_here') {
    return null;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
        thinkingConfig: {
          thinkingBudget: 0
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini HTTP ${response.status}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

app.post('/api/advice', async (req, res) => {
  const {
    websiteTypeLabel,
    trafficLabel,
    budgetLabel,
    recommendedPlanName,
    recommendedPlanPrice,
    domainQuery
  } = req.body || {};

  const prompt = `Bạn là Chuyên gia Kiến trúc Hạ tầng Web & Tên miền tại HostingAdvisor Việt Nam.
Khách hàng đang cần tư vấn:
- Loại website: ${websiteTypeLabel || 'Website doanh nghiệp / Bán hàng'}
- Lưu lượng truy cập: ${trafficLabel || 'Vừa phải'}
- Ngân sách: ${budgetLabel || 'Tối ưu chi phí'}
- Gói hệ thống đề xuất: Gói ${recommendedPlanName || 'Pro'} (${recommendedPlanPrice || '199.000đ/tháng'})
${domainQuery ? `- Tên miền khách đang quan tâm: ${domainQuery}` : ''}

Hãy viết đúng 3 đến 4 câu ngắn gọn bằng tiếng Việt chuyên nghiệp, dễ hiểu (tuyệt đối không dùng biểu tượng cảm xúc/emoji):
1. Giải thích vì sao cấu hình gói ${recommendedPlanName || 'Pro'} đáp ứng mượt mà nhu cầu trên.
2. Tư vấn khách nên chọn chu kỳ thanh toán 24 hoặc 36 tháng để tiết kiệm 10%-20% chi phí và kèm dịch vụ Daily Backup hoặc Bảo mật tên miền Whois.
3. Khuyên khách chọn đuôi tên miền .vn hoặc .com để tăng độ uy tín thương hiệu.`;

  try {
    const aiText = await callGeminiText(prompt);
    if (aiText) {
      return res.json({ ok: true, source: 'gemini', advice: aiText });
    }
  } catch (err) {
    console.error('Gemini /api/advice error:', err.message);
  }

  const fallbackAdvice = `Với mô hình ${websiteTypeLabel || 'website của bạn'} và mức lưu lượng ${trafficLabel || 'hiện tại'}, gói ${recommendedPlanName || 'Pro'} (${recommendedPlanPrice || '199.000đ/tháng'}) cung cấp tài nguyên ổ cứng NVMe tốc độ cao và RAM độc lập giúp trang tải nhanh dưới 1 giây. Bạn nên ưu tiên đăng ký chu kỳ 24 hoặc 36 tháng để được giảm ngay 10% đến 20% chi phí, đồng thời tích chọn thêm Sao lưu tự động hàng ngày (Daily Backup) để bảo vệ dữ liệu tuyệt đối. Về thương hiệu, việc sở hữu song song đuôi tên miền .vn và .com sẽ giúp doanh nghiệp bảo vệ bản quyền tên tuổi và tối ưu SEO bền vững tại thị trường Việt Nam.`;

  return res.json({ ok: true, source: 'fallback', advice: fallbackAdvice });
});

app.post('/api/advice/sales-script', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { orderId, leadId } = req.body || {};

    // 1. Truong hop tao kich ban cho Lead Tu Van
    if (leadId) {
      const allLeads = await db.getAllLeads();
      const lead = allLeads.find((l) => l.id === leadId);
      if (!lead) {
        return res.status(404).json({ ok: false, error: 'Khong tim thay lead tu van.' });
      }

      const prompt = `Ban la Truong phong Tu van Ha tang Hosting & Ten mien tai HostingAdvisor Viet Nam.
Hay soan kich ban goi dien Telesale ngan gon 3 buoc cho nhan vien tu van de cham soc va chot don cho khach hang:
- Ten khach hang: ${lead.customer_name} (SDT: ${lead.phone})
- Loai website: ${lead.site_type || 'Website kinh doanh'}
- Luu luong du kien: ${lead.traffic || 'Chua xac dinh'}
- Ngan sach khach hang: ${lead.budget ? Number(lead.budget).toLocaleString('vi-VN') + 'd/thang' : 'Toi uu'}
- Goi he thong de xuat: Goi ${lead.recommended_plan || 'Pro Business'}
- Ten mien khach quan tam: ${lead.desired_domain ? lead.desired_domain + (lead.preferred_extension || '.vn') : 'Chua dang ky'}

Yeu cau trinh bay dung 3 buoc ro rang, lich su, chuyen nghiep bang tieng Viet (tuyet doi KHONG dung icon hay emoji):
Buoc 1 (Chao hoi & Nhan dien nhu cau): ...
Buoc 2 (Giai thich loi ich ky thuat cua goi va uu dai kem theo): ...
Buoc 3 (Kich hoat dat hang & Huong dan thanh toan VietQR de giu uu dai): ...`;

      try {
        const aiScript = await callGeminiText(prompt);
        if (aiScript) {
          return res.json({ ok: true, source: 'gemini', script: aiScript });
        }
      } catch (err) {
        console.error('Gemini lead sales-script error:', err.message);
      }

      const fallbackScript = `Buoc 1 (Chao hoi & Nhan dien nhu cau): Xin chao anh/chi ${lead.customer_name}, em la nhan vien tu van ky thuat tu HostingAdvisor Viet Nam. Em thay anh/chi vua quan tam den giai phap ha tang cho ${lead.site_type || 'website'} va dang can nhan tu van goi ${lead.recommended_plan || 'Pro Business'}. Em goi dien de ho tro truc tiep cho anh/chi a.
Buoc 2 (Giai thich gia tri ky thuat): Voi quy mo truy cap va muc tieu cua anh/chi, goi ${lead.recommended_plan || 'Pro Business'} su dung o cung NVMe toc do cao va RAM doc lap giup website tai rat nhanh va khong bao gio bi nghen. Neu anh/chi dang ky chu ky 24 hoac 36 thang, he thong se chiet khau them 10% den 20% chi phi va mien phi luon ten mien ${lead.desired_domain ? lead.desired_domain + (lead.preferred_extension || '.vn') : '.vn/.com'} trong nam dau.
Buoc 3 (Ho tro tao don & Kich hoat ngay): Em xin phep tao luon don hang giu uu dai giup anh/chi ngay bay gio. Sau khi tao xong, anh/chi chi can mo hoa don quet ma VietQR tren dien thoai la he thong tu dong cap phat IP Hosting trong vong 3 phut a.`;

      return res.json({ ok: true, source: 'fallback', script: fallbackScript });
    }

    // 2. Truong hop tao kich ban cho Don Hang (Order)
    const order = await db.getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ ok: false, error: 'Không tìm thấy đơn hàng để tạo kịch bản.' });
    }

    const addonsText =
      Array.isArray(order.addons) && order.addons.length > 0
        ? order.addons.map((a) => a.name).join(', ')
        : 'Chưa chọn Add-on';

    const prompt = `Bạn là Giám đốc Kinh doanh Hạ tầng Hosting/Domain. Hãy soạn kịch bản gọi điện Telesale ngắn gọn 3 bước cho nhân viên chăm sóc khách hàng:
- Tên khách hàng: ${order.customerName} (SĐT: ${order.phone})
- Mã đơn: ${order.id} | Trạng thái: ${order.status} (${order.paymentStatus})
- Dịch vụ đăng ký: Gói ${order.planName} (${order.billingCycleMonths} tháng) + Tên miền: ${order.domainName || 'Chưa kèm tên miền'}
- Dịch vụ cộng thêm (Add-ons): ${addonsText}
- Tổng thanh toán: ${Number(order.totalAmount).toLocaleString('vi-VN')}đ

Yêu cầu trình bày đúng 3 bước rõ ràng, lịch sự, chuyên nghiệp bằng tiếng Việt, tuyệt đối KHÔNG dùng icon hay emoji:
Bước 1 (Chào hỏi & Xác nhận đơn hàng): ...
Bước 2 (Tư vấn giá trị kỹ thuật & Hướng dẫn thanh toán VietQR / bàn giao IP): ...
Bước 3 (Đề xuất Up-sell gia hạn dài hạn hoặc mua thêm Backup/Whois/Tên miền bảo vệ thương hiệu): ...`;

    try {
      const aiScript = await callGeminiText(prompt);
      if (aiScript) {
        return res.json({ ok: true, source: 'gemini', script: aiScript });
      }
    } catch (err) {
      console.error('Gemini /api/advice/sales-script error:', err.message);
    }

    const fallbackScript = `Bước 1 (Chào hỏi & Xác nhận đơn hàng): Xin chào anh/chị ${order.customerName}, em liên hệ từ bộ phận Hỗ trợ Kỹ thuật HostingAdvisor Việt Nam để xác nhận đơn hàng ${order.id} gồm Gói ${order.planName} (${order.billingCycleMonths} tháng)${order.domainName ? ` kèm tên miền ${order.domainName}` : ''} với tổng chi phí ưu đãi là ${Number(order.totalAmount).toLocaleString('vi-VN')}đ.
Bước 2 (Tư vấn kỹ thuật & Hỗ trợ kích hoạt): Hệ thống máy chủ NVMe và cấu hình DNS cho đơn hàng của anh/chị đã sẵn sàng. ${order.paymentStatus === 'paid' ? 'Bên em đã kích hoạt hoàn tất IP máy chủ và gửi thông tin quản trị qua email của anh/chị.' : 'Anh/chị có thể quét mã VietQR ngay trên hóa đơn điện tử để hệ thống tự động cấp phát IP Hosting và kích hoạt SSL trong vòng 3 phút.'}
Bước 3 (Gia tăng giá trị & Up-sell): Để bảo vệ an toàn dữ liệu tuyệt đối và tối ưu chi phí vận hành, bên em đang hỗ trợ ưu đãi nâng cấp gói Sao lưu tự động hàng ngày (Daily Pro Backup) và đăng ký bao vây thêm đuôi tên miền .com/.vn nhằm bảo vệ thương hiệu độc quyền cho doanh nghiệp của anh/chị.`;

    return res.json({ ok: true, source: 'fallback', script: fallbackScript });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server thương mại điện tử chạy tại: http://localhost:${PORT}`);
  console.log(`- Portal Khách: http://localhost:${PORT}/index.html`);
  console.log(`- Portal Admin: http://localhost:${PORT}/admin.html`);
});
