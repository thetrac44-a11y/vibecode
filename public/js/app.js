/**
 * public/js/app.js
 * Logic Mua sắm E-Commerce, Trợ lý AI Tư vấn, Tính toán Giỏ hàng/Add-ons/Coupon, VietQR động và Hóa đơn điện tử
 */

const TRAFFIC_VALUE = {
  'duoi-1k': 1000,
  '1k-10k': 10000,
  '10k-50k': 50000,
  'tren-50k': 100000
};

const SITE_TYPE_LABEL = {
  'ban-hang': 'Bán hàng',
  'gioi-thieu': 'Giới thiệu doanh nghiệp',
  'blog': 'Blog / Tin tức'
};

const TRAFFIC_LABEL = {
  'duoi-1k': 'Dưới 1.000 lượt/tháng',
  '1k-10k': '1.000 - 10.000 lượt/tháng',
  '10k-50k': '10.000 - 50.000 lượt/tháng',
  'tren-50k': 'Trên 50.000 lượt/tháng'
};

const AI_SYSTEM_PROMPT = `Bạn là chuyên viên tư vấn hosting và tên miền thân thiện tại nền tảng thương mại điện tử HostingAdvisor, đang tư vấn cho chủ shop online nhỏ KHÔNG rành kỹ thuật.

NHIỆM VỤ: Dựa trên nhu cầu khách và 3 gói đã được hệ thống chọn sẵn, viết lời giải thích tại sao mỗi gói phù hợp và tư vấn chọn đuôi tên miền.

QUY TẮC BẮT BUỘC:
1. Viết tiếng Việt đơn giản, giọng thân thiện, xưng "mình" gọi "bạn".
2. Không lạm dụng thuật ngữ kỹ thuật. Nếu nhắc tới NVMe, băng thông, SSL, VPS thì giải thích ngắn gọn theo ngôn ngữ đời thường.
3. Mỗi lý do dài 2-3 câu, nhắc cụ thể đến ngân sách và lượng khách truy cập của người dùng.
4. Chỉ dùng thông tin có trong dữ liệu gói được cung cấp. Tuyệt đối không bịa giá hay tính năng.
5. Nếu giá gói vượt ngân sách, nói thẳng điều đó và nêu lý do vẫn đề xuất.
6. Chỉ trả về JSON hợp lệ theo đúng schema { best, alternatives, domainAdvice }.`;

// Trạng thái toàn cục phía Client
let currentAuthUser = null;
let currentAuthToken = localStorage.getItem('ha_token') || '';
let currentUserNeeds = null;
let lastAIAdvice = null;
let pendingCheckoutPlanId = null;

// Trạng thái trong Modal Đặt mua (Checkout)
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

// Danh sách đơn hàng cá nhân đã tải
let cachedMyOrders = [];

/**
 * Định dạng tiền tệ VNĐ
 */
function formatVND(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '0đ';
  return num.toLocaleString('vi-VN') + 'đ';
}

/**
 * Escape HTML chống XSS
 */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =========================================================
// 1. THUẬT TOÁN CHẤM ĐIỂM GÓI & TÍNH TOÁN GIỎ HÀNG (PROMPT 3)
// =========================================================

/**
 * Chấm điểm mức độ phù hợp của 1 gói với nhu cầu người dùng
 */
function scorePlan(plan, needs) {
  let score = 0;
  const requiredVisits = TRAFFIC_VALUE[needs.traffic] || 1000;
  const budget = Number(needs.budget) || 100000;

  // 1. Ngân sách (tối đa 35 điểm)
  if (plan.pricePerMonth <= budget) {
    score += 30;
    const ratio = plan.pricePerMonth / Math.max(budget, 1);
    if (ratio >= 0.45 && ratio <= 1.0) {
      score += 5;
    }
  } else {
    const overRatio = (plan.pricePerMonth - budget) / Math.max(budget, 1);
    score -= Math.min(35, Math.round(overRatio * 28));
  }

  // 2. Sức chứa lượng truy cập (tối đa 35 điểm)
  if (plan.recommendedVisits >= requiredVisits) {
    score += 25;
    const capRatio = plan.recommendedVisits / Math.max(requiredVisits, 1);
    if (capRatio <= 4) {
      score += 10;
    } else if (capRatio <= 10) {
      score += 4;
    }
  } else {
    const deficit = (requiredVisits - plan.recommendedVisits) / Math.max(requiredVisits, 1);
    score -= Math.round(deficit * 40);
  }

  // 3. Loại website (tối đa 20 điểm)
  if (needs.siteType === 'ban-hang') {
    if (plan.id === 'business' || plan.id === 'shop-pro') score += 20;
    else if (plan.id === 'basic' || plan.id === 'vps-1') score += 12;
    else if (plan.id === 'starter') score -= 8;
  } else if (needs.siteType === 'gioi-thieu') {
    if (plan.id === 'basic' || plan.id === 'starter') score += 18;
    else if (plan.id === 'business') score += 14;
  } else if (needs.siteType === 'blog') {
    if (requiredVisits <= 10000 && (plan.id === 'starter' || plan.id === 'basic')) score += 18;
    else if (requiredVisits > 10000 && (plan.id === 'business' || plan.id === 'shop-pro' || plan.id === 'vps-1')) score += 18;
  }

  // 4. Tặng tên miền miễn phí năm đầu (10 điểm)
  if (needs.needDomain && plan.freeDomain) {
    score += 10;
  }

  return score;
}

/**
 * Chọn ra Top 3 gói phù hợp nhất (1 gói chính + 2 gói thay thế)
 */
function pickTop3(plans, needs) {
  const scored = (plans || window.PLANS_DATA).map((plan) => ({
    ...plan,
    _score: scorePlan(plan, needs)
  }));

  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return Math.abs(a.pricePerMonth - needs.budget) - Math.abs(b.pricePerMonth - needs.budget);
  });

  return scored.slice(0, 3);
}

/**
 * Tính tổng tiền giỏ hàng: Hosting (theo chu kỳ 12/24/36 tháng), Tên miền, Add-ons, trừ Coupon và sinh link VietQR
 */
function calculateCartTotal(
  planPriceMonthly,
  cycleMonths,
  domainExtension,
  isPlanFreeDomain,
  selectedAddons,
  discountAmount,
  desiredDomain = '',
  orderCode = 'TAMTINH'
) {
  const cycle = [12, 24, 36].includes(Number(cycleMonths)) ? Number(cycleMonths) : 12;
  let cycleDiscountRatio = 0;
  if (cycle === 24) cycleDiscountRatio = 0.1;
  if (cycle === 36) cycleDiscountRatio = 0.2;

  const rawHosting = Number(planPriceMonthly || 0) * cycle;
  const hostingTotal = Math.round(rawHosting * (1 - cycleDiscountRatio));

  let domainTotal = 0;
  const cleanDomain = String(desiredDomain || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (cleanDomain && domainExtension) {
    const extObj = (window.DOMAIN_PRICING || []).find((d) => d.extension === domainExtension);
    const extPrice = extObj ? extObj.price : 280000;
    domainTotal = isPlanFreeDomain ? 0 : extPrice;
  }

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

  const bankId = window.APP_CONFIG?.BANK_ID || 'MB';
  const accountNo = window.APP_CONFIG?.ACCOUNT_NO || '0988123456';
  const accountName = window.APP_CONFIG?.ACCOUNT_NAME || 'HOSTING ADVISOR CORP';

  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${finalTotal}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(accountName)}`;

  return {
    cycle,
    cycleDiscountRatio,
    hostingTotal,
    domainTotal,
    addonsTotal,
    addonItems,
    subTotal,
    discountAmount: validDiscount,
    finalTotal,
    qrUrl
  };
}

/**
 * Xây dựng lời giải thích dự phòng (Fallback) khi mất mạng hoặc lỗi API
 */
function buildFallbackAdvice(needs, top3Plans) {
  const best = top3Plans[0];
  const alt1 = top3Plans[1];
  const alt2 = top3Plans[2];
  const budgetStr = formatVND(needs.budget);
  const trafficStr = TRAFFIC_LABEL[needs.traffic] || needs.traffic;
  const siteStr = SITE_TYPE_LABEL[needs.siteType] || needs.siteType;

  const makeReason = (plan, isBest) => {
    const budgetNote =
      plan.pricePerMonth <= needs.budget
        ? `Mức giá ${formatVND(plan.pricePerMonth)}/tháng nằm gọn trong ngân sách ${budgetStr} của bạn.`
        : `Mức giá ${formatVND(plan.pricePerMonth)}/tháng nhỉnh hơn ngân sách ${budgetStr} một chút nhưng bù lại cấu hình rất dư dả để không phải nâng cấp sớm.`;
    const domainNote =
      needs.needDomain && plan.freeDomain
        ? ' Đặc biệt gói này tặng miễn phí tên miền năm đầu giúp bạn tiết kiệm ngay từ 190.000đ đến 550.000đ.'
        : '';
    return `${isBest ? 'Mình đề xuất gói ' + plan.name + ' làm lựa chọn số 1' : 'Gói ' + plan.name + ' là phương án thay thế đáng cân nhắc'} cho website ${siteStr.toLowerCase()} với quy mô ${trafficStr} (chịu tải tới ${plan.recommendedVisits.toLocaleString('vi-VN')} lượt/tháng). ${budgetNote}${domainNote}`;
  };

  const fullDomain = needs.desiredDomain
    ? `${needs.desiredDomain}${needs.preferredExtension || '.vn'}`
    : `thuonghieucuaban${needs.preferredExtension || '.vn'}`;

  const domainAdvice = needs.needDomain
    ? `Với website ${siteStr.toLowerCase()}, bạn nên đăng ký sớm tên miền "${fullDomain}" để bảo vệ thương hiệu và tăng độ tin cậy với khách hàng Việt Nam. Nếu chọn gói Basic, Business hoặc Shop Pro, bạn sẽ được tặng miễn phí tên miền này trong năm đầu tiên.`
    : `Bạn đã có sẵn tên miền riêng nên chỉ cần chọn gói Hosting phù hợp; sau khi thanh toán VietQR hệ thống sẽ cấp ngay địa chỉ IP và cặp Nameservers để bạn trỏ tên miền về trong 2 phút.`;

  return {
    best: { planId: best.id, reason: makeReason(best, true) },
    alternatives: [
      { planId: alt1.id, reason: makeReason(alt1, false) },
      { planId: alt2.id, reason: makeReason(alt2, false) }
    ],
    domainAdvice
  };
}

/**
 * Gọi API Proxy /api/advice để lấy lời tư vấn từ Gemini AI (kèm Fallback tự động)
 */
async function getAIAdvice(needs, top3Plans) {
  const fallback = buildFallbackAdvice(needs, top3Plans);
  const planIds = top3Plans.map((p) => p.id);

  const userMessage = `NHU CẦU KHÁCH HÀNG:
- Loại website: ${SITE_TYPE_LABEL[needs.siteType] || needs.siteType}
- Lượng truy cập ước tính: ${TRAFFIC_LABEL[needs.traffic] || needs.traffic}
- Ngân sách dự kiến: ${formatVND(needs.budget)}/tháng
- Cần mua kèm tên miền: ${needs.needDomain ? 'Có' : 'Không'}
- Tên miền dự định: ${needs.desiredDomain ? needs.desiredDomain + (needs.preferredExtension || '.vn') : 'Chưa đặt tên cụ thể'}

3 GÓI ĐÃ ĐƯỢC CHẤM ĐIỂM CAO NHẤT:
${JSON.stringify(top3Plans, null, 2)}`;

  try {
    const res = await fetch('/api/advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: AI_SYSTEM_PROMPT,
        userMessage,
        planIds
      })
    });

    if (!res.ok) {
      return { advice: fallback, isFallback: true };
    }

    const data = await res.json();
    if (!data.ok || !data.raw) {
      return { advice: fallback, isFallback: true };
    }

    const parsed = JSON.parse(data.raw);
    if (
      !parsed ||
      !parsed.best ||
      !parsed.best.planId ||
      !Array.isArray(parsed.alternatives) ||
      parsed.alternatives.length < 2
    ) {
      return { advice: fallback, isFallback: true };
    }

    return { advice: parsed, isFallback: false };
  } catch (err) {
    console.warn('Chuyển sang chế độ tư vấn dự phòng (Fallback):', err.message);
    return { advice: fallback, isFallback: true };
  }
}

// =========================================================
// 2. RENDER GIAO DIỆN KẾT QUẢ AI, BẢNG SO SÁNH, CATALOG & FAQ
// =========================================================

/**
 * Hiển thị 1 gói phù hợp nhất + 2 gói thay thế + lời khuyên tên miền từ AI
 */
function renderAIResults(top3Plans, advice, isFallback, needs) {
  const container = document.getElementById('results-container');
  const badgeWrap = document.getElementById('advice-mode-badge');
  const badgeText = document.getElementById('advice-mode-text');
  if (!container) return;

  if (badgeWrap && badgeText) {
    badgeWrap.classList.remove('hidden');
    if (isFallback) {
      badgeText.textContent = 'Chế độ Tư vấn thông minh (Rule-based Fallback)';
      badgeText.className = 'inline-block text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full';
    } else {
      badgeText.textContent = 'Phân tích trực tiếp bởi Google Gemini AI';
      badgeText.className = 'inline-block text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full';
    }
  }

  const bestPlan = top3Plans.find((p) => p.id === advice.best?.planId) || top3Plans[0];
  const altPlans = top3Plans.filter((p) => p.id !== bestPlan.id).slice(0, 2);

  const getReason = (planId, idx) => {
    if (planId === bestPlan.id) return advice.best?.reason || '';
    const found = (advice.alternatives || []).find((a) => a.planId === planId);
    if (found && found.reason) return found.reason;
    return advice.alternatives?.[idx]?.reason || '';
  };

  const bestOverBudget = bestPlan.pricePerMonth > needs.budget;

  const html = `
    <!-- Lời khuyên chọn tên miền từ AI -->
    <div class="rounded-2xl bg-brand-50 border border-brand-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div class="text-xs font-bold uppercase tracking-wider text-brand-700 mb-1">
          Tư vấn Tên miền &amp; Thương hiệu từ AI
        </div>
        <p class="text-xs sm:text-sm text-slate-700 leading-relaxed">
          ${escapeHtml(advice.domainAdvice || '')}
        </p>
      </div>
      <a href="#section-comparison" class="shrink-0 text-xs font-semibold text-brand-700 hover:text-brand-800 underline">
        Xem bảng so sánh 3 gói
      </a>
    </div>

    <!-- Thẻ Gói Phù Hợp Nhất -->
    <div class="rounded-2xl border-2 border-brand-600 bg-white shadow-md overflow-hidden">
      <div class="bg-brand-600 text-white px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs font-bold uppercase tracking-wider">Gói Phù Hợp Nhất Cho Bạn</span>
        <span class="text-xs font-medium bg-white/20 px-2.5 py-0.5 rounded-full">${escapeHtml(bestPlan.type)}</span>
      </div>

      <div class="p-5 sm:p-7">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div class="flex flex-wrap items-center gap-2.5">
              <h3 class="text-2xl font-extrabold text-slate-900">Gói ${escapeHtml(bestPlan.name)}</h3>
              ${
                bestPlan.freeDomain
                  ? '<span class="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">Tặng tên miền năm đầu</span>'
                  : ''
              }
              ${
                bestOverBudget
                  ? '<span class="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">Vượt nhẹ ngân sách</span>'
                  : '<span class="text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-full">Trong ngân sách</span>'
              }
            </div>
            <p class="text-xs sm:text-sm text-slate-500 mt-1">${escapeHtml(bestPlan.bestFor)}</p>
          </div>

          <div class="md:text-right">
            <div class="text-2xl sm:text-3xl font-extrabold text-brand-600">
              ${formatVND(bestPlan.pricePerMonth)}<span class="text-sm font-normal text-slate-500">/tháng</span>
            </div>
            <div class="text-xs text-slate-500">Đáp ứng ~${bestPlan.recommendedVisits.toLocaleString('vi-VN')} lượt truy cập/tháng</div>
          </div>
        </div>

        <!-- Lý do AI giải thích -->
        <div class="my-5 p-4 rounded-xl bg-brand-50/70 border border-brand-200">
          <div class="text-xs font-bold uppercase tracking-wide text-brand-800 mb-1">
            Tại sao AI khuyên bạn chọn gói ${escapeHtml(bestPlan.name)}?
          </div>
          <p class="text-sm text-slate-800 leading-relaxed">
            ${escapeHtml(getReason(bestPlan.id, 0))}
          </p>
        </div>

        <!-- Thông số & Nút hành động -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex flex-wrap gap-2 text-xs text-slate-700">
            <span class="px-3 py-1.5 rounded-lg bg-slate-100 font-medium">Lưu trữ: <strong>${escapeHtml(bestPlan.storage)}</strong></span>
            <span class="px-3 py-1.5 rounded-lg bg-slate-100 font-medium">Băng thông: <strong>${escapeHtml(bestPlan.bandwidth)}</strong></span>
            ${bestPlan.features.map((f) => `<span class="px-3 py-1.5 rounded-lg bg-slate-100">${escapeHtml(f)}</span>`).join('')}
          </div>

          <div class="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              data-buy-plan-id="${bestPlan.id}"
              class="btn-buy-now py-3 px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all"
            >
              Mua Ngay (VietQR)
            </button>
            <button
              type="button"
              data-lead-plan-name="${escapeHtml(bestPlan.name)}"
              class="btn-open-lead py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm transition-all"
            >
              Đăng Ký Tư Vấn
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 2 Gói Thay Thế -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      ${altPlans
        .map((plan, idx) => {
          return `
            <div class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div class="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <span class="inline-block text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full mb-1">
                      Phương án thay thế ${idx + 1}
                    </span>
                    <h4 class="text-lg font-bold text-slate-900">Gói ${escapeHtml(plan.name)}</h4>
                    <span class="text-xs text-slate-500">${escapeHtml(plan.type)}</span>
                  </div>
                  <div class="text-right">
                    <div class="text-xl font-bold text-slate-900">${formatVND(plan.pricePerMonth)}</div>
                    <span class="text-xs text-slate-500">/tháng</span>
                  </div>
                </div>

                <div class="my-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <strong class="block text-xs uppercase text-slate-500 mb-1">Nhận xét từ AI:</strong>
                  ${escapeHtml(getReason(plan.id, idx))}
                </div>

                <ul class="space-y-1 text-xs text-slate-600 mb-5">
                  <li>Dung lượng: <strong>${escapeHtml(plan.storage)}</strong> | Băng thông: <strong>${escapeHtml(plan.bandwidth)}</strong></li>
                  <li>Sức chứa: <strong>~${plan.recommendedVisits.toLocaleString('vi-VN')} lượt/tháng</strong></li>
                  <li>Tên miền năm đầu: <strong>${plan.freeDomain ? 'Tặng miễn phí' : 'Chưa bao gồm'}</strong></li>
                </ul>
              </div>

              <div class="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  data-buy-plan-id="${plan.id}"
                  class="btn-buy-now py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm transition-all"
                >
                  Mua Ngay
                </button>
                <button
                  type="button"
                  data-lead-plan-name="${escapeHtml(plan.name)}"
                  class="btn-open-lead py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm transition-all"
                >
                  Đăng Ký Tư Vấn
                </button>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  container.innerHTML = html;

  // Them form tu van vao cuoi results container
  const consultBox = document.createElement('div');
  consultBox.id = 'lead-consult-box';
  consultBox.className = 'mt-6 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm';
  consultBox.innerHTML = `
    <h3 class="text-base font-bold text-slate-800 mb-1">Nhan tu van truc tiep tu chuyen gia</h3>
    <p class="text-xs text-slate-500 mb-4">Dien thong tin de nhan vien cua chung toi lien he tu van mien phi trong vong 15 phut.</p>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
      <input id="ai-lead-name" type="text" placeholder="Họ và tên *" class="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400 w-full" />
      <input id="ai-lead-phone" type="tel" placeholder="Số điện thoại *" class="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400 w-full" />
      <input id="ai-lead-email" type="email" placeholder="Email (tùy chọn)" class="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400 w-full" />
    </div>
    <button id="btn-submit-ai-lead" class="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl px-6 py-2.5 text-sm transition-colors">
      Đăng Ký Nhận Tư Vấn Miễn Phí
    </button>
    <p id="ai-lead-msg" class="mt-2 text-xs hidden"></p>
  `;
  container.appendChild(consultBox);

  // Pre-fill nếu đã đăng nhập
  if (currentAuthUser) {
    const nameEl = document.getElementById('ai-lead-name');
    const phoneEl = document.getElementById('ai-lead-phone');
    const emailEl = document.getElementById('ai-lead-email');
    if (nameEl) nameEl.value = currentAuthUser.fullName || '';
    if (phoneEl) phoneEl.value = currentAuthUser.phone || '';
    if (emailEl) emailEl.value = currentAuthUser.email || '';
  }

  document.getElementById('btn-submit-ai-lead')?.addEventListener('click', async () => {
    const nameVal = (document.getElementById('ai-lead-name')?.value || '').trim();
    const phoneVal = (document.getElementById('ai-lead-phone')?.value || '').trim();
    const emailVal = (document.getElementById('ai-lead-email')?.value || '').trim();
    const msgEl = document.getElementById('ai-lead-msg');
    const btn = document.getElementById('btn-submit-ai-lead');

    if (!nameVal || nameVal.length < 2) {
      msgEl.textContent = 'Vui lòng nhập Họ tên (tối thiểu 2 ký tự)';
      msgEl.className = 'mt-2 text-xs text-red-600';
      msgEl.classList.remove('hidden');
      return;
    }
    if (!phoneVal || phoneVal.length < 9) {
      msgEl.textContent = 'Vui lòng nhập Số điện thoại hợp lệ';
      msgEl.className = 'mt-2 text-xs text-red-600';
      msgEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Đang gửi...';
    msgEl.classList.add('hidden');

    try {
      const bestPlanName = (window.PLANS_DATA || []).find(p => p.id === advice?.best?.planId)?.name || advice?.best?.planId || '';
      const aiAdviceText = advice?.domainAdvice ? (advice.best?.reason || '') + ' ' + (advice.domainAdvice || '') : '';

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: nameVal,
          phone: phoneVal,
          email: emailVal,
          siteType: needs?.siteType || '',
          traffic: needs?.traffic || '',
          budget: needs?.budget || 0,
          needDomain: needs?.needDomain || false,
          desiredDomain: needs?.desiredDomain || '',
          preferredExtension: needs?.preferredExtension || '.vn',
          recommendedPlan: bestPlanName,
          aiAdvice: aiAdviceText.slice(0, 1000)
        })
      });
      const data = await res.json();
      if (data.ok) {
        msgEl.textContent = 'Đăng ký thành công! Chuyên viên tư vấn sẽ liên hệ bạn trong vòng 15 phút.';
        msgEl.className = 'mt-2 text-xs text-emerald-600 font-semibold';
        msgEl.classList.remove('hidden');
        btn.textContent = 'Đã Đăng Ký Tư Vấn';
        btn.disabled = true;
        btn.className = btn.className.replace('bg-brand-600 hover:bg-brand-700', 'bg-slate-400 cursor-not-allowed');
      } else {
        throw new Error(data.error || 'Lỗi hệ thống');
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Đăng Ký Nhận Tư Vấn Miễn Phí';
      msgEl.textContent = 'Lỗi: ' + err.message;
      msgEl.className = 'mt-2 text-xs text-red-600';
      msgEl.classList.remove('hidden');
    }
  });
}

/**
 * Render Bảng so sánh 3 gói được đề xuất (Yêu cầu 3 của Đề 1)
 */
function renderComparisonTable(planIds, bestId) {
  const container = document.getElementById('comparison-container');
  if (!container) return;

  const selectedPlans = (planIds || [])
    .map((id) => (window.PLANS_DATA || []).find((p) => p.id === id))
    .filter(Boolean)
    .slice(0, 3);

  if (selectedPlans.length === 0) return;

  const getColClass = (planId) =>
    planId === bestId
      ? 'border-x-2 border-brand-600 bg-brand-50/30'
      : 'border-l border-slate-200 bg-white';

  container.innerHTML = `
    <div class="table-scroll overflow-x-auto">
      <table class="w-full min-w-[680px] border-collapse text-left text-sm">
        <thead>
          <tr class="border-b border-slate-200">
            <th class="w-1/4 p-4 sm:p-5 bg-slate-50 font-semibold text-slate-700">Tiêu chí so sánh</th>
            ${selectedPlans
              .map((plan) => {
                const isBest = plan.id === bestId;
                return `
                  <th class="w-1/4 p-4 sm:p-5 align-top ${getColClass(plan.id)}">
                    <div class="mb-1.5">
                      ${
                        isBest
                          ? '<span class="inline-block text-xs font-bold uppercase bg-brand-600 text-white px-2.5 py-0.5 rounded-full">Phù hợp nhất</span>'
                          : '<span class="inline-block text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">Gói thay thế</span>'
                      }
                    </div>
                    <div class="text-lg font-bold text-slate-900">${escapeHtml(plan.name)}</div>
                    <div class="text-xs font-normal text-slate-500">${escapeHtml(plan.type)}</div>
                  </th>
                `;
              })
              .join('')}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          <tr>
            <td class="p-4 bg-slate-50/70 font-medium text-slate-700">Giá niêm yết / tháng</td>
            ${selectedPlans
              .map(
                (p) => `
                  <td class="p-4 ${getColClass(p.id)}">
                    <span class="text-lg font-extrabold ${p.id === bestId ? 'text-brand-700' : 'text-slate-900'}">${formatVND(p.pricePerMonth)}</span>
                    <span class="text-xs text-slate-500">/tháng</span>
                  </td>
                `
              )
              .join('')}
          </tr>
          <tr>
            <td class="p-4 bg-slate-50/70 font-medium text-slate-700">Dung lượng lưu trữ</td>
            ${selectedPlans.map((p) => `<td class="p-4 font-semibold text-slate-800 ${getColClass(p.id)}">${escapeHtml(p.storage)}</td>`).join('')}
          </tr>
          <tr>
            <td class="p-4 bg-slate-50/70 font-medium text-slate-700">Băng thông</td>
            ${selectedPlans.map((p) => `<td class="p-4 text-slate-800 ${getColClass(p.id)}">${escapeHtml(p.bandwidth)}</td>`).join('')}
          </tr>
          <tr>
            <td class="p-4 bg-slate-50/70 font-medium text-slate-700">Lượng truy cập khuyến nghị</td>
            ${selectedPlans.map((p) => `<td class="p-4 text-slate-800 ${getColClass(p.id)}">Tối đa ${p.recommendedVisits.toLocaleString('vi-VN')} lượt/tháng</td>`).join('')}
          </tr>
          <tr>
            <td class="p-4 bg-slate-50/70 font-medium text-slate-700">Tặng tên miền năm đầu</td>
            ${selectedPlans
              .map(
                (p) => `
                  <td class="p-4 ${getColClass(p.id)}">
                    ${
                      p.freeDomain
                        ? '<span class="inline-block text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">Có tặng miễn phí</span>'
                        : '<span class="inline-block text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">Chưa bao gồm</span>'
                    }
                  </td>
                `
              )
              .join('')}
          </tr>
          <tr>
            <td class="p-4 bg-slate-50/70 font-medium text-slate-700 align-top">Tính năng nổi bật</td>
            ${selectedPlans
              .map(
                (p) => `
                  <td class="p-4 align-top ${getColClass(p.id)}">
                    <ul class="space-y-1 text-xs sm:text-sm text-slate-700 list-disc list-inside">
                      ${p.features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
                    </ul>
                  </td>
                `
              )
              .join('')}
          </tr>
          <tr>
            <td class="p-4 bg-slate-50/70 font-medium text-slate-700">Đặt mua / Tư vấn</td>
            ${selectedPlans
              .map(
                (p) => `
                  <td class="p-4 ${getColClass(p.id)} space-y-2">
                    <button
                      type="button"
                      data-buy-plan-id="${p.id}"
                      class="btn-buy-now w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold ${
                        p.id === bestId ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'
                      } transition-all"
                    >
                      Mua Ngay
                    </button>
                    <button
                      type="button"
                      data-lead-plan-name="${escapeHtml(p.name)}"
                      class="btn-open-lead w-full py-2 px-3 rounded-xl text-xs font-semibold border border-slate-300 hover:bg-slate-100 text-slate-700 transition-all"
                    >
                      Đăng Ký Tư Vấn
                    </button>
                  </td>
                `
              )
              .join('')}
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Render Danh mục 6 gói Hosting & Bảng giá Tên miền (Section 4)
 */
function renderCatalog(filterType = 'all') {
  const grid = document.getElementById('catalog-grid');
  const domainGrid = document.getElementById('domain-pricing-grid');
  if (!grid) return;

  const plans = (window.PLANS_DATA || []).filter(
    (p) => filterType === 'all' || p.type === filterType
  );

  grid.innerHTML = plans
    .map((plan) => {
      const isPopular = plan.id === 'business' || plan.id === 'shop-pro';
      return `
        <div class="rounded-2xl border ${isPopular ? 'border-2 border-brand-600 shadow-md' : 'border-slate-200 shadow-2xs'} bg-white p-6 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                ${escapeHtml(plan.type)}
              </span>
              ${
                plan.freeDomain
                  ? '<span class="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">Tặng Tên Miền</span>'
                  : ''
              }
            </div>

            <h3 class="text-xl font-bold text-slate-900">${escapeHtml(plan.name)}</h3>
            <p class="text-xs text-slate-500 mt-1 min-h-[32px]">${escapeHtml(plan.bestFor)}</p>

            <div class="my-4 pb-4 border-b border-slate-100">
              <span class="text-2xl sm:text-3xl font-extrabold text-brand-600">${formatVND(plan.pricePerMonth)}</span>
              <span class="text-xs text-slate-500">/tháng</span>
            </div>

            <div class="space-y-2 text-xs sm:text-sm text-slate-700 mb-6">
              <div>Dung lượng: <strong>${escapeHtml(plan.storage)}</strong></div>
              <div>Băng thông: <strong>${escapeHtml(plan.bandwidth)}</strong></div>
              <div>Chịu tải: <strong>~${plan.recommendedVisits.toLocaleString('vi-VN')} lượt/tháng</strong></div>
              <ul class="pt-2 space-y-1 text-xs text-slate-600 list-disc list-inside">
                ${plan.features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
              </ul>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              data-buy-plan-id="${plan.id}"
              class="btn-buy-now py-2.5 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-bold transition-all"
            >
              Mua Ngay
            </button>
            <button
              type="button"
              data-lead-plan-name="${escapeHtml(plan.name)}"
              class="btn-open-lead py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold transition-all"
            >
              Tư Vấn
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  if (domainGrid && window.DOMAIN_PRICING) {
    domainGrid.innerHTML = window.DOMAIN_PRICING.map(
      (d) => `
        <div class="bg-white rounded-xl border border-slate-200 p-4">
          <div class="text-lg font-extrabold text-brand-700">${escapeHtml(d.extension)}</div>
          <div class="text-sm font-bold text-slate-900 mt-0.5">${formatVND(d.price)}<span class="text-xs font-normal text-slate-500">/năm</span></div>
          <div class="text-xs text-slate-500 mt-1">${escapeHtml(d.description)}</div>
        </div>
      `
    ).join('');
  }
}

/**
 * Render 05 câu hỏi thường gặp dạng Accordion (Yêu cầu 5 của Đề 1)
 */
function renderFAQAccordion() {
  const container = document.getElementById('faq-container');
  if (!container || !Array.isArray(window.FAQ_DATA)) return;

  container.innerHTML = window.FAQ_DATA.map((item, idx) => {
    const isOpen = idx === 0;
    return `
      <div class="faq-item ${isOpen ? 'is-open' : ''} rounded-2xl border border-slate-200 bg-white overflow-hidden transition-all">
        <button
          type="button"
          class="faq-trigger w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
          aria-expanded="${isOpen ? 'true' : 'false'}"
        >
          <span class="font-semibold text-sm sm:text-base text-slate-900">${escapeHtml(item.question)}</span>
          <span class="faq-indicator text-xs font-bold text-brand-600 uppercase shrink-0">${isOpen ? 'Thu gọn' : 'Mở rộng'}</span>
        </button>
        <div class="faq-content-wrapper">
          <div class="faq-content-inner">
            <div class="px-5 pb-4 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
              ${escapeHtml(item.answer)}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.addEventListener('click', (event) => {
    const trigger = event.target.closest('.faq-trigger');
    if (!trigger) return;
    const item = trigger.closest('.faq-item');
    const wasOpen = item.classList.contains('is-open');

    container.querySelectorAll('.faq-item').forEach((el) => {
      el.classList.remove('is-open');
      const btn = el.querySelector('.faq-trigger');
      const ind = el.querySelector('.faq-indicator');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      if (ind) ind.textContent = 'Mở rộng';
    });

    if (!wasOpen) {
      item.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      const ind = item.querySelector('.faq-indicator');
      if (ind) ind.textContent = 'Thu gọn';
    }
  });
}

// =========================================================
// 3. QUẢN LÝ AUTH KHÁCH HÀNG (ĐĂNG NHẬP / ĐĂNG KÝ / JWT)
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
    if (greeting) {
      greeting.textContent = `Chào, ${currentAuthUser.fullName}`;
    }

    // Chỉ tài khoản Admin hoặc Staff mới nhìn thấy nút Cổng Quản Trị
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
    if (!res.ok) {
      currentAuthToken = '';
      currentAuthUser = null;
      localStorage.removeItem('ha_token');
    } else {
      const data = await res.json();
      currentAuthUser = data.user;
    }
  } catch (err) {
    console.warn('Không kiểm tra được phiên đăng nhập:', err.message);
  }
  updateNavbarAuthUI();
}

function openAuthModal(defaultTab = 'login') {
  const modal = document.getElementById('auth-modal');
  const tabLogin = document.getElementById('tab-auth-login');
  const tabReg = document.getElementById('tab-auth-register');
  const formLogin = document.getElementById('login-form');
  const formReg = document.getElementById('register-form');
  const demoHint = document.getElementById('demo-customer-hint');
  const title = document.getElementById('auth-modal-title');

  if (!modal) return;
  modal.classList.remove('hidden');

  if (defaultTab === 'register') {
    formLogin.classList.add('hidden');
    formReg.classList.remove('hidden');
    demoHint?.classList.add('hidden');
    title.textContent = 'Đăng Ký Tài Khoản Khách Hàng';
    tabReg.className = 'py-2 text-xs sm:text-sm font-semibold rounded-lg bg-white text-brand-700 shadow-2xs';
    tabLogin.className = 'py-2 text-xs sm:text-sm font-semibold rounded-lg text-slate-600 hover:text-slate-900';
  } else {
    formLogin.classList.remove('hidden');
    formReg.classList.add('hidden');
    demoHint?.classList.remove('hidden');
    title.textContent = 'Đăng Nhập Hệ Thống';
    tabLogin.className = 'py-2 text-xs sm:text-sm font-semibold rounded-lg bg-white text-brand-700 shadow-2xs';
    tabReg.className = 'py-2 text-xs sm:text-sm font-semibold rounded-lg text-slate-600 hover:text-slate-900';
  }
}

function closeAuthModal() {
  document.getElementById('auth-modal')?.classList.add('hidden');
}

function initAuthModal() {
  const openBtn = document.getElementById('btn-open-auth');
  const closeBtn = document.getElementById('btn-close-auth');
  const logoutBtn = document.getElementById('btn-user-logout');
  const tabLogin = document.getElementById('tab-auth-login');
  const tabReg = document.getElementById('tab-auth-register');
  const fillDemoBtn = document.getElementById('btn-fill-demo-customer');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');

  openBtn?.addEventListener('click', () => openAuthModal('login'));
  closeBtn?.addEventListener('click', closeAuthModal);
  tabLogin?.addEventListener('click', () => openAuthModal('login'));
  tabReg?.addEventListener('click', () => openAuthModal('register'));

  fillDemoBtn?.addEventListener('click', () => {
    document.getElementById('login-username').value = 'hoangyen';
    document.getElementById('login-password').value = '123456@password';
  });

  logoutBtn?.addEventListener('click', () => {
    currentAuthToken = '';
    currentAuthUser = null;
    localStorage.removeItem('ha_token');
    localStorage.removeItem('ha_admin_token');
    updateNavbarAuthUI();
  });

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.classList.add('hidden');

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        loginError.textContent = data.error || 'Đăng nhập không thành công';
        loginError.classList.remove('hidden');
        return;
      }

      currentAuthToken = data.token;
      currentAuthUser = data.user;
      localStorage.setItem('ha_token', currentAuthToken);
      updateNavbarAuthUI();
      closeAuthModal();

      if (pendingCheckoutPlanId) {
        const planToOpen = pendingCheckoutPlanId;
        pendingCheckoutPlanId = null;
        openCheckoutModal(planToOpen);
      }
    } catch (err) {
      loginError.textContent = 'Lỗi kết nối máy chủ khi đăng nhập';
      loginError.classList.remove('hidden');
    }
  });

  registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    registerError.classList.add('hidden');

    const fullName = document.getElementById('reg-fullname').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, username, phone, email, password })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        registerError.textContent = data.error || 'Không thể đăng ký tài khoản';
        registerError.classList.remove('hidden');
        return;
      }

      currentAuthToken = data.token;
      currentAuthUser = data.user;
      localStorage.setItem('ha_token', currentAuthToken);
      updateNavbarAuthUI();
      closeAuthModal();

      if (pendingCheckoutPlanId) {
        const planToOpen = pendingCheckoutPlanId;
        pendingCheckoutPlanId = null;
        openCheckoutModal(planToOpen);
      }
    } catch (err) {
      registerError.textContent = 'Lỗi kết nối máy chủ khi đăng ký';
      registerError.classList.remove('hidden');
    }
  });
}

// =========================================================
// 4. MODAL ĐẶT MUA E-COMMERCE, COUPON, VIETQR & HÓA ĐƠN (PROMPT 5)
// =========================================================

/**
 * Lưu đồng thời thông tin khách đặt mua / tư vấn vào localStorage ("leads") chuẩn Đề 1
 */
function saveLeadToLocalStorage(leadObj) {
  try {
    const raw = localStorage.getItem('leads');
    const list = raw ? JSON.parse(raw) : [];
    const safeList = Array.isArray(list) ? list : [];
    safeList.unshift(leadObj);
    localStorage.setItem('leads', JSON.stringify(safeList));
  } catch (err) {
    console.warn('Không thể ghi localStorage:', err.message);
  }
}

function renderCheckoutAddons() {
  const listEl = document.getElementById('checkout-addons-list');
  if (!listEl || !window.ADDONS_DATA) return;

  listEl.innerHTML = window.ADDONS_DATA.map((addon) => {
    const checked = checkoutState.selectedAddons.includes(addon.id);
    return `
      <label class="flex items-start justify-between gap-3 p-3 rounded-xl border ${checked ? 'border-brand-600 bg-brand-50/40' : 'border-slate-200 bg-white'} cursor-pointer hover:border-brand-500 transition-all">
        <div class="flex items-start gap-2.5">
          <input
            type="checkbox"
            value="${addon.id}"
            ${checked ? 'checked' : ''}
            class="checkout-addon-checkbox mt-1 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <div>
            <div class="text-xs sm:text-sm font-semibold text-slate-900">${escapeHtml(addon.name)}</div>
            <div class="text-xs text-slate-500">${escapeHtml(addon.description)}</div>
          </div>
        </div>
        <span class="shrink-0 text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md">
          +${escapeHtml(addon.unitLabel)}
        </span>
      </label>
    `;
  }).join('');
}

function refreshCheckoutSummary() {
  const plan = (window.PLANS_DATA || []).find((p) => p.id === checkoutState.planId) || window.PLANS_DATA[2];
  if (!plan) return;

  const orderCode = checkoutState.createdOrder?.id || 'ORD-2026-NEW';
  const calc = calculateCartTotal(
    plan.pricePerMonth,
    checkoutState.cycleMonths,
    checkoutState.domainExtension,
    plan.freeDomain,
    checkoutState.selectedAddons,
    checkoutState.discountAmount,
    checkoutState.desiredDomain,
    orderCode
  );

  document.getElementById('checkout-plan-title').textContent = `${plan.name} (${formatVND(plan.pricePerMonth)}/tháng)`;

  const freeBadge = document.getElementById('checkout-free-domain-badge');
  if (freeBadge) {
    if (plan.freeDomain) {
      freeBadge.textContent = 'Gói tặng miễn phí tên miền năm đầu';
      freeBadge.className = 'text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full';
    } else {
      freeBadge.textContent = 'Tính phí theo đuôi tên miền';
      freeBadge.className = 'text-xs font-medium text-slate-600 bg-slate-200 px-2.5 py-0.5 rounded-full';
    }
  }

  const discountLabel = calc.cycleDiscountRatio > 0 ? ` (-${calc.cycleDiscountRatio * 100}%)` : '';
  document.getElementById('summary-hosting-label').textContent = `Gói ${plan.name} (${calc.cycle} tháng${discountLabel}):`;
  document.getElementById('summary-hosting-price').textContent = formatVND(calc.hostingTotal);

  const cleanDomain = String(checkoutState.desiredDomain || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (cleanDomain) {
    document.getElementById('summary-domain-label').textContent = `Tên miền (${cleanDomain}${checkoutState.domainExtension}):`;
    document.getElementById('summary-domain-price').textContent = plan.freeDomain ? '0đ (Tặng năm đầu)' : formatVND(calc.domainTotal);
  } else {
    document.getElementById('summary-domain-label').textContent = 'Tên miền đi kèm (Không chọn):';
    document.getElementById('summary-domain-price').textContent = '0đ';
  }

  document.getElementById('summary-addons-price').textContent = formatVND(calc.addonsTotal);
  document.getElementById('summary-discount-label').textContent = checkoutState.couponCode
    ? `Mã giảm giá (${checkoutState.couponCode}):`
    : 'Mã giảm giá Coupon:';
  document.getElementById('summary-discount-price').textContent = `-${formatVND(calc.discountAmount)}`;
  document.getElementById('summary-total-price').textContent = formatVND(calc.finalTotal);

  const qrImg = document.getElementById('checkout-qr-img');
  if (qrImg) {
    qrImg.src = checkoutState.createdOrder?.qrUrl || calc.qrUrl;
  }

  const codeBadge = document.getElementById('checkout-order-code-badge');
  if (codeBadge) {
    const bId = window.APP_CONFIG?.BANK_ID || 'MB';
    const aNo = window.APP_CONFIG?.ACCOUNT_NO || '0988123456';
    const aName = window.APP_CONFIG?.ACCOUNT_NAME || 'HOSTING ADVISOR CORP';
    codeBadge.innerHTML = checkoutState.createdOrder
      ? `<div>NH: <strong>${escapeHtml(bId)}</strong> • STK: <strong>${escapeHtml(aNo)}</strong> (${escapeHtml(aName)})</div><div class="mt-0.5 text-brand-700">Mã đơn: ${escapeHtml(checkoutState.createdOrder.id)} | Số tiền: ${formatVND(checkoutState.createdOrder.totalAmount)}</div>`
      : `<div>NH: <strong>${escapeHtml(bId)}</strong> • STK: <strong>${escapeHtml(aNo)}</strong> (${escapeHtml(aName)})</div><div class="mt-0.5">Số tiền QR: ${formatVND(calc.finalTotal)}</div>`;
  }
}

function openCheckoutModal(planId) {
  loadDynamicCatalog().then(() => refreshCheckoutSummary());
  const desiredFromForm = document.getElementById('desiredDomain')?.value.trim() || '';
  const extFromForm = document.getElementById('preferredExtension')?.value || '.vn';

  checkoutState = {
    planId: planId || 'business',
    cycleMonths: 12,
    desiredDomain: desiredFromForm,
    domainExtension: extFromForm,
    selectedAddons: [],
    couponCode: '',
    discountAmount: 0,
    createdOrder: null
  };

  let savedBuyer = {};
  try {
    savedBuyer = JSON.parse(localStorage.getItem('ha_last_buyer') || '{}') || {};
  } catch (e) {
    savedBuyer = {};
  }

  const custNameInput = document.getElementById('checkout-cust-name');
  const custPhoneInput = document.getElementById('checkout-cust-phone');
  const custEmailInput = document.getElementById('checkout-cust-email');

  if (custNameInput) custNameInput.value = currentAuthUser?.fullName || savedBuyer.name || '';
  if (custPhoneInput) custPhoneInput.value = currentAuthUser?.phone || savedBuyer.phone || '';
  if (custEmailInput) custEmailInput.value = currentAuthUser?.email || savedBuyer.email || '';

  document.getElementById('checkout-domain-name').value = checkoutState.desiredDomain;
  document.getElementById('checkout-domain-ext').value = checkoutState.domainExtension;
  document.getElementById('checkout-coupon-input').value = '';
  document.getElementById('checkout-coupon-msg')?.classList.add('hidden');
  document.getElementById('checkout-status-msg')?.classList.add('hidden');

  document.getElementById('btn-create-order')?.classList.remove('hidden');
  document.getElementById('btn-confirm-paid')?.classList.add('hidden');
  document.getElementById('btn-checkout-view-invoice')?.classList.add('hidden');

  document.querySelectorAll('.cycle-btn').forEach((btn) => {
    btn.classList.toggle('is-active', Number(btn.getAttribute('data-cycle')) === 12);
  });

  renderCheckoutAddons();
  refreshCheckoutSummary();

  document.getElementById('checkout-modal')?.classList.remove('hidden');
}

function initCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  const closeBtn = document.getElementById('btn-close-checkout');
  const domainInput = document.getElementById('checkout-domain-name');
  const domainExt = document.getElementById('checkout-domain-ext');
  const addonsContainer = document.getElementById('checkout-addons-list');
  const couponInput = document.getElementById('checkout-coupon-input');
  const applyCouponBtn = document.getElementById('btn-apply-coupon');
  const couponMsg = document.getElementById('checkout-coupon-msg');
  const createOrderBtn = document.getElementById('btn-create-order');
  const confirmPaidBtn = document.getElementById('btn-confirm-paid');
  const viewInvoiceBtn = document.getElementById('btn-checkout-view-invoice');
  const statusMsg = document.getElementById('checkout-status-msg');

  closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));

  // Lắng nghe nút ".btn-buy-now" trên toàn trang
  document.addEventListener('click', (event) => {
    const buyBtn = event.target.closest('.btn-buy-now');
    if (!buyBtn) return;
    const planId = buyBtn.getAttribute('data-buy-plan-id') || 'business';
    openCheckoutModal(planId);
  });

  // Chọn chu kỳ 12 / 24 / 36 tháng
  document.querySelectorAll('.cycle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      checkoutState.cycleMonths = Number(btn.getAttribute('data-cycle')) || 12;
      checkoutState.discountAmount = 0;
      checkoutState.couponCode = '';
      couponMsg?.classList.add('hidden');
      document.querySelectorAll('.cycle-btn').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      refreshCheckoutSummary();
    });
  });

  domainInput?.addEventListener('input', () => {
    checkoutState.desiredDomain = domainInput.value.trim();
    refreshCheckoutSummary();
  });

  domainExt?.addEventListener('change', () => {
    checkoutState.domainExtension = domainExt.value;
    refreshCheckoutSummary();
  });

  addonsContainer?.addEventListener('change', (event) => {
    const cb = event.target.closest('.checkout-addon-checkbox');
    if (!cb) return;
    const id = cb.value;
    if (cb.checked) {
      if (!checkoutState.selectedAddons.includes(id)) checkoutState.selectedAddons.push(id);
    } else {
      checkoutState.selectedAddons = checkoutState.selectedAddons.filter((x) => x !== id);
    }
    renderCheckoutAddons();
    refreshCheckoutSummary();
  });

  // Áp dụng mã giảm giá Coupon (/api/coupons/validate)
  applyCouponBtn?.addEventListener('click', async () => {
    const code = couponInput.value.trim();
    const plan = (window.PLANS_DATA || []).find((p) => p.id === checkoutState.planId) || window.PLANS_DATA[2];
    const preCalc = calculateCartTotal(
      plan.pricePerMonth,
      checkoutState.cycleMonths,
      checkoutState.domainExtension,
      plan.freeDomain,
      checkoutState.selectedAddons,
      0,
      checkoutState.desiredDomain
    );

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, rawTotal: preCalc.subTotal })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        checkoutState.couponCode = '';
        checkoutState.discountAmount = 0;
        couponMsg.textContent = data.error || 'Mã giảm giá không hợp lệ';
        couponMsg.className = 'text-xs font-medium mt-2 text-red-600';
        couponMsg.classList.remove('hidden');
        refreshCheckoutSummary();
        return;
      }

      checkoutState.couponCode = data.code;
      checkoutState.discountAmount = data.discountAmount;
      couponMsg.textContent = `Áp dụng mã ${data.code} thành công: Giảm ${formatVND(data.discountAmount)} (${data.description})`;
      couponMsg.className = 'text-xs font-semibold mt-2 text-emerald-700';
      couponMsg.classList.remove('hidden');
      refreshCheckoutSummary();
    } catch (err) {
      couponMsg.textContent = 'Lỗi kết nối máy chủ khi kiểm tra mã giảm giá';
      couponMsg.className = 'text-xs font-medium mt-2 text-red-600';
      couponMsg.classList.remove('hidden');
    }
  });

  // Bước 1: Tạo đơn hàng trên Server (POST /api/orders)
  createOrderBtn?.addEventListener('click', async () => {
    const custName = document.getElementById('checkout-cust-name')?.value.trim() || '';
    const custPhone = document.getElementById('checkout-cust-phone')?.value.trim() || '';
    const custEmail = document.getElementById('checkout-cust-email')?.value.trim() || '';

    if (!custName || !custPhone) {
      statusMsg.textContent = 'Vui lòng nhập đầy đủ Họ và tên và Số điện thoại người mua.';
      statusMsg.className = 'mt-3 rounded-xl p-3 text-xs font-medium bg-red-50 border border-red-200 text-red-700';
      statusMsg.classList.remove('hidden');
      return;
    }

    createOrderBtn.disabled = true;
    createOrderBtn.textContent = 'Đang khởi tạo đơn hàng...';

    try {
      const bestReason = lastAIAdvice?.best?.reason || '';
      const domainAdvice = lastAIAdvice?.domainAdvice || '';

      const headers = { 'Content-Type': 'application/json' };
      if (currentAuthToken) {
        headers.Authorization = `Bearer ${currentAuthToken}`;
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerName: custName,
          phone: custPhone,
          email: custEmail,
          planChosen: checkoutState.planId,
          desiredDomain: checkoutState.desiredDomain,
          domainExtension: checkoutState.domainExtension,
          billingCycleMonths: checkoutState.cycleMonths,
          selectedAddons: checkoutState.selectedAddons,
          couponCode: checkoutState.couponCode,
          needs: currentUserNeeds,
          aiReason: bestReason,
          aiDomainAdvice: domainAdvice
        })
      });

      const data = await res.json();
      createOrderBtn.disabled = false;
      createOrderBtn.textContent = '1. Xác Nhận Đặt Đơn & Lấy Mã Đơn Hàng';

      if (!res.ok || !data.ok) {
        statusMsg.textContent = data.error || 'Không thể khởi tạo đơn hàng';
        statusMsg.className = 'mt-3 rounded-xl p-3 text-xs font-medium bg-red-50 border border-red-200 text-red-700';
        statusMsg.classList.remove('hidden');
        return;
      }

      checkoutState.createdOrder = data.order;
      localStorage.setItem(
        'ha_last_buyer',
        JSON.stringify({ name: custName, phone: custPhone, email: custEmail })
      );

      // Lưu đồng thời vào localStorage ("leads") chuẩn Đề 1
      saveLeadToLocalStorage({
        id: data.order.id,
        name: data.order.customerName,
        phone: data.order.phone,
        planChosen: data.order.planName,
        needs: currentUserNeeds,
        createdAt: data.order.createdAt
      });

      refreshCheckoutSummary();

      statusMsg.textContent = `Đã tiếp nhận đơn hàng ${data.order.id} lên hệ thống! Bấm tiếp nút màu xanh lá bên dưới để xác nhận hoàn tất đơn và nhận IP Hosting ngay (không cần chuyển khoản thật).`;
      statusMsg.className = 'mt-3 rounded-xl p-3 text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-800';
      statusMsg.classList.remove('hidden');

      createOrderBtn.classList.add('hidden');
      confirmPaidBtn.classList.remove('hidden');
      viewInvoiceBtn.classList.remove('hidden');
    } catch (err) {
      createOrderBtn.disabled = false;
      createOrderBtn.textContent = '1. Xác Nhận Đặt Đơn & Lấy Mã Đơn Hàng';
      statusMsg.textContent = 'Lỗi kết nối máy chủ khi tạo đơn';
      statusMsg.className = 'mt-3 rounded-xl p-3 text-xs font-medium bg-red-50 border border-red-200 text-red-700';
      statusMsg.classList.remove('hidden');
    }
  });

  // Bước 2: Khách bấm xác nhận thanh toán -> Tự động kích hoạt đơn & cấp IP ngay lập tức
  confirmPaidBtn?.addEventListener('click', async () => {
    if (!checkoutState.createdOrder) return;
    confirmPaidBtn.disabled = true;
    confirmPaidBtn.textContent = 'Đang kích hoạt đơn hàng...';

    try {
      const headers = {};
      if (currentAuthToken) headers.Authorization = `Bearer ${currentAuthToken}`;
      const res = await fetch(`/api/orders/${checkoutState.createdOrder.id}/confirm-payment`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      confirmPaidBtn.disabled = false;
      confirmPaidBtn.textContent = 'Đã Xác Nhận & Kích Hoạt Thành Công';

      if (res.ok && data.ok) {
        checkoutState.createdOrder = data.order;
        confirmPaidBtn.classList.add('hidden');
        const ipText = data.order.serviceDetails?.hostingIp ? ` | Đã cấp IP Hosting: ${data.order.serviceDetails.hostingIp}` : '';
        statusMsg.textContent = `Hoàn tất đơn hàng ${data.order.id} (ĐÃ THANH TOÁN)${ipText}! Bạn có thể bấm nút bên dưới để xem & in Hóa đơn Điện tử.`;
        statusMsg.className = 'mt-3 rounded-xl p-3 text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800';
        statusMsg.classList.remove('hidden');
      }
    } catch (err) {
      confirmPaidBtn.disabled = false;
      confirmPaidBtn.textContent = '2. Tôi Đã Chuyển Khoản Thành Công';
    }
  });

  viewInvoiceBtn?.addEventListener('click', () => {
    if (checkoutState.createdOrder) {
      openInvoiceModal(checkoutState.createdOrder);
    }
  });
}

// =========================================================
// 5. MODAL HÓA ĐƠN ĐIỆN TỬ (E-INVOICE) & ĐƠN HÀNG CỦA TÔI
// =========================================================

function openInvoiceModal(order) {
  const modal = document.getElementById('invoice-modal');
  const content = document.getElementById('invoice-content-area');
  if (!modal || !content || !order) return;

  const invoiceId = order.invoiceId || String(order.id || 'ORD-2026-001').replace('ORD-', 'INV-');
  const isPaid = order.paymentStatus === 'paid' || order.status === 'completed';
  const createdDateStr = order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN') : '';

  const foundPlan = (window.PLANS_DATA || []).find((p) => p.id === order.planId || p.name === order.planName);
  const cycleMonths = Number(order.billingCycleMonths) || 12;
  const hostingLineTotal =
    Number(order.hostingAmount ?? order.hostingCycleTotal) ||
    Math.round(Number(order.planPrice ?? foundPlan?.pricePerMonth ?? 0) * cycleMonths);
  const monthlyUnitPrice =
    Number(order.planPrice ?? foundPlan?.pricePerMonth) || Math.round(hostingLineTotal / cycleMonths);

  const domainLineTotal = Number(order.domainAmount ?? order.domainPrice ?? 0);
  const isDomainFree = Boolean(order.isDomainFree || (order.domainName && domainLineTotal === 0));
  const computedSubTotal =
    Number(order.subTotal) || Number(order.totalAmount || 0) + Number(order.discountAmount || 0);

  const addonsRows = Array.isArray(order.addons)
    ? order.addons
        .map(
          (a) => `
            <tr class="border-b border-slate-200">
              <td class="py-3 text-slate-800">Dịch vụ cộng thêm: ${escapeHtml(a.name)}</td>
              <td class="py-3 text-center text-slate-600">${cycleMonths} tháng</td>
              <td class="py-3 text-right font-semibold text-slate-900">${formatVND(a.price)}</td>
            </tr>
          `
        )
        .join('')
    : '';

  content.innerHTML = `
    <div class="space-y-5 text-sm">
      <!-- Đầu hóa đơn -->
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b-2 border-slate-900">
        <div>
          <div class="text-xs font-bold uppercase tracking-widest text-brand-700">
            HOSTING ADVISOR CORP (MST: 0109999999)
          </div>
          <h2 class="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
            HÓA ĐƠN DỊCH VỤ ĐIỆN TỬ (ELECTRONIC INVOICE)
          </h2>
          <p class="text-xs text-slate-500 mt-1">
            Mã hóa đơn: <strong class="text-slate-800">${escapeHtml(invoiceId)}</strong> | Mã đơn: <strong class="text-slate-800">${escapeHtml(order.id)}</strong> | Ngày lập: ${escapeHtml(createdDateStr)}
          </p>
        </div>

        <div class="sm:text-right pt-2 sm:pt-0">
          ${
            isPaid
              ? '<span class="invoice-stamp-paid">ĐÃ THANH TOÁN (PAID)</span>'
              : '<span class="invoice-stamp-unpaid">CHỜ THANH TOÁN (UNPAID)</span>'
          }
        </div>
      </div>

      <!-- Thông tin Khách hàng & Đơn vị cung cấp -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs sm:text-sm">
        <div>
          <div class="text-xs font-bold uppercase text-slate-500 mb-1">Khách hàng đăng ký (Buyer):</div>
          <div class="font-bold text-slate-900">${escapeHtml(order.customerName)}</div>
          <div class="text-slate-600">Số điện thoại: ${escapeHtml(order.phone || 'Chưa cập nhật')}</div>
          <div class="text-slate-600">Email: ${escapeHtml(order.email || 'Chưa cập nhật')}</div>
        </div>
        <div>
          <div class="text-xs font-bold uppercase text-slate-500 mb-1">Phương thức &amp; Trạng thái:</div>
          <div class="text-slate-700">Hình thức: <strong>Chuyển khoản Ngân hàng VietQR</strong></div>
          <div class="text-slate-700">Trạng thái đơn: <strong>${isPaid ? 'Đã kích hoạt dịch vụ' : 'Đang chờ xác nhận thanh toán'}</strong></div>
          ${
            order.serviceDetails
              ? `<div class="text-emerald-700 font-semibold mt-0.5">IP Hosting: ${escapeHtml(order.serviceDetails.hostingIp)}</div>`
              : ''
          }
        </div>
      </div>

      <!-- Bảng kê chi tiết các hạng mục -->
      <table class="w-full border-collapse text-xs sm:text-sm">
        <thead>
          <tr class="border-b-2 border-slate-300 text-left text-xs uppercase text-slate-500">
            <th class="py-2.5">Hạng mục dịch vụ</th>
            <th class="py-2.5 text-center">Chu kỳ</th>
            <th class="py-2.5 text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-b border-slate-200">
            <td class="py-3 font-semibold text-slate-900">Gói Hosting ${escapeHtml(order.planName)} (${formatVND(monthlyUnitPrice)}/tháng)</td>
            <td class="py-3 text-center text-slate-600">${cycleMonths} tháng</td>
            <td class="py-3 text-right font-semibold text-slate-900">${formatVND(hostingLineTotal)}</td>
          </tr>
          ${
            order.domainName
              ? `
                <tr class="border-b border-slate-200">
                  <td class="py-3 text-slate-800">Đăng ký Tên miền: <strong>${escapeHtml(order.domainName)}</strong></td>
                  <td class="py-3 text-center text-slate-600">12 tháng</td>
                  <td class="py-3 text-right font-semibold text-slate-900">${isDomainFree ? '0đ (Tặng kèm gói)' : formatVND(domainLineTotal)}</td>
                </tr>
              `
              : ''
          }
          ${addonsRows}
        </tbody>
      </table>

      <!-- Tổng kết tiền -->
      <div class="flex flex-col sm:items-end space-y-1.5 pt-3 border-t border-slate-300 text-xs sm:text-sm">
        <div class="flex justify-between sm:w-72 text-slate-600">
          <span>Tạm tính:</span>
          <span class="font-semibold text-slate-900">${formatVND(computedSubTotal)}</span>
        </div>
        <div class="flex justify-between sm:w-72 text-emerald-700">
          <span>Giảm giá Coupon (${escapeHtml(order.couponApplied || 'Không')}):</span>
          <span class="font-semibold">-${formatVND(order.discountAmount || 0)}</span>
        </div>
        <div class="flex justify-between sm:w-72 text-base font-extrabold text-brand-700 pt-2 border-t border-slate-200">
          <span>TỔNG THANH TOÁN:</span>
          <span>${formatVND(order.totalAmount)}</span>
        </div>
      </div>

      <div class="pt-3 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-2">
        <span>Cam kết hoàn tiền 100% trong 30 ngày | Uptime 99.9%</span>
        <span>Hóa đơn điện tử được khởi tạo tự động từ hệ thống OMS HostingAdvisor.</span>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
}

async function openMyOrdersModal(phoneOverride = '') {
  const modal = document.getElementById('my-orders-modal');
  const container = document.getElementById('my-orders-container');
  const phoneInput = document.getElementById('lookup-order-phone');
  if (!modal || !container) return;

  modal.classList.remove('hidden');

  let savedBuyer = {};
  try {
    savedBuyer = JSON.parse(localStorage.getItem('ha_last_buyer') || '{}') || {};
  } catch (e) {
    savedBuyer = {};
  }

  const lookupPhone = String(phoneOverride || phoneInput?.value || currentAuthUser?.phone || savedBuyer.phone || '').trim();
  if (phoneInput && lookupPhone && !phoneInput.value) {
    phoneInput.value = lookupPhone;
  }

  if (!currentAuthToken && !lookupPhone) {
    container.innerHTML = '<p class="text-sm text-slate-500 py-8 text-center">Nhập Số điện thoại bạn đã dùng khi đặt hàng vào ô bên trên rồi bấm "Tra Cứu Đơn Hàng" (hoặc Đăng nhập tài khoản).</p>';
    return;
  }

  container.innerHTML = '<p class="text-sm text-slate-500 py-6 text-center">Đang tải danh sách đơn hàng...</p>';

  try {
    const headers = {};
    if (currentAuthToken) headers.Authorization = `Bearer ${currentAuthToken}`;
    const url = lookupPhone ? `/api/orders/my-orders?phone=${encodeURIComponent(lookupPhone)}` : '/api/orders/my-orders';

    const res = await fetch(url, { headers });
    const data = await res.json();
    cachedMyOrders = Array.isArray(data.orders) ? data.orders : [];

    if (cachedMyOrders.length === 0) {
      container.innerHTML = '<p class="text-sm text-slate-500 py-8 text-center">Chưa tìm thấy đơn hàng nào khớp với thông tin này. Hãy chọn một gói Hosting để đặt mua nhé!</p>';
      return;
    }

    container.innerHTML = cachedMyOrders
      .map((o) => {
        const isCompleted = o.status === 'completed' || o.paymentStatus === 'paid';
        const isProcessing = o.status === 'paid_processing';
        const badgeHtml = isCompleted
          ? '<span class="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">ĐÃ KÍCH HOẠT (PAID)</span>'
          : isProcessing
          ? '<span class="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">ĐANG CHỜ DUYỆT TIỀN</span>'
          : '<span class="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-full">CHỜ THANH TOÁN VIETQR</span>';

        return `
          <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <span class="font-mono font-bold text-sm text-brand-700">${escapeHtml(o.id)}</span>
                <span class="text-xs text-slate-500 ml-2">${new Date(o.createdAt).toLocaleString('vi-VN')}</span>
              </div>
              ${badgeHtml}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs sm:text-sm">
              <div>
                <div class="text-slate-500 text-xs">Gói dịch vụ &amp; Chu kỳ:</div>
                <div class="font-bold text-slate-900">Gói ${escapeHtml(o.planName)} (${o.billingCycleMonths} tháng)</div>
                <div class="text-slate-600">Tên miền: <strong>${escapeHtml(o.domainName || 'Không kèm tên miền')}</strong></div>
              </div>
              <div>
                <div class="text-slate-500 text-xs">Dịch vụ mua kèm &amp; Ưu đãi:</div>
                <div class="text-slate-700">Add-ons: ${o.addons && o.addons.length ? escapeHtml(o.addons.map((a) => a.name).join(', ')) : 'Không có'}</div>
                <div class="text-emerald-700 font-medium">Mã giảm giá: ${escapeHtml(o.couponApplied || 'Không')} (-${formatVND(o.discountAmount || 0)})</div>
              </div>
              <div class="md:text-right">
                <div class="text-slate-500 text-xs">Tổng thanh toán:</div>
                <div class="text-lg font-extrabold text-brand-700">${formatVND(o.totalAmount)}</div>
              </div>
            </div>

            ${
              o.serviceDetails
                ? `
                  <div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <strong>Thông số kỹ thuật đã cấp:</strong> IP Hosting: <code class="font-mono font-bold">${escapeHtml(o.serviceDetails.hostingIp)}</code> |
                      Nameservers: <code class="font-mono">${escapeHtml((o.serviceDetails.nameServers || []).join(', '))}</code>
                    </div>
                    <span>Hết hạn: ${new Date(o.serviceDetails.expireDate).toLocaleDateString('vi-VN')}</span>
                  </div>
                `
                : ''
            }

            <div class="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                data-invoice-order-id="${escapeHtml(o.id)}"
                class="btn-view-order-invoice py-2 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-all"
              >
                Xem Hóa Đơn (${escapeHtml(o.id.replace('ORD-', 'INV-'))})
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    container.innerHTML = '<p class="text-sm text-red-600 py-6 text-center">Không tải được danh sách đơn hàng.</p>';
  }
}

function initOrdersAndInvoiceModals() {
  const openMyOrdersBtn = document.getElementById('btn-open-my-orders');
  const closeMyOrdersBtn = document.getElementById('btn-close-my-orders');
  const lookupBtn = document.getElementById('btn-lookup-orders');
  const lookupPhoneInput = document.getElementById('lookup-order-phone');
  const myOrdersContainer = document.getElementById('my-orders-container');
  const closeInvoiceBtn = document.getElementById('btn-close-invoice');
  const printInvoiceBtn = document.getElementById('btn-print-invoice');

  openMyOrdersBtn?.addEventListener('click', () => openMyOrdersModal());
  lookupBtn?.addEventListener('click', () => openMyOrdersModal(lookupPhoneInput?.value.trim() || ''));
  closeMyOrdersBtn?.addEventListener('click', () => {
    document.getElementById('my-orders-modal')?.classList.add('hidden');
  });

  myOrdersContainer?.addEventListener('click', (event) => {
    const btn = event.target.closest('.btn-view-order-invoice');
    if (!btn) return;
    const id = btn.getAttribute('data-invoice-order-id');
    const order = cachedMyOrders.find((o) => o.id === id);
    if (order) openInvoiceModal(order);
  });

  closeInvoiceBtn?.addEventListener('click', () => {
    document.getElementById('invoice-modal')?.classList.add('hidden');
  });

  printInvoiceBtn?.addEventListener('click', () => {
    window.print();
  });

  // Cho phép bấm ra vùng tối bên ngoài hoặc bấm phím ESC để đóng nhanh mọi cửa sổ Modal
  ['invoice-modal', 'checkout-modal', 'my-orders-modal', 'auth-modal', 'lead-modal'].forEach((modalId) => {
    const m = document.getElementById(modalId);
    m?.addEventListener('click', (event) => {
      if (event.target === m) {
        m.classList.add('hidden');
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      ['invoice-modal', 'checkout-modal', 'my-orders-modal', 'auth-modal', 'lead-modal'].forEach((modalId) => {
        document.getElementById(modalId)?.classList.add('hidden');
      });
    }
  });
}

// =========================================================
// 6. MODAL ĐĂNG KÝ TƯ VẤN NHANH (LƯU LOCALSTORAGE CHUẨN ĐỀ 1)
// =========================================================

function initLeadModal() {
  const modal = document.getElementById('lead-modal');
  const closeBtn = document.getElementById('btn-close-lead-modal');
  const cancelBtn = document.getElementById('btn-cancel-lead-modal');
  const form = document.getElementById('lead-form');
  const planTitle = document.getElementById('lead-modal-plan-name');
  const planInput = document.getElementById('lead-plan-chosen');
  const nameInput = document.getElementById('lead-name');
  const phoneInput = document.getElementById('lead-phone');
  const errName = document.getElementById('error-lead-name');
  const errPhone = document.getElementById('error-lead-phone');
  const msgBox = document.getElementById('lead-form-message');

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('.btn-open-lead');
    if (!btn) return;
    const planName = btn.getAttribute('data-lead-plan-name') || 'Business';
    planTitle.textContent = planName;
    planInput.value = planName;
    nameInput.value = currentAuthUser?.fullName || '';
    phoneInput.value = currentAuthUser?.phone || '';
    errName.classList.add('hidden');
    errPhone.classList.add('hidden');
    msgBox.classList.add('hidden');
    modal.classList.remove('hidden');
  });

  const closeModal = () => modal?.classList.add('hidden');
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const phoneRegex = /^(0|\+84)\d{9}$/;

    let valid = true;
    if (!name) {
      errName.textContent = 'Vui lòng nhập họ và tên của bạn.';
      errName.classList.remove('hidden');
      valid = false;
    } else {
      errName.classList.add('hidden');
    }

    if (!phoneRegex.test(phone)) {
      errPhone.textContent = 'Số điện thoại không hợp lệ (10 chữ số bắt đầu bằng 0 hoặc +84).';
      errPhone.classList.remove('hidden');
      valid = false;
    } else {
      errPhone.classList.add('hidden');
    }

    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang gửi...';
    }

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          phone: phone,
          recommendedPlan: planInput.value || 'Business',
          siteType: currentUserNeeds?.siteType || '',
          traffic: currentUserNeeds?.traffic || '',
          budget: currentUserNeeds?.budget || 0,
          needDomain: currentUserNeeds?.needDomain || false,
          desiredDomain: currentUserNeeds?.desiredDomain || '',
          preferredExtension: currentUserNeeds?.preferredExtension || '.vn'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Lỗi gửi yêu cầu tư vấn');
      }

      const leadItem = {
        id: data.lead?.id || ('lead_' + Date.now()),
        name,
        phone,
        planChosen: planInput.value || 'Business',
        needs: currentUserNeeds || null,
        createdAt: new Date().toISOString()
      };

      saveLeadToLocalStorage(leadItem);

      msgBox.textContent = `Đăng ký tư vấn gói ${leadItem.planChosen} thành công! Chuyên viên sẽ liên hệ lại qua SĐT ${phone} trong 15 phút.`;
      msgBox.className = 'rounded-xl p-3 text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800';
      msgBox.classList.remove('hidden');

      setTimeout(closeModal, 1500);
    } catch (err) {
      msgBox.textContent = 'Lỗi gửi yêu cầu: ' + err.message;
      msgBox.className = 'rounded-xl p-3 text-xs font-semibold bg-red-50 border border-red-200 text-red-800';
      msgBox.classList.remove('hidden');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Gửi thông tin';
      }
    }
  });
}

// =========================================================
// 7. SỰ KIỆN FORM KHẢO SÁT NHU CẦU AI & BỘ LỌC CATALOG
// =========================================================

function initSurveyFormAndCatalog() {
  const form = document.getElementById('needs-form');
  const siteTypeCards = document.querySelectorAll('.site-type-card');
  const siteTypeRadios = document.querySelectorAll('input[name="siteType"]');
  const trafficSelect = document.getElementById('traffic');
  const budgetInput = document.getElementById('budget');
  const budgetFormatted = document.getElementById('budget-formatted');
  const budgetChips = document.querySelectorAll('.budget-chip');
  const needDomainCheckbox = document.getElementById('needDomain');
  const needDomainBadge = document.getElementById('needDomain-badge');
  const needDomainText = document.getElementById('needDomain-text');
  const desiredDomainRow = document.getElementById('desired-domain-row');
  const desiredDomainInput = document.getElementById('desiredDomain');
  const preferredExtSelect = document.getElementById('preferredExtension');
  const scenarioShopBtn = document.getElementById('btn-scenario-shop');
  const scenarioBlogBtn = document.getElementById('btn-scenario-blog');
  const sectionAIResults = document.getElementById('section-ai-results');
  const aiLoading = document.getElementById('ai-loading');
  const resultsContainer = document.getElementById('results-container');
  const submitBtn = document.getElementById('btn-advise');

  // Bộ lọc danh mục Catalog 6 gói
  document.querySelectorAll('.catalog-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.catalog-filter-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderCatalog(btn.getAttribute('data-catalog-filter') || 'all');
    });
  });

  siteTypeRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      siteTypeCards.forEach((c) => c.classList.remove('is-selected'));
      radio.closest('.site-type-card')?.classList.add('is-selected');
      document.getElementById('error-siteType')?.classList.add('hidden');
    });
  });

  trafficSelect?.addEventListener('change', () => {
    if (trafficSelect.value) document.getElementById('error-traffic')?.classList.add('hidden');
  });

  function syncBudgetUI() {
    const val = Number(budgetInput.value);
    budgetFormatted.textContent = val > 0 ? formatVND(val) : '';
    budgetChips.forEach((chip) => {
      chip.classList.toggle('is-active', Number(chip.getAttribute('data-budget')) === val);
    });
    if (val > 0) document.getElementById('error-budget')?.classList.add('hidden');
  }

  budgetInput?.addEventListener('input', syncBudgetUI);
  budgetChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      budgetInput.value = chip.getAttribute('data-budget');
      syncBudgetUI();
    });
  });

  needDomainCheckbox?.addEventListener('change', () => {
    const checked = needDomainCheckbox.checked;
    needDomainBadge.textContent = checked ? 'Có' : 'Không';
    needDomainText.textContent = checked
      ? 'Có — Ưu tiên các gói tặng miễn phí tên miền năm đầu (.com, .vn, .shop)'
      : 'Không — Bạn đã có sẵn tên miền riêng';
    desiredDomainRow?.classList.toggle('hidden', !checked);
  });

  function applyScenario({ siteType, traffic, budget, needDomain, desiredDomain, ext }) {
    siteTypeRadios.forEach((r) => {
      const matched = r.value === siteType;
      r.checked = matched;
      r.closest('.site-type-card')?.classList.toggle('is-selected', matched);
    });
    trafficSelect.value = traffic;
    budgetInput.value = String(budget);
    syncBudgetUI();
    needDomainCheckbox.checked = needDomain;
    needDomainCheckbox.dispatchEvent(new Event('change'));
    if (desiredDomainInput) desiredDomainInput.value = desiredDomain || '';
    if (preferredExtSelect && ext) preferredExtSelect.value = ext;
    form.requestSubmit();
  }

  scenarioShopBtn?.addEventListener('click', () => {
    applyScenario({
      siteType: 'ban-hang',
      traffic: '1k-10k',
      budget: 150000,
      needDomain: true,
      desiredDomain: 'yenboutique',
      ext: '.vn'
    });
  });

  scenarioBlogBtn?.addEventListener('click', () => {
    applyScenario({
      siteType: 'blog',
      traffic: 'tren-50k',
      budget: 500000,
      needDomain: false,
      desiredDomain: '',
      ext: '.com'
    });
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const checkedSite = document.querySelector('input[name="siteType"]:checked');
    const traffic = trafficSelect.value;
    const budget = Number(budgetInput.value);

    let valid = true;
    const errSite = document.getElementById('error-siteType');
    const errTraffic = document.getElementById('error-traffic');
    const errBudget = document.getElementById('error-budget');

    if (!checkedSite) {
      errSite.textContent = 'Vui lòng chọn loại website bạn muốn làm.';
      errSite.classList.remove('hidden');
      valid = false;
    } else {
      errSite.classList.add('hidden');
    }

    if (!traffic) {
      errTraffic.textContent = 'Vui lòng chọn lượng truy cập ước tính mỗi tháng.';
      errTraffic.classList.remove('hidden');
      valid = false;
    } else {
      errTraffic.classList.add('hidden');
    }

    if (!Number.isFinite(budget) || budget <= 0) {
      errBudget.textContent = 'Vui lòng nhập ngân sách hợp lệ lớn hơn 0 VNĐ.';
      errBudget.classList.remove('hidden');
      valid = false;
    } else {
      errBudget.classList.add('hidden');
    }

    if (!valid) return;

    const needs = {
      siteType: checkedSite.value,
      traffic,
      budget,
      needDomain: needDomainCheckbox.checked,
      desiredDomain: desiredDomainInput?.value.trim() || '',
      preferredExtension: preferredExtSelect?.value || '.vn'
    };

    currentUserNeeds = needs;
    const top3Plans = pickTop3(window.PLANS_DATA, needs);

    sectionAIResults.classList.remove('hidden');
    resultsContainer.innerHTML = '';
    aiLoading.classList.remove('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'AI đang phân tích nhu cầu...';
    sectionAIResults.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const { advice, isFallback } = await getAIAdvice(needs, top3Plans);
    lastAIAdvice = advice;

    aiLoading.classList.add('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Phân Tích Nhu Cầu & Gợi Ý Bằng AI';

    renderAIResults(top3Plans, advice, isFallback, needs);
    const bestId = advice.best?.planId || top3Plans[0].id;
    renderComparisonTable(top3Plans.map((p) => p.id), bestId);
  });
}

async function loadDynamicCatalog() {
  try {
    const res = await fetch('/api/catalog');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.ok) return;

    if (Array.isArray(data.plans) && data.plans.length > 0) {
      window.PLANS_DATA = data.plans;
    }
    if (Array.isArray(data.domain_pricing) && data.domain_pricing.length > 0) {
      window.DOMAIN_PRICING = data.domain_pricing;
    }
    if (Array.isArray(data.addons) && data.addons.length > 0) {
      window.ADDONS_DATA = data.addons;
    }
    if (data.settings) {
      window.APP_CONFIG = {
        ...window.APP_CONFIG,
        BANK_ID: data.settings.bankId || 'MB',
        ACCOUNT_NO: data.settings.accountNo || '0988123456',
        ACCOUNT_NAME: data.settings.accountName || 'HOSTING ADVISOR CORP'
      };
    }
    if (Array.isArray(data.reviews)) {
      renderCustomerReviews(data.reviews);
    }
    if (Array.isArray(data.coupons)) {
      window.COUPONS_DATA = data.coupons;
      renderLiveCoupons(data.coupons);
    }
    renderCatalog('all');
    renderComparisonTable(['business', 'basic', 'shop-pro'], 'business');
  } catch (err) {
    console.warn('Sử dụng danh mục mặc định:', err.message);
  }
}

function renderLiveCoupons(coupons) {
  const banner = document.getElementById('live-coupons-banner');
  const hints = document.getElementById('checkout-coupon-hints');
  if (!Array.isArray(coupons) || coupons.length === 0) {
    if (banner) banner.textContent = 'Hiện chưa có mã ưu đãi công khai.';
    if (hints) hints.innerHTML = 'Không có mã ưu đãi';
    return;
  }

  if (banner) {
    const html = 'Mã ưu đãi: ' + coupons.map(c => {
      const valText = c.type === 'percent' ? `Giảm ${c.value}%` : `Giảm ${Number(c.value).toLocaleString('vi-VN')}đ`;
      return `<strong class="bg-white px-2 py-0.5 rounded border border-brand-300 font-bold">${c.code}</strong> (${valText})`;
    }).join(' | ');
    banner.innerHTML = html;
  }

  if (hints) {
    hints.innerHTML = 'Thử nhập ' + coupons.map(c => `<code class="text-brand-700 font-bold bg-white px-1.5 py-0.5 rounded border border-brand-300 cursor-pointer" onclick="const el=document.getElementById('checkout-coupon-input'); if(el){el.value='${c.code}';}" title="Nhấp để áp dụng mã">${c.code}</code>`).join(' hoặc ');
  }
}

let allReviewsList = [];
let currentReviewsPage = 1;
const REVIEWS_PER_PAGE = 3;

function renderCustomerReviews(reviews, targetPage = null) {
  const container = document.getElementById('reviews-list-container');
  const summaryBar = document.getElementById('reviews-summary-bar');
  const avgBadge = document.getElementById('reviews-avg-badge');
  const totalCountEl = document.getElementById('reviews-total-count');
  const pageIndEl = document.getElementById('reviews-page-indicator');
  const paginationBar = document.getElementById('reviews-pagination-bar');

  if (!container) return;

  if (Array.isArray(reviews)) {
    allReviewsList = reviews;
  }

  if (allReviewsList.length === 0) {
    summaryBar?.classList.add('hidden');
    paginationBar?.classList.add('hidden');
    container.innerHTML = `
      <div class="md:col-span-3 bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
        <div class="text-sm font-bold text-slate-800">Chưa có đánh giá nào trên hệ thống</div>
        <p class="text-xs text-slate-500 mt-1">
          Dữ liệu đánh giá mẫu đã được gỡ bỏ. Hãy là khách hàng đầu tiên gửi nhận xét thực tế ở biểu mẫu bên dưới!
        </p>
      </div>
    `;
    return;
  }

  const totalItems = allReviewsList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / REVIEWS_PER_PAGE));

  if (targetPage !== null) {
    currentReviewsPage = Math.min(totalPages, Math.max(1, Number(targetPage) || 1));
  } else if (currentReviewsPage > totalPages) {
    currentReviewsPage = totalPages;
  }

  // Tính điểm đánh giá trung bình
  const sumRating = allReviewsList.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
  const avgRating = (sumRating / totalItems).toFixed(1);

  if (summaryBar) {
    summaryBar.classList.remove('hidden');
    if (avgBadge) avgBadge.textContent = `Điểm trung bình: ${avgRating} / 5.0`;
    if (totalCountEl) totalCountEl.textContent = `Tổng cộng ${totalItems} đánh giá thực tế`;
    if (pageIndEl) pageIndEl.textContent = `Trang ${currentReviewsPage} / ${totalPages}`;
  }

  const startIdx = (currentReviewsPage - 1) * REVIEWS_PER_PAGE;
  const pageItems = allReviewsList.slice(startIdx, startIdx + REVIEWS_PER_PAGE);

  container.innerHTML = pageItems
    .map((r) => {
      const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '';
      return `
        <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-xs font-bold text-amber-600 uppercase tracking-wide">
                Đánh giá ${Number(r.rating) || 5}/5 — ${escapeHtml(r.planName || 'Gói dịch vụ')}
              </span>
              <span class="text-xs text-slate-400">${escapeHtml(dateStr)}</span>
            </div>
            <p class="text-sm text-slate-700 italic leading-relaxed mb-4 break-words">
              "${escapeHtml(r.comment)}"
            </p>
          </div>
          <div class="pt-3 border-t border-slate-100">
            <div class="font-bold text-sm text-slate-900">${escapeHtml(r.customerName)}</div>
            <div class="text-xs text-slate-500">${escapeHtml(r.businessName || 'Khách hàng xác thực')}</div>
          </div>
        </div>
      `;
    })
    .join('');

  if (paginationBar) {
    if (totalPages <= 1) {
      paginationBar.classList.add('hidden');
      paginationBar.innerHTML = '';
    } else {
      paginationBar.classList.remove('hidden');
      let pageButtonsHtml = '';
      for (let p = 1; p <= totalPages; p++) {
        const isCurrent = p === currentReviewsPage;
        pageButtonsHtml += `
          <button
            type="button"
            data-rev-page="${p}"
            class="btn-rev-page w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
              isCurrent
                ? 'bg-brand-600 text-white shadow-2xs'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
            }"
          >
            ${p}
          </button>
        `;
      }

      paginationBar.innerHTML = `
        <button
          type="button"
          data-rev-page="${currentReviewsPage - 1}"
          ${currentReviewsPage <= 1 ? 'disabled' : ''}
          class="btn-rev-page py-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold text-slate-700 transition-colors"
        >
          Trang trước
        </button>
        <div class="flex flex-wrap items-center gap-1.5">
          ${pageButtonsHtml}
        </div>
        <button
          type="button"
          data-rev-page="${currentReviewsPage + 1}"
          ${currentReviewsPage >= totalPages ? 'disabled' : ''}
          class="btn-rev-page py-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold text-slate-700 transition-colors"
        >
          Trang sau
        </button>
      `;
    }
  }
}

function initCustomerReviewsForm() {
  const form = document.getElementById('customer-review-form');
  const nameInput = document.getElementById('rev-customer-name');
  const bizInput = document.getElementById('rev-business-name');
  const planSelect = document.getElementById('rev-plan-name');
  const ratingSelect = document.getElementById('rev-rating');
  const commentInput = document.getElementById('rev-comment');
  const msgEl = document.getElementById('rev-submit-msg');
  const submitBtn = document.getElementById('btn-submit-review');
  const paginationBar = document.getElementById('reviews-pagination-bar');

  if (nameInput && currentAuthUser?.fullName) {
    nameInput.value = currentAuthUser.fullName;
  }

  paginationBar?.addEventListener('click', (event) => {
    const btn = event.target.closest('.btn-rev-page');
    if (!btn || btn.disabled) return;
    const nextP = Number(btn.getAttribute('data-rev-page'));
    if (Number.isFinite(nextP)) {
      renderCustomerReviews(allReviewsList, nextP);
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const customerName = (nameInput?.value || currentAuthUser?.fullName || '').trim();
    const businessName = (bizInput?.value || '').trim();
    const planName = planSelect?.value || 'Gói Business';
    const rating = Number(ratingSelect?.value) || 5;
    const comment = (commentInput?.value || '').trim();

    if (!customerName || !comment) {
      msgEl.textContent = 'Vui lòng nhập đầy đủ Họ và tên cùng Nội dung nhận xét thực tế.';
      msgEl.className = 'text-xs font-semibold text-red-600';
      msgEl.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang lưu lên Supabase...';
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (currentAuthToken) headers.Authorization = `Bearer ${currentAuthToken}`;

      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers,
        body: JSON.stringify({ customerName, businessName, planName, rating, comment })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        msgEl.textContent = data.error || 'Không gửi được đánh giá.';
        msgEl.className = 'text-xs font-semibold text-red-600';
        msgEl.classList.remove('hidden');
        return;
      }

      msgEl.textContent = 'Cảm ơn bạn! Đánh giá của bạn đã được lưu trực tiếp lên Supabase PostgreSQL.';
      msgEl.className = 'text-xs font-semibold text-emerald-700';
      msgEl.classList.remove('hidden');
      if (commentInput) commentInput.value = '';
      if (bizInput) bizInput.value = '';

      const listRes = await fetch('/api/reviews');
      if (listRes.ok) {
        const listData = await listRes.json();
        renderCustomerReviews(listData.reviews || [], 1);
      }
    } catch (err) {
      msgEl.textContent = 'Lỗi kết nối máy chủ khi gửi đánh giá.';
      msgEl.className = 'text-xs font-semibold text-red-600';
      msgEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Gửi Đánh Giá Lên Hệ Thống';
    }
  });
}

// Khởi chạy toàn bộ ứng dụng khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  restoreAuthSession();
  renderCustomerReviews([]);
  loadDynamicCatalog();
  renderCatalog('all');
  renderComparisonTable(['business', 'basic', 'shop-pro'], 'business');
  renderFAQAccordion();
  initSurveyFormAndCatalog();
  initAuthModal();
  initCheckoutModal();
  initOrdersAndInvoiceModals();
  initLeadModal();
  initCustomerReviewsForm();
});
