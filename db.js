/**
 * db.js
 * Tầng Truy Xuất Cơ Sở Dữ Liệu (Database Access Layer)
 * - Ưu tiên kết nối Cloud SQL: Supabase PostgreSQL (@supabase/supabase-js)
 * - Tự động đồng bộ dữ liệu khởi tạo (Auto-Seed) khi bảng trên Supabase mới tạo
 * - Tự động Fallback về db.json cục bộ nếu chưa điền SUPABASE_URL / SUPABASE_KEY trong .env
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DB_FILE = path.join(__dirname, 'db.json');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
).trim();

let supabase = null;
let isSupabaseActive = false;
let supabaseStatusMessage = 'Chưa cấu hình SUPABASE_URL và SUPABASE_KEY trong file .env (Đang chạy chế độ Local db.json)';

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
  } catch (err) {
    console.error('[DB] Lỗi khởi tạo Supabase Client:', err.message);
  }
}

// ============================================================================
// HÀM ĐỌC / GHI LOCAL JSON FALLBACK
// ============================================================================

function readLocalDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      settings: parsed.settings || {
        bankId: 'MB',
        accountNo: '0988123456',
        accountName: 'CONG TY TNHH HOSTING ADVISOR'
      },
      users: Array.isArray(parsed.users) ? parsed.users : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      coupons: Array.isArray(parsed.coupons) ? parsed.coupons : [],
      addons: Array.isArray(parsed.addons) ? parsed.addons : [],
      domain_pricing: Array.isArray(parsed.domain_pricing) ? parsed.domain_pricing : [],
      plans: Array.isArray(parsed.plans) ? parsed.plans : [],
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : []
    };
  } catch (err) {
    return {
      settings: {
        bankId: 'MB',
        accountNo: '0988123456',
        accountName: 'CONG TY TNHH HOSTING ADVISOR'
      },
      users: [],
      orders: [],
      coupons: [],
      addons: [],
      domain_pricing: [],
      plans: [],
      reviews: []
    };
  }
}

function writeLocalDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ============================================================================
// HÀM CHUYỂN ĐỔI DỮ LIỆU GIỮA POSTGRESQL (SNAKE_CASE) & APP (CAMELCASE)
// ============================================================================

function mapUserFromPg(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    password: row.password_hash,
    fullName: row.full_name,
    phone: row.phone || '',
    email: row.email || '',
    role: row.role || 'customer',
    createdAt: row.created_at
  };
}

function mapUserToPg(u) {
  return {
    id: u.id,
    username: u.username,
    password_hash: u.password,
    full_name: u.fullName,
    phone: u.phone || '',
    email: u.email || '',
    role: u.role || 'customer',
    created_at: u.createdAt || new Date().toISOString()
  };
}

function mapPlanFromPg(row) {
  const priceVal = Number(row.price_monthly) || 39000;
  const visitsVal = Number(row.cpu) || 10000;
  const featuresArr =
    Array.isArray(row.target_audience) && row.target_audience.length > 0
      ? row.target_audience
      : ['SSL miễn phí', 'Hỗ trợ kỹ thuật 24/7'];
  return {
    id: row.id,
    name: row.name,
    type: row.category || 'Shared Hosting',
    category: row.category || 'Shared Hosting',
    pricePerMonth: priceVal,
    priceMonthly: priceVal,
    storage: row.storage || '20 GB SSD',
    bandwidth: row.bandwidth || 'Không giới hạn',
    recommendedVisits: visitsVal,
    freeDomain: Boolean(row.ssl_free),
    features: featuresArr,
    bestFor: row.best_for || ''
  };
}

function mapPlanToPg(p) {
  const priceVal = Number(p.pricePerMonth ?? p.priceMonthly ?? 39000);
  const visitsVal = Number(p.recommendedVisits ?? 10000);
  const featuresArr = Array.isArray(p.features)
    ? p.features
    : Array.isArray(p.targetAudience)
    ? p.targetAudience
    : [];
  return {
    id: p.id,
    name: p.name,
    category: p.type || p.category || 'Shared Hosting',
    price_monthly: priceVal,
    cpu: String(visitsVal),
    ram: p.ram || '2 GB',
    storage: p.storage || '20 GB SSD',
    bandwidth: p.bandwidth || 'Không giới hạn',
    domains: p.domains || '1 website',
    ssl_free: Boolean(p.freeDomain ?? p.sslFree),
    backup: p.backup || 'Hàng tuần',
    support: p.support || '24/7',
    highlight: Boolean(p.highlight),
    best_for: p.bestFor || '',
    specs_summary: p.specsSummary || '',
    target_audience: featuresArr
  };
}

function mapDomainFromPg(row) {
  const priceVal = Number(row.reg_price) || 280000;
  return {
    extension: row.tld,
    tld: row.tld,
    price: priceVal,
    regPrice: priceVal,
    renewPrice: Number(row.renew_price) || priceVal,
    description: row.badge || '',
    badge: row.badge || ''
  };
}

function mapDomainToPg(d) {
  const priceVal = Number(d.price ?? d.regPrice ?? 280000);
  return {
    tld: d.extension || d.tld,
    reg_price: priceVal,
    renew_price: Number(d.renewPrice ?? priceVal),
    badge: d.description || d.badge || ''
  };
}

function mapAddonFromPg(row) {
  const rawBilling = String(row.billing || 'yearly|50.000đ / năm');
  const parts = rawBilling.split('|');
  const billingType = parts[0] === 'monthly' || parts[0] === 'yearly' ? parts[0] : 'yearly';
  const unitLabel = parts[1] || rawBilling;
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price) || 0,
    billingType,
    unitLabel,
    description: row.description || ''
  };
}

function mapAddonToPg(a) {
  const bType = a.billingType || 'yearly';
  const uLabel = a.unitLabel || a.billing || `${Number(a.price).toLocaleString('vi-VN')}đ`;
  return {
    id: a.id,
    name: a.name,
    price: Number(a.price) || 0,
    billing: `${bType}|${uLabel}`,
    description: a.description || ''
  };
}

function mapOrderFromPg(row) {
  if (!row) return null;
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    userId: row.user_id || null,
    customerName: row.customer_name,
    phone: row.phone,
    email: row.email || '',
    planId: row.plan_id,
    planName: row.plan_name,
    billingCycleMonths: Number(row.billing_cycle_months) || 12,
    domainName: row.domain_name || '',
    domainYears: Number(row.domain_years) || 0,
    addons: Array.isArray(row.addons) ? row.addons : [],
    couponApplied: row.coupon_applied || null,
    hostingAmount: Number(row.hosting_amount) || 0,
    domainAmount: Number(row.domain_amount) || 0,
    addonsAmount: Number(row.addons_amount) || 0,
    discountAmount: Number(row.discount_amount) || 0,
    totalAmount: Number(row.total_amount) || 0,
    paymentMethod: row.payment_method || 'vietqr',
    paymentStatus: row.payment_status || 'unpaid',
    status: row.status || 'pending_payment',
    qrUrl: row.qr_url || '',
    serviceDetails: row.service_details || null,
    assignedTo: row.assigned_to || null,
    assignedToName: row.assigned_to_name || 'Chưa phân công',
    notes: row.notes || '',
    timeline: Array.isArray(row.timeline) ? row.timeline : [],
    createdAt: row.created_at
  };
}

function mapOrderToPg(o) {
  return {
    id: o.id,
    invoice_id: o.invoiceId,
    user_id: o.userId || null,
    customer_name: o.customerName,
    phone: o.phone,
    email: o.email || '',
    plan_id: o.planId,
    plan_name: o.planName,
    billing_cycle_months: Number(o.billingCycleMonths) || 12,
    domain_name: o.domainName || '',
    domain_years: Number(o.domainYears) || 0,
    addons: Array.isArray(o.addons) ? o.addons : [],
    coupon_applied: o.couponApplied || null,
    hosting_amount: Number(o.hostingAmount) || 0,
    domain_amount: Number(o.domainAmount) || 0,
    addons_amount: Number(o.addonsAmount) || 0,
    discount_amount: Number(o.discountAmount) || 0,
    total_amount: Number(o.totalAmount) || 0,
    payment_method: o.paymentMethod || 'vietqr',
    payment_status: o.paymentStatus || 'unpaid',
    status: o.status || 'pending_payment',
    qr_url: o.qrUrl || '',
    service_details: o.serviceDetails || null,
    assigned_to: o.assignedTo || null,
    assigned_to_name: o.assignedToName || 'Chưa phân công',
    notes: o.notes || '',
    timeline: Array.isArray(o.timeline) ? o.timeline : [],
    created_at: o.createdAt || new Date().toISOString()
  };
}

// ============================================================================
// KHỞI TẠO & ĐỒNG BỘ DỮ LIỆU TỰ ĐỘNG LÊN SUPABASE POSTGRESQL
// ============================================================================

let storedHashPasswordFn = (p) => p;

async function initDatabase(hashPasswordFn) {
  if (hashPasswordFn) storedHashPasswordFn = hashPasswordFn;
  const local = readLocalDb();

  // Đảm bảo mật khẩu trong db.json được băm SHA-256
  let localChanged = false;
  for (const u of local.users) {
    if (u.password && !String(u.password).startsWith('sha256$')) {
      u.password = storedHashPasswordFn(u.password);
      localChanged = true;
    }
  }
  if (localChanged) {
    writeLocalDb(local);
  }

  if (!supabase) {
    console.log('[DB] ' + supabaseStatusMessage);
    return;
  }

  try {
    // Kiểm tra xem bảng settings đã được tạo trên Supabase chưa
    const { data: settingsRows, error: testErr } = await supabase
      .from('settings')
      .select('*')
      .limit(1);

    if (testErr) {
      isSupabaseActive = false;
      supabaseStatusMessage = `Đã có SUPABASE_URL nhưng chưa chạy file supabase_schema.sql trên Supabase (${testErr.message}). Đang tạm dùng db.json cục bộ.`;
      console.warn('[DB] ' + supabaseStatusMessage);
      return;
    }

    isSupabaseActive = true;
    supabaseStatusMessage = 'Đã kết nối trực tiếp tới Cloud SQL: Supabase PostgreSQL';
    console.log('[DB] ' + supabaseStatusMessage);

    // Tự động Seed dữ liệu gốc từ db.json lên Supabase nếu bảng trên Supabase đang trống
    if (!settingsRows || settingsRows.length === 0) {
      const { error: upsertErr } = await supabase.from('settings').upsert({
        id: 1,
        bank_id: local.settings.bankId,
        account_no: local.settings.accountNo,
        account_name: local.settings.accountName
      });
      if (upsertErr) {
        isSupabaseActive = false;
        supabaseStatusMessage = `Bảng trên Supabase đang bật RLS chặn ghi với Publishable Key (${upsertErr.message}). Hãy chạy lại supabase_schema.sql để tắt RLS hoặc dùng Secret Key (sb_secret_...).`;
        console.warn('[DB] ' + supabaseStatusMessage);
        return;
      }
    }

    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    if (!userCount || userCount === 0) {
      if (local.users.length > 0) {
        await supabase.from('users').upsert(local.users.map(mapUserToPg));
      }
    } else {
      // Nếu trên Supabase có user mà password chưa băm sha256$, tự động băm
      const { data: pgUsers } = await supabase.from('users').select('*');
      if (Array.isArray(pgUsers)) {
        for (const pu of pgUsers) {
          if (pu.password_hash && !String(pu.password_hash).startsWith('sha256$')) {
            await supabase
              .from('users')
              .update({ password_hash: storedHashPasswordFn(pu.password_hash) })
              .eq('id', pu.id);
          }
        }
      }
    }

    const { count: planCount } = await supabase
      .from('plans')
      .select('*', { count: 'exact', head: true });
    if (!planCount || planCount === 0) {
      if (local.plans.length > 0) {
        await supabase.from('plans').upsert(local.plans.map(mapPlanToPg));
      }
    }

    const { count: domCount } = await supabase
      .from('domain_pricing')
      .select('*', { count: 'exact', head: true });
    if (!domCount || domCount === 0) {
      if (local.domain_pricing.length > 0) {
        await supabase.from('domain_pricing').upsert(local.domain_pricing.map(mapDomainToPg));
      }
    }

    const { count: addonCount } = await supabase
      .from('addons')
      .select('*', { count: 'exact', head: true });
    if (!addonCount || addonCount === 0) {
      if (local.addons.length > 0) {
        await supabase.from('addons').upsert(local.addons.map(mapAddonToPg));
      }
    }

    const { count: couponCount } = await supabase
      .from('coupons')
      .select('*', { count: 'exact', head: true });
    if (!couponCount || couponCount === 0) {
      if (local.coupons.length > 0) {
        await supabase.from('coupons').upsert(
          local.coupons.map((c) => ({
            code: c.code,
            type: c.type,
            value: Number(c.value),
            description: c.description || ''
          }))
        );
      }
    }
  } catch (err) {
    isSupabaseActive = false;
    supabaseStatusMessage = `Lỗi kết nối Supabase (${err.message}). Đang tạm dùng db.json cục bộ.`;
    console.error('[DB] ' + supabaseStatusMessage);
  }
}

function getDbStatus() {
  return {
    engine: isSupabaseActive ? 'Supabase PostgreSQL (Cloud SQL)' : 'Local JSON (db.json)',
    isCloudSql: isSupabaseActive,
    supabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    message: supabaseStatusMessage
  };
}

// ============================================================================
// CÁC PHƯƠNG THỨC TRUY VẤN DỮ LIỆU ĐỒNG NHẤT (ASYNC DATA ACCESS LAYER)
// ============================================================================

async function getCatalogData() {
  if (supabase && !isSupabaseActive) {
    await initDatabase();
  }
  if (!isSupabaseActive) {
    const db = readLocalDb();
    return {
      settings: db.settings,
      plans: db.plans,
      domain_pricing: db.domain_pricing,
      addons: db.addons,
      coupons: db.coupons
    };
  }

  const [settingsRes, plansRes, domRes, addonsRes, couponsRes] = await Promise.all([
    supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('plans').select('*'),
    supabase.from('domain_pricing').select('*'),
    supabase.from('addons').select('*'),
    supabase.from('coupons').select('*')
  ]);

  const local = readLocalDb();
  const s = settingsRes.data;
  const pgPlans = Array.isArray(plansRes.data) && plansRes.data.length > 0 ? plansRes.data.map(mapPlanFromPg) : local.plans;
  const pgDomains = Array.isArray(domRes.data) && domRes.data.length > 0 ? domRes.data.map(mapDomainFromPg) : local.domain_pricing;
  const pgAddons =
    Array.isArray(addonsRes.data) && addonsRes.data.length > 0
      ? addonsRes.data.map(mapAddonFromPg)
      : local.addons;
  const pgCoupons =
    Array.isArray(couponsRes.data) && couponsRes.data.length > 0
      ? couponsRes.data.map((c) => ({
          code: c.code,
          type: c.type,
          value: Number(c.value),
          description: c.description || ''
        }))
      : local.coupons;

  return {
    settings: s
      ? { bankId: s.bank_id, accountNo: s.account_no, accountName: s.account_name }
      : local.settings,
    plans: pgPlans,
    domain_pricing: pgDomains,
    addons: pgAddons,
    coupons: pgCoupons
  };
}

async function getAllUsers() {
  if (!isSupabaseActive) {
    return readLocalDb().users;
  }
  const { data } = await supabase.from('users').select('*').order('created_at', { ascending: true });
  return Array.isArray(data) ? data.map(mapUserFromPg) : [];
}

async function getUserByUsername(username) {
  const clean = String(username || '').trim().toLowerCase();
  if (!isSupabaseActive) {
    const db = readLocalDb();
    return db.users.find((u) => String(u.username || '').toLowerCase() === clean) || null;
  }
  const { data } = await supabase.from('users').select('*').ilike('username', clean).maybeSingle();
  return mapUserFromPg(data);
}

async function getUserById(id) {
  if (!isSupabaseActive) {
    const db = readLocalDb();
    return db.users.find((u) => u.id === id) || null;
  }
  const { data } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  return mapUserFromPg(data);
}

async function createUser(userObj) {
  if (!isSupabaseActive) {
    const db = readLocalDb();
    db.users.push(userObj);
    writeLocalDb(db);
    return userObj;
  }
  const { data, error } = await supabase
    .from('users')
    .insert(mapUserToPg(userObj))
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapUserFromPg(data);
}

async function deleteUserById(id) {
  if (!isSupabaseActive) {
    const db = readLocalDb();
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    const [removed] = db.users.splice(idx, 1);
    writeLocalDb(db);
    return removed;
  }
  const existing = await getUserById(id);
  if (!existing) return null;
  await supabase.from('users').delete().eq('id', id);
  return existing;
}

async function getCoupons() {
  if (!isSupabaseActive) {
    return readLocalDb().coupons;
  }
  const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  return Array.isArray(data)
    ? data.map((c) => ({
        code: c.code,
        type: c.type,
        value: Number(c.value),
        description: c.description || ''
      }))
    : [];
}

async function upsertCoupon(couponObj) {
  if (!isSupabaseActive) {
    const db = readLocalDb();
    const idx = db.coupons.findIndex((c) => String(c.code).toUpperCase() === couponObj.code);
    if (idx >= 0) {
      db.coupons[idx] = couponObj;
    } else {
      db.coupons.push(couponObj);
    }
    writeLocalDb(db);
    return couponObj;
  }
  const { error } = await supabase.from('coupons').upsert({
    code: couponObj.code,
    type: couponObj.type,
    value: Number(couponObj.value),
    description: couponObj.description || ''
  });
  if (error) throw new Error(error.message);
  return couponObj;
}

async function deleteCouponByCode(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!isSupabaseActive) {
    const db = readLocalDb();
    const idx = db.coupons.findIndex((c) => String(c.code).toUpperCase() === clean);
    if (idx === -1) return false;
    db.coupons.splice(idx, 1);
    writeLocalDb(db);
    return true;
  }
  await supabase.from('coupons').delete().eq('code', clean);
  return true;
}

async function updateBankSettings(settingsObj) {
  if (!isSupabaseActive) {
    const db = readLocalDb();
    db.settings = settingsObj;
    writeLocalDb(db);
    return settingsObj;
  }
  const { error } = await supabase.from('settings').upsert({
    id: 1,
    bank_id: settingsObj.bankId,
    account_no: settingsObj.accountNo,
    account_name: settingsObj.accountName,
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error(error.message);
  return settingsObj;
}

async function getAllOrders() {
  if (!isSupabaseActive) {
    return readLocalDb().orders;
  }
  const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  return Array.isArray(data) ? data.map(mapOrderFromPg) : [];
}

async function getOrderById(id) {
  if (!isSupabaseActive) {
    const db = readLocalDb();
    return db.orders.find((o) => o.id === id) || null;
  }
  const { data } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
  return mapOrderFromPg(data);
}

async function createOrder(orderObj) {
  if (!isSupabaseActive) {
    const db = readLocalDb();
    db.orders.unshift(orderObj);
    writeLocalDb(db);
    return orderObj;
  }
  const { data, error } = await supabase
    .from('orders')
    .insert(mapOrderToPg(orderObj))
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapOrderFromPg(data);
}

async function updateOrder(orderObj) {
  if (!isSupabaseActive) {
    const db = readLocalDb();
    const idx = db.orders.findIndex((o) => o.id === orderObj.id);
    if (idx === -1) return null;
    db.orders[idx] = orderObj;
    writeLocalDb(db);
    return orderObj;
  }
  const { data, error } = await supabase
    .from('orders')
    .update(mapOrderToPg(orderObj))
    .eq('id', orderObj.id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapOrderFromPg(data);
}

async function deleteOrderById(id) {
  if (!isSupabaseActive) {
    const db = readLocalDb();
    const idx = db.orders.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    const [removed] = db.orders.splice(idx, 1);
    writeLocalDb(db);
    return removed;
  }
  const existing = await getOrderById(id);
  if (!existing) return null;
  await supabase.from('orders').delete().eq('id', id);
  return existing;
}

async function getReviews() {
  if (!isSupabaseActive) {
    return readLocalDb().reviews;
  }

  // 1. Ưu tiên đọc từ bảng public.reviews nếu đã tồn tại trên Supabase
  const { data: revRows, error: revErr } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false });

  if (!revErr && Array.isArray(revRows)) {
    return revRows.map((r) => ({
      id: r.id,
      customerName: r.customer_name,
      businessName: r.business_name || '',
      planName: r.plan_name,
      rating: Number(r.rating) || 5,
      comment: r.comment,
      createdAt: r.created_at
    }));
  }

  // 2. Nếu chưa tạo bảng public.reviews riêng, lưu trữ JSONB ngay trên Supabase tại bảng settings (id = 2)
  const { data: storeRow } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 2)
    .maybeSingle();

  if (storeRow && storeRow.account_name) {
    try {
      const parsed = JSON.parse(storeRow.account_name);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

async function createReview(reviewObj) {
  if (!isSupabaseActive) {
    const db = readLocalDb();
    db.reviews.unshift(reviewObj);
    writeLocalDb(db);
    return reviewObj;
  }

  // Thử ghi vào bảng public.reviews trước
  const { data: inserted, error: revErr } = await supabase
    .from('reviews')
    .insert({
      id: reviewObj.id,
      customer_name: reviewObj.customerName,
      business_name: reviewObj.businessName || '',
      plan_name: reviewObj.planName,
      rating: Number(reviewObj.rating) || 5,
      comment: reviewObj.comment,
      created_at: reviewObj.createdAt
    })
    .select('*')
    .single();

  if (!revErr && inserted) {
    return {
      id: inserted.id,
      customerName: inserted.customer_name,
      businessName: inserted.business_name || '',
      planName: inserted.plan_name,
      rating: Number(inserted.rating) || 5,
      comment: inserted.comment,
      createdAt: inserted.created_at
    };
  }

  // Nếu chưa chạy lệnh tạo bảng reviews, lưu trực tiếp trên Supabase tại settings (id = 2)
  const currentList = await getReviews();
  currentList.unshift(reviewObj);
  await supabase.from('settings').upsert({
    id: 2,
    bank_id: 'REVIEWS_STORAGE',
    account_no: String(currentList.length),
    account_name: JSON.stringify(currentList),
    updated_at: new Date().toISOString()
  });
  return reviewObj;
}

async function deleteReviewById(id) {
  if (!isSupabaseActive) {
    const db = readLocalDb();
    const idx = db.reviews.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    db.reviews.splice(idx, 1);
    writeLocalDb(db);
    return true;
  }

  const { error: revErr } = await supabase.from('reviews').delete().eq('id', id);
  if (!revErr) {
    return true;
  }

  const currentList = await getReviews();
  const nextList = currentList.filter((r) => r.id !== id);
  await supabase.from('settings').upsert({
    id: 2,
    bank_id: 'REVIEWS_STORAGE',
    account_no: String(nextList.length),
    account_name: JSON.stringify(nextList),
    updated_at: new Date().toISOString()
  });
  return true;
}

function mapLeadFromPg(row) {
  if (!row) return null;
  const needsObj = (typeof row.needs === 'object' && row.needs !== null) ? row.needs : {};
  return {
    id: row.id,
    customer_name: row.name || row.customer_name || needsObj.customerName || 'Khách tư vấn',
    phone: row.phone || needsObj.phone || '',
    email: needsObj.email || row.email || '',
    site_type: needsObj.siteType || row.site_type || '',
    traffic: needsObj.traffic || needsObj.trafficLabel || row.traffic || '',
    budget: Number(needsObj.budget || row.budget || 0),
    need_domain: Boolean(needsObj.needDomain ?? row.need_domain),
    desired_domain: needsObj.desiredDomain || row.desired_domain || '',
    preferred_extension: needsObj.preferredExtension || row.preferred_extension || '.vn',
    recommended_plan: row.plan_chosen || row.recommended_plan || needsObj.recommendedPlan || '',
    ai_advice: needsObj.aiAdvice || row.ai_advice || '',
    status: needsObj.status || row.status || 'new',
    assigned_to: needsObj.assignedTo || row.assigned_to || '',
    assigned_to_name: needsObj.assignedToName || row.assigned_to_name || 'Chưa phân công',
    notes: needsObj.notes || row.notes || '',
    created_at: row.created_at || new Date().toISOString(),
    updated_at: needsObj.updatedAt || row.updated_at || row.created_at
  };
}

function mapLeadToPg(l) {
  const needs = {
    email: l.email || '',
    siteType: l.site_type || '',
    traffic: l.traffic || '',
    budget: Number(l.budget) || 0,
    needDomain: Boolean(l.need_domain),
    desiredDomain: l.desired_domain || '',
    preferredExtension: l.preferred_extension || '.vn',
    recommendedPlan: l.recommended_plan || '',
    aiAdvice: l.ai_advice || '',
    status: l.status || 'new',
    assignedTo: l.assigned_to || '',
    assignedToName: l.assigned_to_name || 'Chưa phân công',
    notes: l.notes || '',
    updatedAt: l.updated_at || new Date().toISOString()
  };
  return {
    id: l.id,
    name: l.customer_name || l.name || '',
    phone: l.phone || '',
    plan_chosen: l.recommended_plan || l.plan_chosen || '',
    needs: needs,
    created_at: l.created_at || new Date().toISOString()
  };
}

async function createLead(leadObj) {
  if (isSupabaseActive) {
    try {
      const pgRow = mapLeadToPg(leadObj);
      const { data, error } = await supabase.from('leads').insert([pgRow]).select().single();
      if (!error && data) return mapLeadFromPg(data);
      console.warn('[DB] Supabase createLead failed, falling back to local:', error ? error.message : 'no data');
    } catch (e) {
      console.warn('[DB] Supabase createLead exception:', e.message);
    }
  }
  const db = readLocalDb();
  if (!db.leads) db.leads = [];
  db.leads.unshift(leadObj);
  writeLocalDb(db);
  return leadObj;
}

async function getAllLeads() {
  if (isSupabaseActive) {
    try {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        return data.map(mapLeadFromPg);
      }
      console.warn('[DB] Supabase getAllLeads failed, falling back to local:', error ? error.message : 'no data');
    } catch (e) {
      console.warn('[DB] Supabase getAllLeads exception:', e.message);
    }
  }
  const db = readLocalDb();
  return (db.leads || []).map(mapLeadFromPg).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

async function updateLead(leadObj) {
  if (isSupabaseActive) {
    try {
      // First fetch the existing lead to preserve needs object fields
      const { data: existing } = await supabase.from('leads').select('*').eq('id', leadObj.id).maybeSingle();
      if (existing) {
        const existingMapped = mapLeadFromPg(existing);
        const merged = { ...existingMapped, ...leadObj, updated_at: new Date().toISOString() };
        const pgRow = mapLeadToPg(merged);
        const { data, error } = await supabase.from('leads').update({
          needs: pgRow.needs
        }).eq('id', leadObj.id).select().single();
        if (!error && data) return mapLeadFromPg(data);
      }
    } catch (e) {
      console.warn('[DB] Supabase updateLead exception:', e.message);
    }
  }
  const db = readLocalDb();
  if (!db.leads) db.leads = [];
  const idx = db.leads.findIndex(l => l.id === leadObj.id);
  if (idx !== -1) {
    db.leads[idx] = { ...db.leads[idx], ...leadObj, updated_at: new Date().toISOString() };
    writeLocalDb(db);
    return mapLeadFromPg(db.leads[idx]);
  }
  throw new Error('Lead not found');
}

async function deleteLeadById(id) {
  if (isSupabaseActive) {
    try {
      await supabase.from('leads').delete().eq('id', id);
    } catch (e) {
      console.warn('[DB] Supabase deleteLead error:', e.message);
    }
  }
  const db = readLocalDb();
  if (!db.leads) return true;
  db.leads = db.leads.filter(l => l.id !== id);
  writeLocalDb(db);
  return true;
}

module.exports = {
  initDatabase,
  getDbStatus,
  getCatalogData,
  getAllUsers,
  getUserByUsername,
  getUserById,
  createUser,
  deleteUserById,
  getCoupons,
  upsertCoupon,
  deleteCouponByCode,
  updateBankSettings,
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrderById,
  getReviews,
  createReview,
  deleteReviewById,
  createLead,
  getAllLeads,
  updateLead,
  deleteLeadById
};
