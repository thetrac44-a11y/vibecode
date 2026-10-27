/**
 * public/js/app.js — BỘ KHUNG DỰ ÁN (PROJECT SKELETON / STARTER KIT)
 *
 * [ĐÃ CÓ SẴN TRONG KHUNG CỦA LEADER]:
 * - Đồng bộ danh mục Gói cước, Tên miền, Add-ons & Cấu hình VietQR từ Supabase (/api/catalog)
 * - Hiển thị lưới 6 gói Hosting/VPS (renderCatalog) và bảng giá 4 đuôi Tên miền
 * - Xác thực Đăng nhập / Đăng ký Khách hàng (JWT) & Ẩn nút Cổng Quản Trị đối với khách thường
 *
 * [PHẦN VIỆC PHÂN CÔNG CHO CÁC THÀNH VIÊN TRONG ĐỘI — TÌM TỪ KHÓA "TODO"]:
 * - NHIỆM VỤ 1 (Thành viên 1): Hoàn thiện hàm recommendPlans(needs), getAIAdvice(...) và renderComparisonTable(...)
 * - NHIỆM VỤ 2 (Thành viên 2): Hoàn thiện hàm calculateCartTotal(...), luồng Đặt đơn VietQR và openInvoiceModal(...)
 * - NHIỆM VỤ 4 (Thành viên 4): Hoàn thiện hàm renderCustomerReviews(...) (Phân trang 3 đánh giá/trang), renderFAQAccordion() và openMyOrdersModal()
 */

let currentAuthToken = localStorage.getItem('ha_token') || '';
let currentAuthUser = null;
let currentUserNeeds = null;
let lastAIAdvice = null;
let cachedMyOrders = [];

let checkoutState = {
  planId: 'business',
  cycleMonths: 12,
  desiredDomain: '',
  domainExtension: '.vn',
  selectedAddons: [],
  couponCode: '',
  discountAmount: 0,
  createdOrder: null
};

function formatVND(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '0đ';
  return num.toLocaleString('vi-VN') + 'đ';
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =========================================================
// NHIỆM VỤ 1 (THÀNH VIÊN 1): THUẬT TOÁN CHẤM ĐIỂM & BẢNG SO SÁNH 3 GÓI
// =========================================================

function recommendPlans(needs) {
  // TODO [USER PORTAL - THÀNH VIÊN 1]:
  // Xây dựng thuật toán chấm điểm (Scoring) cho 6 gói trong window.PLANS_DATA dựa trên:
  // - needs.siteType ('blog', 'company', 'ecommerce', 'webapp')
  // - needs.traffic ('low', 'medium', 'high', 'very_high')
  // - needs.budget (Ngân sách VNĐ/tháng)
  // - needs.needDomain (Cần mua kèm tên miền -> cộng điểm cho gói có freeDomain === true)
  // Sắp xếp điểm giảm dần và trả về đúng 3 gói cao điểm nhất (01 gói tốt nhất + 02 gói thay thế).
  const plans = window.PLANS_DATA || [];
  return plans.slice(0, 3);
}

async function getAIAdvice(needs, top3Plans) {
  // TODO [USER PORTAL - THÀNH VIÊN 1]:
  // Gọi API POST /api/advice để lấy lời giải thích từ Gemini AI cho gói top3Plans[0],
  // kèm cơ chế Fallback tự động khi mất kết nối mạng.
  const best = top3Plans[0] || { id: 'business', name: 'Business' };
  const alt1 = top3Plans[1] || { id: 'basic', name: 'Basic' };
  const alt2 = top3Plans[2] || { id: 'shop-pro', name: 'Shop Pro' };

  return {
    isFallback: true,
    advice: {
      best: {
        planId: best.id,
        reason: `[TODO - Nhiệm vụ 1]: Hoàn thiện hàm recommendPlans() và getAIAdvice() trong public/js/app.js để phân tích chuyên sâu lý do chọn gói ${best.name}.`
      },
      alternatives: [
        { planId: alt1.id, reason: `[TODO - Nhiệm vụ 1]: Lý do đề xuất gói thay thế ${alt1.name}.` },
        { planId: alt2.id, reason: `[TODO - Nhiệm vụ 1]: Lý do đề xuất gói thay thế ${alt2.name}.` }
      ],
      domainAdvice: '[TODO - Nhiệm vụ 1]: Hoàn thiện lời khuyên chọn tên miền thương hiệu (.vn / .com).'
    }
  };
}

function renderAIResults(top3Plans, advice, isFallback, needs) {
  const section = document.getElementById('section-ai-results');
  const cardsContainer = document.getElementById('ai-recommendation-cards');
  const domainBox = document.getElementById('ai-domain-advice-box');
  const domainText = document.getElementById('ai-domain-advice-text');
  if (!section || !cardsContainer) return;

  section.classList.remove('hidden');
  cardsContainer.innerHTML = top3Plans
    .map((plan, idx) => {
      const isBest = idx === 0;
      const reasonText = isBest
        ? advice.best?.reason
        : advice.alternatives?.[idx - 1]?.reason || plan.bestFor;
      return `
        <div class="rounded-2xl bg-white p-6 flex flex-col justify-between ${
          isBest ? 'plan-card-best' : 'border border-slate-200 shadow-2xs'
        }">
          <div>
            <span class="inline-block text-xs font-bold uppercase px-2.5 py-1 rounded-full ${
              isBest ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'
            } mb-3">
              ${isBest ? 'Gói Phù Hợp Nhất (#1)' : `Phương Án Thay Thế #${idx}`}
            </span>
            <h3 class="text-lg font-bold text-slate-900">${escapeHtml(plan.name)}</h3>
            <div class="text-2xl font-extrabold text-brand-700 my-2">${formatVND(plan.pricePerMonth)}<span class="text-xs font-normal text-slate-500">/tháng</span></div>
            <p class="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">${escapeHtml(reasonText)}</p>
          </div>
          <button
            type="button"
            data-buy-plan-id="${escapeHtml(plan.id)}"
            class="btn-buy-now w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-bold transition-all"
          >
            Chọn Mua &amp; Cấu Hình Gói ${escapeHtml(plan.name)}
          </button>
        </div>
      `;
    })
    .join('');

  if (domainBox && domainText) {
    domainBox.classList.remove('hidden');
    domainText.textContent = advice.domainAdvice || '';
  }
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderComparisonTable(planIds = ['business', 'basic', 'shop-pro'], bestPlanId = 'business') {
  const headEl = document.getElementById('comparison-thead');
  const bodyEl = document.getElementById('comparison-tbody');
  if (!headEl || !bodyEl) return;

  // TODO [USER PORTAL - THÀNH VIÊN 1]:
  // Hoàn thiện bảng so sánh thông số kỹ thuật trực quan giữa 3 gói (Giá/tháng, Dung lượng, Băng thông,
  // Lượt truy cập khuyến nghị, Ưu đãi tên miền, Đối tượng phù hợp & Nút đặt mua).
  headEl.innerHTML = `
    <tr class="border-b border-slate-200 bg-slate-50">
      <th class="p-4 text-xs font-bold uppercase text-slate-500">Tiêu chí so sánh</th>
      ${planIds.map((id) => `<th class="p-4 text-sm font-bold text-slate-900">${escapeHtml(id.toUpperCase())}</th>`).join('')}
    </tr>
  `;
  bodyEl.innerHTML = `
    <tr>
      <td colspan="${planIds.length + 1}" class="p-6 text-center text-xs text-slate-500">
        [TODO - Nhiệm vụ 1]: Hoàn thiện hàm renderComparisonTable() trong public/js/app.js để hiển thị bảng so sánh chi tiết 3 gói.
      </td>
    </tr>
  `;
}

// =========================================================
// HIỂN THỊ DANH MỤC 6 GÓI CƯỚC & BẢNG GIÁ TÊN MIỀN (CÓ SẴN TRONG KHUNG)
// =========================================================

function renderCatalog(filterType = 'all') {
  const grid = document.getElementById('catalog-grid');
  const domainGrid = document.getElementById('domain-pricing-grid');
  if (!grid) return;

  const plans = (window.PLANS_DATA || []).filter(
    (p) => filterType === 'all' || p.type === filterType
  );

  grid.innerHTML = plans
    .map(
      (plan) => `
        <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between hover:border-brand-500 transition-all">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-xs font-semibold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
                ${escapeHtml(plan.type)}
              </span>
              ${
                plan.freeDomain
                  ? '<span class="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">Tặng tên miền</span>'
                  : ''
              }
            </div>
            <h3 class="text-lg font-bold text-slate-900">${escapeHtml(plan.name)}</h3>
            <div class="text-2xl font-extrabold text-slate-900 my-2">
              ${formatVND(plan.pricePerMonth)}<span class="text-xs font-normal text-slate-500">/tháng</span>
            </div>
            <p class="text-xs text-slate-500 mb-3">${escapeHtml(plan.bestFor)}</p>
            <ul class="space-y-1.5 text-xs text-slate-700 border-t border-slate-100 pt-3 mb-5">
              <li><strong>Lưu trữ:</strong> ${escapeHtml(plan.storage)}</li>
              <li><strong>Băng thông:</strong> ${escapeHtml(plan.bandwidth)}</li>
              ${(plan.features || []).map((f) => `<li>• ${escapeHtml(f)}</li>`).join('')}
            </ul>
          </div>
          <div class="space-y-2">
            <button
              type="button"
              data-buy-plan-id="${escapeHtml(plan.id)}"
              class="btn-buy-now w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-bold transition-all"
            >
              Chọn Mua &amp; Cấu Hình Gói
            </button>
          </div>
        </div>
      `
    )
    .join('');

  if (domainGrid && window.DOMAIN_PRICING) {
    domainGrid.innerHTML = window.DOMAIN_PRICING.map(
      (d) => `
        <div class="bg-white rounded-xl border border-slate-200 p-3.5">
          <div class="text-base font-extrabold text-brand-700">${escapeHtml(d.extension)}</div>
          <div class="text-sm font-bold text-slate-900 mt-0.5">${formatVND(d.price)}/năm</div>
          <div class="text-xs text-slate-500 mt-0.5">${escapeHtml(d.description)}</div>
        </div>
      `
    ).join('');
  }
}

// =========================================================
// NHIỆM VỤ 2 (THÀNH VIÊN 2): GIỎ HÀNG E-COMMERCE, VIETQR & HÓA ĐƠN ĐIỆN TỬ
// =========================================================

function calculateCartTotal(planPriceMonthly, cycleMonths, domainExtension, isPlanFreeDomain, selectedAddons, discountAmount, desiredDomain = '', orderCode = 'TAMTINH') {
  // TODO [USER PORTAL - THÀNH VIÊN 1]:
  // 1. Tính tiền Hosting theo chu kỳ 12 / 24 (-10%) / 36 (-20%) tháng
  // 2. Tính tiền Tên miền (0đ nếu isPlanFreeDomain === true)
  // 3. Cộng tiền các dịch vụ Add-ons được tích chọn
  // 4. Trừ mã giảm giá discountAmount và tạo URL mã VietQR động (https://img.vietqr.io/image/...)
  const cycle = Number(cycleMonths) || 12;
  const hostingTotal = Number(planPriceMonthly || 0) * cycle;
  const bankId = window.APP_CONFIG?.BANK_ID || 'MB';
  const accountNo = window.APP_CONFIG?.ACCOUNT_NO || '0988123456';
  const accountName = window.APP_CONFIG?.ACCOUNT_NAME || 'HOSTING ADVISOR CORP';
  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${hostingTotal}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(accountName)}`;

  return {
    cycle,
    cycleDiscountRatio: 0,
    hostingTotal,
    domainTotal: 0,
    addonsTotal: 0,
    subTotal: hostingTotal,
    discountAmount: 0,
    finalTotal: hostingTotal,
    qrUrl
  };
}

function openCheckoutModal(planId) {
  checkoutState.planId = planId || 'business';
  const plan = (window.PLANS_DATA || []).find((p) => p.id === checkoutState.planId) || (window.PLANS_DATA || [])[0];
  if (!plan) return;

  const calc = calculateCartTotal(plan.pricePerMonth, checkoutState.cycleMonths, checkoutState.domainExtension, plan.freeDomain, checkoutState.selectedAddons, checkoutState.discountAmount, checkoutState.desiredDomain);
  document.getElementById('checkout-plan-title').textContent = `${plan.name} (${formatVND(plan.pricePerMonth)}/tháng)`;
  document.getElementById('summary-hosting-price').textContent = formatVND(calc.hostingTotal);
  document.getElementById('summary-total-price').textContent = formatVND(calc.finalTotal);
  const qrImg = document.getElementById('checkout-qr-img');
  if (qrImg) qrImg.src = calc.qrUrl;

  document.getElementById('checkout-modal')?.classList.remove('hidden');
}

function initCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  const closeBtn = document.getElementById('btn-close-checkout');
  const createOrderBtn = document.getElementById('btn-create-order');
  const statusMsg = document.getElementById('checkout-status-msg');

  closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));

  document.addEventListener('click', (event) => {
    const buyBtn = event.target.closest('.btn-buy-now');
    if (!buyBtn) return;
    openCheckoutModal(buyBtn.getAttribute('data-buy-plan-id') || 'business');
  });

  createOrderBtn?.addEventListener('click', async () => {
    // TODO [USER PORTAL - THÀNH VIÊN 1]:
    // Gửi POST /api/orders kèm thông tin người mua, gói cước, chu kỳ, tên miền, add-ons, coupon.
    // Lưu đồng thời vào localStorage ("leads") và hiển thị nút xác nhận thanh toán + nút xem Hóa đơn điện tử.
    if (statusMsg) {
      statusMsg.textContent = '[TODO - Nhiệm vụ 2]: Hãy hoàn thiện sự kiện đặt hàng trong initCheckoutModal() (public/js/app.js) và POST /api/orders (server.js).';
      statusMsg.className = 'mt-3 rounded-xl p-3 text-xs font-medium bg-amber-50 border border-amber-200 text-amber-800';
      statusMsg.classList.remove('hidden');
    }
  });
}

function openInvoiceModal(order) {
  // TODO [USER PORTAL - THÀNH VIÊN 1]:
  // Render chi tiết Hóa đơn điện tử (E-Invoice) vào #invoice-content-area kèm dấu mộc PAID / UNPAID và nút window.print().
}

// =========================================================
// NHIỆM VỤ 4 (THÀNH VIÊN 4): ĐÁNH GIÁ KHÁCH HÀNG PHÂN TRANG, FAQ & TRA CỨU ĐƠN
// =========================================================

function renderCustomerReviews(reviews) {
  const container = document.getElementById('reviews-list-container');
  if (!container) return;

  // TODO [USER PORTAL - THÀNH VIÊN 1]:
  // 1. Tính điểm đánh giá trung bình và tổng số đánh giá hiển thị lên #reviews-summary-bar
  // 2. Chia phân trang cố định 3 đánh giá / trang (kèm nút Trang trước / Số trang / Trang sau tại #reviews-pagination-bar)
  container.innerHTML = `
    <div class="md:col-span-3 bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
      <div class="text-sm font-bold text-slate-800">[TODO - Nhiệm vụ 4]: Hiển thị Đánh giá Khách hàng có Phân trang</div>
      <p class="text-xs text-slate-500 mt-1">
        Hoàn thiện hàm renderCustomerReviews() và initCustomerReviewsForm() trong public/js/app.js (Hiện có ${(reviews || []).length} đánh giá trên Supabase).
      </p>
    </div>
  `;
}

function initCustomerReviewsForm() {
  // TODO [USER PORTAL - THÀNH VIÊN 1]:
  // Bắt sự kiện submit của #customer-review-form, gửi POST /api/reviews và gọi lại renderCustomerReviews().
}

function renderFAQAccordion() {
  const container = document.getElementById('faq-accordion');
  if (!container) return;

  // TODO [USER PORTAL - THÀNH VIÊN 1]:
  // Render danh sách câu hỏi thường gặp từ window.FAQ_DATA và xử lý sự kiện đóng/mở Accordion.
  container.innerHTML = `
    <div class="p-6 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
      [TODO - Nhiệm vụ 4]: Hoàn thiện hàm renderFAQAccordion() trong public/js/app.js từ dữ liệu window.FAQ_DATA.
    </div>
  `;
}

function initOrdersAndInvoiceModals() {
  const openBtn = document.getElementById('btn-open-my-orders');
  const closeBtn = document.getElementById('btn-close-my-orders');
  openBtn?.addEventListener('click', () => {
    document.getElementById('my-orders-modal')?.classList.remove('hidden');
  });
  closeBtn?.addEventListener('click', () => {
    document.getElementById('my-orders-modal')?.classList.add('hidden');
  });
}

// =========================================================
// HỆ THỐNG ĐĂNG NHẬP KHÁCH HÀNG & KHỞI CHẠY (CÓ SẴN TRONG KHUNG)
// =========================================================

function updateNavbarAuthUI() {
  const guestBox = document.getElementById('nav-guest-box');
  const userBox = document.getElementById('nav-user-box');
  const greeting = document.getElementById('nav-user-greeting');
  const adminLink = document.getElementById('nav-admin-link');

  if (currentAuthUser && currentAuthToken) {
    guestBox?.classList.add('hidden');
    userBox?.classList.remove('hidden');
    userBox?.classList.add('flex');
    if (greeting) greeting.textContent = `Chào, ${currentAuthUser.fullName}`;
    if (currentAuthUser.role === 'admin' || currentAuthUser.role === 'staff') {
      adminLink?.classList.remove('hidden');
      localStorage.setItem('ha_admin_token', currentAuthToken);
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

async function restoreAuthSession() {
  if (!currentAuthToken) {
    updateNavbarAuthUI();
    return;
  }
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${currentAuthToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      currentAuthUser = data.user;
    } else {
      currentAuthToken = '';
      currentAuthUser = null;
      localStorage.removeItem('ha_token');
    }
  } catch (e) {
    console.warn(e);
  }
  updateNavbarAuthUI();
}

function initAuthModal() {
  const modal = document.getElementById('auth-modal');
  const openBtn = document.getElementById('btn-open-auth');
  const closeBtn = document.getElementById('btn-close-auth');
  const logoutBtn = document.getElementById('btn-user-logout');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabLogin = document.getElementById('tab-auth-login');
  const tabReg = document.getElementById('tab-auth-register');

  openBtn?.addEventListener('click', () => modal?.classList.remove('hidden'));
  closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));
  tabLogin?.addEventListener('click', () => {
    loginForm?.classList.remove('hidden');
    registerForm?.classList.add('hidden');
  });
  tabReg?.addEventListener('click', () => {
    loginForm?.classList.add('hidden');
    registerForm?.classList.remove('hidden');
  });
  logoutBtn?.addEventListener('click', () => {
    currentAuthToken = '';
    currentAuthUser = null;
    localStorage.removeItem('ha_token');
    localStorage.removeItem('ha_admin_token');
    updateNavbarAuthUI();
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      currentAuthToken = data.token;
      currentAuthUser = data.user;
      localStorage.setItem('ha_token', currentAuthToken);
      updateNavbarAuthUI();
      modal?.classList.add('hidden');
    }
  });
}

function initSurveyFormAndCatalog() {
  const form = document.getElementById('needs-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const siteType = document.querySelector('input[name="siteType"]:checked')?.value || 'ecommerce';
    const traffic = document.getElementById('traffic')?.value || 'medium';
    const budget = Number(document.getElementById('budget')?.value) || 150000;
    const needDomain = Boolean(document.getElementById('needDomain')?.checked);
    const desiredDomain = document.getElementById('desiredDomain')?.value.trim() || '';
    const preferredExtension = document.getElementById('preferredExtension')?.value || '.vn';

    const needs = { siteType, traffic, budget, needDomain, desiredDomain, preferredExtension };
    currentUserNeeds = needs;
    const top3Plans = recommendPlans(needs);
    const { advice, isFallback } = await getAIAdvice(needs, top3Plans);
    lastAIAdvice = advice;
    renderAIResults(top3Plans, advice, isFallback, needs);
    renderComparisonTable(top3Plans.map((p) => p.id), top3Plans[0]?.id);
  });

  document.querySelectorAll('.catalog-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      renderCatalog(btn.getAttribute('data-filter') || 'all');
    });
  });
}

async function loadDynamicCatalog() {
  try {
    const res = await fetch('/api/catalog');
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.plans) && data.plans.length > 0) window.PLANS_DATA = data.plans;
    if (Array.isArray(data.domain_pricing) && data.domain_pricing.length > 0) window.DOMAIN_PRICING = data.domain_pricing;
    if (Array.isArray(data.addons) && data.addons.length > 0) window.ADDONS_DATA = data.addons;
    if (data.settings) {
      window.APP_CONFIG = {
        ...window.APP_CONFIG,
        BANK_ID: data.settings.bankId || 'MB',
        ACCOUNT_NO: data.settings.accountNo || '0988123456',
        ACCOUNT_NAME: data.settings.accountName || 'HOSTING ADVISOR CORP'
      };
    }
    renderCatalog('all');
    renderComparisonTable(['business', 'basic', 'shop-pro'], 'business');
    renderCustomerReviews(data.reviews || []);
  } catch (e) {
    console.warn(e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  restoreAuthSession();
  renderCatalog('all');
  renderComparisonTable(['business', 'basic', 'shop-pro'], 'business');
  renderFAQAccordion();
  loadDynamicCatalog();
  initSurveyFormAndCatalog();
  initAuthModal();
  initCheckoutModal();
  initOrdersAndInvoiceModals();
  initCustomerReviewsForm();
});

