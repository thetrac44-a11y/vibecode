/**
 * app.js
 * Điều khiển giao diện và luồng xử lý của HostingAdvisor.
 * Hiện tại (Prompt 1 -> 5 + Supabase):
 * - Validate Form nhu cầu
 * - Chấm điểm rule-based (scorePlans)
 * - Tích hợp Gemini AI (getAIAdvice) + Fallback (buildFallbackReasons)
 * - Hiển thị thẻ kết quả & bảng so sánh
 * - Đăng ký tư vấn: lưu đồng thời vào localStorage và Supabase (bảng leads)
 * - Khu vực quản trị #admin: đăng nhập Supabase Auth, xem danh sách, xóa dòng và xuất CSV
 */

/**
 * Biến lưu nhu cầu hiện tại của người dùng và danh sách khách đang hiển thị ở trang Admin
 */
let currentUserNeeds = null;
let currentAdminLeads = [];
let supabaseClient = null;
let supabaseInitPromise = null;

/**
 * Khởi tạo kết nối Supabase:
 * - Ưu tiên đọc từ file config.js (khi chạy ở máy cá nhân).
 * - Nếu chạy trên Vercel (không có config.js trên Git), tự động lấy từ /api/config.
 */
async function initSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (typeof window.supabase === 'undefined') return null;

  if (
    typeof CONFIG !== 'undefined' &&
    CONFIG.SUPABASE_URL &&
    CONFIG.SUPABASE_ANON_KEY
  ) {
    try {
      supabaseClient = window.supabase.createClient(
        CONFIG.SUPABASE_URL.trim(),
        CONFIG.SUPABASE_ANON_KEY.trim()
      );
      return supabaseClient;
    } catch (err) {
      console.error('Không thể khởi tạo Supabase client từ config.js:', err);
    }
  }

  if (!supabaseInitPromise) {
    supabaseInitPromise = (async () => {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.SUPABASE_URL && data.SUPABASE_ANON_KEY) {
          supabaseClient = window.supabase.createClient(
            String(data.SUPABASE_URL).trim(),
            String(data.SUPABASE_ANON_KEY).trim()
          );
          return supabaseClient;
        }
      } catch (err) {
        // Đang chạy local tĩnh không có /api/config
      }
      return null;
    })();
  }

  return supabaseInitPromise;
}

/**
 * System Prompt chuẩn cho chuyên viên tư vấn AI
 */
const AI_SYSTEM_PROMPT = `Bạn là chuyên viên tư vấn hosting và tên miền thân thiện, đang nói chuyện với chủ shop online nhỏ KHÔNG rành kỹ thuật.

NHIỆM VỤ: Dựa trên nhu cầu khách và 3 gói đã được hệ thống chọn sẵn, viết lời giải thích tại sao mỗi gói phù hợp.

QUY TẮC BẮT BUỘC:
1. Viết tiếng Việt đơn giản, giọng thân thiện, xưng "mình" gọi "bạn".
2. Không dùng thuật ngữ kỹ thuật. Nếu buộc phải nhắc (băng thông, SSL, VPS...), giải thích kèm ví dụ đời thường.
   Ví dụ: "băng thông giống như độ rộng con đường, đường càng rộng thì càng nhiều khách vào cùng lúc mà không kẹt xe".
3. Mỗi lý do dài 2-3 câu, nhắc cụ thể đến ngân sách và lượng khách của người dùng.
4. Chỉ dùng thông tin có trong dữ liệu gói được cung cấp. Tuyệt đối không bịa giá hay tính năng.
5. Nếu giá gói vượt ngân sách, nói thẳng điều đó và nêu lý do vẫn đề xuất.
6. Chỉ trả về JSON hợp lệ, không có chữ nào khác, không dùng \`\`\` .

ĐỊNH DẠNG TRẢ VỀ:
{
  "best": { "planId": "<id>", "reason": "<lời giải thích>" },
  "alternatives": [
    { "planId": "<id>", "reason": "<lời giải thích>" },
    { "planId": "<id>", "reason": "<lời giải thích>" }
  ]
}`;

/**
 * Định dạng số thành tiền Việt Nam cho ô nhập ngân sách (VD: 100000 -> "100.000 VNĐ/tháng")
 */
function formatVND(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  return num.toLocaleString('vi-VN') + ' VNĐ/tháng';
}

/**
 * Định dạng giá gói Hosting theo chuẩn ngắn gọn (VD: 39000 -> "39.000đ")
 */
function formatPlanPrice(price) {
  return Number(price).toLocaleString('vi-VN') + 'đ';
}

/**
 * Chuyển nhãn lượng truy cập sang giá trị đại diện để tính điểm
 */
function getRepresentativeVisits(trafficLabel, fallbackVisits) {
  const map = {
    'Dưới 1.000': 1000,
    '1.000-10.000': 10000,
    '10.000-50.000': 50000,
    'Trên 50.000': 100000,
  };
  return map[trafficLabel] || Number(fallbackVisits) || 1000;
}

/**
 * Chấm điểm các gói dựa trên nhu cầu khách hàng (Rule-based scoring)
 * Trả về mảng 3 gói có điểm cao nhất đã sắp xếp giảm dần
 */
function scorePlans(userNeeds, plans) {
  const visitsNeeded = getRepresentativeVisits(userNeeds.trafficLabel, userNeeds.trafficVisits);
  const budget = Number(userNeeds.budget) || 0;
  const minPlanPrice = Math.min(...plans.map((p) => p.pricePerMonth));

  const scored = plans.map((plan) => {
    let score = 0;

    // 1. Ngân sách: giá <= ngân sách thì +40; vượt ngân sách thì -50 (vượt càng nhiều trừ càng nhiều)
    if (plan.pricePerMonth <= budget) {
      score += 40;
    } else {
      const overAmount = plan.pricePerMonth - budget;
      const overRatio = overAmount / Math.max(budget, 10000);
      const extraPenalty = Math.min(Math.round(overRatio * 20), 120);
      score -= 50 + extraPenalty;

      // Trường hợp biên: ngân sách quá thấp (không gói nào đủ) -> ưu tiên gợi ý gói rẻ nhất
      if (budget < minPlanPrice && plan.pricePerMonth === minPlanPrice) {
        score += 35;
      }
    }

    // 2. Lượng truy cập: maxVisitsPerMonth >= lượng truy cập thì +30; thấp hơn thì -40
    if (plan.maxVisitsPerMonth >= visitsNeeded) {
      score += 30;
    } else {
      score -= 40;
    }

    // 3. Tránh dư thừa: maxVisitsPerMonth lớn hơn nhu cầu hơn 10 lần thì -15
    if (plan.maxVisitsPerMonth > visitsNeeded * 10) {
      score -= 15;
    }

    // 4. Loại website: Bán hàng +15 cho business và shop-pro; Blog/Giới thiệu +10 cho gói < 100.000đ
    if (userNeeds.siteType === 'Bán hàng') {
      if (plan.id === 'business' || plan.id === 'shop-pro') {
        score += 15;
      }
    } else if (userNeeds.siteType === 'Blog' || userNeeds.siteType === 'Giới thiệu') {
      if (plan.pricePerMonth < 100000) {
        score += 10;
      }
    }

    // 5. Tên miền: cần tên miền và gói có freeDomain thì +15
    if (userNeeds.needDomain && plan.freeDomain) {
      score += 15;
    }

    return {
      ...plan,
      _score: score,
      _priceDiff: Math.abs(plan.pricePerMonth - budget),
    };
  });

  // Sắp xếp điểm từ cao xuống thấp; nếu bằng điểm ưu tiên gói gần ngân sách hơn
  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return a._priceDiff - b._priceDiff;
  });

  return scored.slice(0, 3);
}

/**
 * Tạo lời giải thích mẫu bằng tiếng Việt bình dân, dễ hiểu (dùng khi chưa gọi AI hoặc làm Fallback)
 */
function buildFallbackReasons(topPlans, userNeeds) {
  const budgetStr = Number(userNeeds.budget).toLocaleString('vi-VN') + 'đ/tháng';
  const trafficStr = userNeeds.trafficLabel + ' lượt khách/tháng';

  function createReason(plan, index) {
    const priceStr = formatPlanPrice(plan.pricePerMonth) + '/tháng';
    const isOverBudget = plan.pricePerMonth > userNeeds.budget;

    // Câu 1: Đánh giá ngân sách & định vị gói (nói rõ "vượt ngân sách" nếu giá > ngân sách)
    let sentence1 = '';
    if (isOverBudget) {
      sentence1 = `Gói ${plan.name} (${priceStr}) hiện đang vượt ngân sách ${budgetStr} của bạn, nhưng mình vẫn đề xuất vì đây là mức cấu hình tối thiểu cần thiết để website ${userNeeds.siteType.toLowerCase()} hoạt động ổn định và không bị gián đoạn.`;
    } else if (index === 0) {
      sentence1 = `Với ngân sách ${budgetStr}, gói ${plan.name} (${priceStr}) là lựa chọn vừa vặn nhất cho website ${userNeeds.siteType.toLowerCase()} của bạn và giúp tiết kiệm chi phí mỗi tháng.`;
    } else {
      sentence1 = `Gói ${plan.name} có mức giá ${priceStr} nằm gọn trong ngân sách ${budgetStr} của bạn, là phương án dự phòng rất đáng cân nhắc cho nhu cầu làm website ${userNeeds.siteType.toLowerCase()}.`;
    }

    // Câu 2: Giải thích dung lượng, băng thông & lượng khách bằng ví dụ đời thường
    const bandwidthDesc =
      plan.bandwidth === 'Không giới hạn'
        ? 'băng thông không giới hạn (giống như mặt đường rộng thênh thang, nhiều khách vào xem hàng cùng lúc cũng không lo kẹt xe)'
        : `băng thông ${plan.bandwidth} (giống như con đường dẫn khách vào cửa hàng đủ rộng rãi cho lượng khách mỗi ngày)`;

    const sentence2 = `Gói có dung lượng ${plan.storage} như kho chứa ảnh và bài viết rộng rãi, kết hợp ${bandwidthDesc}, đáp ứng tới ${plan.maxVisitsPerMonth.toLocaleString('vi-VN')} lượt khách/tháng đối với nhu cầu ${trafficStr} của bạn.`;

    // Câu 3: Điểm cộng tên miền và bảo mật
    let sentence3 = '';
    if (userNeeds.needDomain && plan.freeDomain) {
      sentence3 = `Đặc biệt, bạn được tặng miễn phí tên miền năm đầu kèm chứng chỉ bảo mật SSL (như chiếc ổ khóa an toàn giúp khách yên tâm giao dịch trên web).`;
    } else {
      sentence3 = `Ngoài ra, gói đã bao gồm các tiện ích thiết yếu như ${plan.features.slice(0, 2).join(', ')} để bạn yên tâm vận hành ngay từ đầu.`;
    }

    return `${sentence1} ${sentence2} ${sentence3}`;
  }

  return {
    best: {
      planId: topPlans[0].id,
      reason: createReason(topPlans[0], 0),
    },
    alternatives: topPlans.slice(1, 3).map((plan, idx) => ({
      planId: plan.id,
      reason: createReason(plan, idx + 1),
    })),
  };
}

/**
 * Làm sạch chuỗi JSON trả về từ AI (loại bỏ ```json và ``` nếu có)
 */
function cleanJsonText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * Kiểm tra và chuẩn hóa dữ liệu JSON trả về từ AI theo đúng thứ tự của scorePlans
 */
function normalizeAIResponse(parsed, cleanPlans) {
  const validIds = new Set(cleanPlans.map((p) => p.id));

  if (
    !parsed ||
    !parsed.best ||
    typeof parsed.best.planId !== 'string' ||
    typeof parsed.best.reason !== 'string' ||
    !Array.isArray(parsed.alternatives) ||
    parsed.alternatives.length < 2
  ) {
    throw new Error('Cấu trúc JSON từ AI không đúng định dạng yêu cầu.');
  }

  const reasonByPlanId = new Map();
  const returnedEntries = [parsed.best, ...parsed.alternatives.slice(0, 2)];

  for (const item of returnedEntries) {
    if (
      !item ||
      !validIds.has(item.planId) ||
      typeof item.reason !== 'string' ||
      !item.reason.trim()
    ) {
      throw new Error(`planId không hợp lệ hoặc thiếu lý do: ${item?.planId}`);
    }
    reasonByPlanId.set(item.planId, item.reason.trim());
  }

  if (reasonByPlanId.size < cleanPlans.length) {
    throw new Error('AI trả về trùng lặp hoặc thiếu gói trong danh sách 3 gói.');
  }

  return {
    best: {
      planId: cleanPlans[0].id,
      reason: reasonByPlanId.get(cleanPlans[0].id),
    },
    alternatives: [
      {
        planId: cleanPlans[1].id,
        reason: reasonByPlanId.get(cleanPlans[1].id),
      },
      {
        planId: cleanPlans[2].id,
        reason: reasonByPlanId.get(cleanPlans[2].id),
      },
    ],
  };
}

/**
 * Gọi AI để sinh lời giải thích cho 3 gói đã chấm điểm:
 * - Ưu tiên gọi vào Serverless Proxy `/api/advice` (giấu kín API key trên Vercel).
 * - Nếu đang chạy tĩnh ở máy local (không có `/api/advice`) và có `CONFIG.GEMINI_API_KEY` thì gọi trực tiếp Gemini API.
 * - Có timeout 15 giây, kiểm tra planId hợp lệ, giữ nguyên thứ tự gói từ scorePlans.
 */
async function getAIAdvice(userNeeds, topPlans) {
  const fallbackAdvice = buildFallbackReasons(topPlans, userNeeds);

  // Trường hợp biên: mất kết nối mạng -> dùng ngay Fallback không cần chờ timeout
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { advice: fallbackAdvice, isFallback: true, reasonCode: 'offline' };
  }

  const cleanPlans = topPlans.map(({ _score, _priceDiff, ...rest }) => rest);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    // 1. Gọi qua Serverless Proxy /api/advice (chuẩn bảo mật khi deploy lên Vercel)
    const proxyRes = await fetch('/api/advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userNeeds, topPlans: cleanPlans }),
      signal: controller.signal,
    });

    if (proxyRes.ok) {
      clearTimeout(timeoutId);
      const parsed = await proxyRes.json();
      const normalizedAdvice = normalizeAIResponse(parsed, cleanPlans);
      return { advice: normalizedAdvice, isFallback: false };
    }

    // 2. Nếu chạy local (Live Server trả về 404/405 cho /api/advice), kiểm tra khóa local trong config.js
    const localApiKey =
      typeof CONFIG !== 'undefined' && CONFIG.GEMINI_API_KEY
        ? String(CONFIG.GEMINI_API_KEY).trim()
        : '';

    if (!localApiKey) {
      throw new Error(`Proxy trả về HTTP ${proxyRes.status} và không có khóa local.`);
    }

    const userMessage = `NHU CẦU KHÁCH:
- Loại website: ${userNeeds.siteType}
- Lượng truy cập ước tính: ${userNeeds.trafficLabel} lượt/tháng
- Ngân sách: ${Number(userNeeds.budget).toLocaleString('vi-VN')} VNĐ/tháng
- Cần mua kèm tên miền: ${userNeeds.needDomain ? 'Có' : 'Không'}

3 GÓI ĐÃ CHỌN (theo thứ tự: gói phù hợp nhất, thay thế 1, thay thế 2):
${JSON.stringify(cleanPlans, null, 2)}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(localApiKey)}`;

    const directRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: AI_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.4,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!directRes.ok) {
      throw new Error(`Gemini API HTTP ${directRes.status}`);
    }

    const resultJson = await directRes.json();
    const rawContent = resultJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(cleanJsonText(rawContent));
    const normalizedAdvice = normalizeAIResponse(parsed, cleanPlans);

    return { advice: normalizedAdvice, isFallback: false };
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn('Chuyển sang chế độ Gợi ý tự động (Fallback):', error.message || error);
    return { advice: fallbackAdvice, isFallback: true };
  }
}

/**
 * Hiển thị thẻ kết quả tư vấn (1 gói phù hợp nhất + 2 gói thay thế)
 */
function renderResults(topPlans, adviceData, isFallback = true, userNeeds = null) {
  const sectionResults = document.getElementById('section-results');
  const container = document.getElementById('results-container');
  const modeBadge = document.getElementById('advice-mode-badge');
  const modeText = document.getElementById('advice-mode-text');
  if (!sectionResults || !container || topPlans.length === 0) return;

  if (modeBadge) {
    modeBadge.classList.toggle('hidden', !isFallback);
    if (modeText) {
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      modeText.textContent = isOffline ? 'Gợi ý tự động (Đang ngoại tuyến)' : 'Gợi ý tự động';
    }
  }

  const budgetVal = Number(userNeeds?.budget || currentUserNeeds?.budget || 0);
  const bestPlan = topPlans[0];
  const isBestOverBudget = budgetVal > 0 && bestPlan.pricePerMonth > budgetVal;
  const bestReason =
    adviceData?.best?.reason || 'Gói phù hợp nhất dựa trên ngân sách và lượng truy cập của bạn.';

  const altPlans = topPlans.slice(1, 3);

  const html = `
    <!-- Thẻ Gói Phù Hợp Nhất (Nổi bật) -->
    <div class="rounded-2xl border-2 border-brand-600 bg-white shadow-md overflow-hidden">
      <div class="bg-brand-600 text-white px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs font-bold uppercase tracking-wider">Gói phù hợp nhất cho bạn</span>
        <div class="flex items-center gap-2">
          ${
            isBestOverBudget
              ? '<span class="text-xs font-semibold bg-amber-500 text-white px-2.5 py-0.5 rounded-full">Vượt ngân sách</span>'
              : ''
          }
          <span class="text-xs font-medium bg-brand-700 px-2.5 py-0.5 rounded-full">${bestPlan.type}</span>
        </div>
      </div>

      <div class="p-5 sm:p-7">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h3 class="text-2xl font-bold text-slate-900">${bestPlan.name}</h3>
            <p class="text-sm text-slate-500 mt-0.5">${bestPlan.bestFor}</p>
          </div>
          <div class="sm:text-right">
            <div class="text-2xl sm:text-3xl font-bold text-brand-700">
              ${formatPlanPrice(bestPlan.pricePerMonth)}
              <span class="text-sm font-normal text-slate-500">/tháng</span>
            </div>
            <div class="text-xs text-slate-500 mt-0.5">
              ${bestPlan.freeDomain ? 'Đã tặng kèm tên miền năm đầu' : 'Chưa bao gồm tên miền'}
            </div>
          </div>
        </div>

        <!-- Lời giải thích từ chuyên viên tư vấn -->
        <div class="my-5 p-4 rounded-xl bg-brand-50/70 border border-brand-200">
          <div class="text-xs font-bold uppercase tracking-wide text-brand-800 mb-1.5">
            Lý do chuyên viên đề xuất gói này:
          </div>
          <p class="text-sm text-slate-700 leading-relaxed">
            ${bestReason}
          </p>
        </div>

        <!-- Tóm tắt thông số chính & Nút đăng ký -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div class="flex flex-wrap gap-2 text-xs font-medium text-slate-700">
            <span class="px-3 py-1.5 rounded-lg bg-slate-100">Dung lượng: ${bestPlan.storage}</span>
            <span class="px-3 py-1.5 rounded-lg bg-slate-100">Băng thông: ${bestPlan.bandwidth}</span>
            <span class="px-3 py-1.5 rounded-lg bg-slate-100">Tối đa: ${bestPlan.maxVisitsPerMonth.toLocaleString('vi-VN')} lượt/tháng</span>
          </div>

          <button
            type="button"
            data-plan-id="${bestPlan.id}"
            data-plan-name="${bestPlan.name}"
            class="btn-open-lead shrink-0 py-2.5 px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-all shadow-sm"
          >
            Đăng ký tư vấn gói ${bestPlan.name}
          </button>
        </div>
      </div>
    </div>

    <!-- 2 Thẻ Phương Án Thay Thế -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      ${altPlans
        .map((plan, idx) => {
          const altReasonObj =
            adviceData?.alternatives?.find((a) => a.planId === plan.id) ||
            adviceData?.alternatives?.[idx];
          const reasonText =
            altReasonObj?.reason || 'Phương án thay thế phù hợp với nhu cầu của bạn.';
          const isAltOverBudget = budgetVal > 0 && plan.pricePerMonth > budgetVal;

          return `
            <div class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span class="text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    Phương án thay thế ${idx + 1}
                  </span>
                  <div class="flex items-center gap-1.5">
                    ${
                      isAltOverBudget
                        ? '<span class="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Vượt ngân sách</span>'
                        : ''
                    }
                    <span class="text-xs font-medium text-slate-500">${plan.type}</span>
                  </div>
                </div>

                <div class="flex items-baseline justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <h4 class="text-lg font-bold text-slate-900">${plan.name}</h4>
                    <p class="text-xs text-slate-500 mt-0.5">${plan.bestFor}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <span class="text-xl font-bold text-slate-900">${formatPlanPrice(plan.pricePerMonth)}</span>
                    <span class="text-xs text-slate-500">/tháng</span>
                  </div>
                </div>

                <div class="my-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div class="text-xs font-semibold text-slate-700 mb-1">Nhận xét:</div>
                  <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">${reasonText}</p>
                </div>
              </div>

              <div class="pt-2">
                <div class="flex flex-wrap gap-1.5 text-xs text-slate-600 mb-4">
                  <span class="px-2.5 py-1 rounded bg-slate-100">${plan.storage}</span>
                  <span class="px-2.5 py-1 rounded bg-slate-100">Băng thông: ${plan.bandwidth}</span>
                  <span class="px-2.5 py-1 rounded bg-slate-100">${plan.maxVisitsPerMonth.toLocaleString('vi-VN')} lượt/tháng</span>
                </div>
                <button
                  type="button"
                  data-plan-id="${plan.id}"
                  data-plan-name="${plan.name}"
                  class="btn-open-lead w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-sm font-semibold transition-all"
                >
                  Đăng ký tư vấn gói ${plan.name}
                </button>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  container.innerHTML = html;
  sectionResults.classList.remove('hidden');
}

/**
 * Hiển thị bảng so sánh đúng 3 gói theo danh sách ID
 */
function renderComparisonTable(planIds, bestId) {
  const container = document.getElementById('comparison-container');
  if (!container || typeof PLANS_DATA === 'undefined') return;

  const selectedPlans = planIds
    .map((id) => PLANS_DATA.find((plan) => plan.id === id))
    .filter(Boolean)
    .slice(0, 3);

  if (selectedPlans.length === 0) {
    container.innerHTML = '<p class="p-6 text-center text-sm text-slate-500">Chưa có dữ liệu gói để so sánh.</p>';
    return;
  }

  const getColClass = (planId, isHeader = false, isFooter = false) => {
    const isBest = planId === bestId;
    if (!isBest) {
      return 'border-l border-slate-200 bg-white';
    }
    let classes = 'border-x-2 border-brand-600 bg-brand-50/30';
    if (isHeader) classes += ' border-t-2';
    if (isFooter) classes += ' border-b-2';
    return classes;
  };

  const html = `
    <div class="table-scroll overflow-x-auto">
      <table class="w-full min-w-[680px] border-collapse text-left text-sm">
        <thead>
          <tr class="border-b border-slate-200">
            <th class="w-1/4 p-4 sm:p-5 bg-slate-50 font-semibold text-slate-700 align-bottom">
              Tiêu chí so sánh
            </th>
            ${selectedPlans
              .map((plan) => {
                const isBest = plan.id === bestId;
                return `
                  <th class="w-1/4 p-4 sm:p-5 align-top ${getColClass(plan.id, true, false)}">
                    <div class="min-h-[28px] mb-1.5">
                      ${
                        isBest
                          ? '<span class="inline-block text-xs font-bold uppercase tracking-wide bg-brand-600 text-white px-2.5 py-0.5 rounded-full">Phù hợp nhất</span>'
                          : '<span class="inline-block text-xs font-medium text-slate-500 px-2 py-0.5 rounded-full bg-slate-100">Phương án thay thế</span>'
                      }
                    </div>
                    <div class="text-lg font-bold text-slate-900">${plan.name}</div>
                    <div class="text-xs font-normal text-slate-500 mt-0.5">${plan.type}</div>
                  </th>
                `;
              })
              .join('')}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          <!-- Hàng 1: Giá / tháng -->
          <tr>
            <td class="p-4 sm:p-5 bg-slate-50/70 font-medium text-slate-700">Giá / tháng</td>
            ${selectedPlans
              .map(
                (plan) => `
                  <td class="p-4 sm:p-5 ${getColClass(plan.id)}">
                    <span class="text-lg font-bold ${plan.id === bestId ? 'text-brand-700' : 'text-slate-900'}">
                      ${formatPlanPrice(plan.pricePerMonth)}
                    </span>
                    <span class="text-xs text-slate-500">/tháng</span>
                  </td>
                `
              )
              .join('')}
          </tr>

          <!-- Hàng 2: Dung lượng -->
          <tr>
            <td class="p-4 sm:p-5 bg-slate-50/70 font-medium text-slate-700">Dung lượng lưu trữ</td>
            ${selectedPlans
              .map(
                (plan) => `
                  <td class="p-4 sm:p-5 font-medium text-slate-800 ${getColClass(plan.id)}">
                    ${plan.storage}
                  </td>
                `
              )
              .join('')}
          </tr>

          <!-- Hàng 3: Băng thông -->
          <tr>
            <td class="p-4 sm:p-5 bg-slate-50/70 font-medium text-slate-700">Băng thông</td>
            ${selectedPlans
              .map(
                (plan) => `
                  <td class="p-4 sm:p-5 text-slate-800 ${getColClass(plan.id)}">
                    ${plan.bandwidth}
                  </td>
                `
              )
              .join('')}
          </tr>

          <!-- Hàng 4: Lượng truy cập đáp ứng -->
          <tr>
            <td class="p-4 sm:p-5 bg-slate-50/70 font-medium text-slate-700">Sức chứa truy cập</td>
            ${selectedPlans
              .map(
                (plan) => `
                  <td class="p-4 sm:p-5 text-slate-800 ${getColClass(plan.id)}">
                    Tối đa ${plan.maxVisitsPerMonth.toLocaleString('vi-VN')} lượt/tháng
                  </td>
                `
              )
              .join('')}
          </tr>

          <!-- Hàng 5: Tặng tên miền -->
          <tr>
            <td class="p-4 sm:p-5 bg-slate-50/70 font-medium text-slate-700">Tặng tên miền</td>
            ${selectedPlans
              .map(
                (plan) => `
                  <td class="p-4 sm:p-5 ${getColClass(plan.id)}">
                    ${
                      plan.freeDomain
                        ? '<span class="inline-block text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">Có tặng năm đầu</span>'
                        : '<span class="inline-block text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">Chưa bao gồm</span>'
                    }
                  </td>
                `
              )
              .join('')}
          </tr>

          <!-- Hàng 6: Tính năng nổi bật -->
          <tr>
            <td class="p-4 sm:p-5 bg-slate-50/70 font-medium text-slate-700 align-top">Tính năng nổi bật</td>
            ${selectedPlans
              .map(
                (plan) => `
                  <td class="p-4 sm:p-5 align-top ${getColClass(plan.id)}">
                    <ul class="space-y-1.5 text-slate-700 text-xs sm:text-sm list-disc list-inside">
                      ${plan.features.map((feat) => `<li>${feat}</li>`).join('')}
                    </ul>
                  </td>
                `
              )
              .join('')}
          </tr>

          <!-- Hàng 7: Phù hợp với -->
          <tr>
            <td class="p-4 sm:p-5 bg-slate-50/70 font-medium text-slate-700">Phù hợp nhất cho</td>
            ${selectedPlans
              .map(
                (plan) => `
                  <td class="p-4 sm:p-5 text-xs sm:text-sm text-slate-600 ${getColClass(plan.id)}">
                    ${plan.bestFor}
                  </td>
                `
              )
              .join('')}
          </tr>

          <!-- Hàng 8: Nút Đăng ký tư vấn -->
          <tr>
            <td class="p-4 sm:p-5 bg-slate-50/70 font-medium text-slate-700">Đăng ký</td>
            ${selectedPlans
              .map((plan) => {
                const isBest = plan.id === bestId;
                return `
                  <td class="p-4 sm:p-5 ${getColClass(plan.id, false, true)}">
                    <button
                      type="button"
                      data-plan-id="${plan.id}"
                      data-plan-name="${plan.name}"
                      class="btn-open-lead w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                        isBest
                          ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                      }"
                    >
                      Đăng ký tư vấn
                    </button>
                  </td>
                `;
              })
              .join('')}
          </tr>
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

/**
 * Hiển thị hoặc ẩn thông báo lỗi đỏ dưới từng trường
 */
function setFieldError(fieldKey, message, inputEl = null) {
  const errorEl = document.getElementById(`error-${fieldKey}`);
  if (!errorEl) return;

  if (message) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    if (inputEl) {
      inputEl.classList.add('border-red-500', 'bg-red-50/30');
      inputEl.classList.remove('border-slate-300');
    }
  } else {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
    if (inputEl) {
      inputEl.classList.remove('border-red-500', 'bg-red-50/30');
      inputEl.classList.add('border-slate-300');
    }
  }
}

/**
 * Kiểm tra toàn bộ dữ liệu Form nhu cầu (Validate)
 */
function validateNeedsForm() {
  let isValid = true;

  const selectedSiteType = document.querySelector('input[name="siteType"]:checked');
  if (!selectedSiteType) {
    setFieldError('siteType', 'Vui lòng chọn loại website bạn muốn làm.');
    isValid = false;
  } else {
    setFieldError('siteType', '');
  }

  const trafficSelect = document.getElementById('traffic');
  const selectedOption = trafficSelect.options[trafficSelect.selectedIndex];
  if (!trafficSelect.value) {
    setFieldError('traffic', 'Vui lòng chọn lượng khách truy cập ước tính mỗi tháng.', trafficSelect);
    isValid = false;
  } else {
    setFieldError('traffic', '', trafficSelect);
  }

  const budgetInput = document.getElementById('budget');
  const rawBudget = budgetInput.value.trim();
  const budgetValue = Number(rawBudget);

  if (rawBudget === '') {
    setFieldError('budget', 'Vui lòng nhập ngân sách dự kiến mỗi tháng.', budgetInput);
    isValid = false;
  } else if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
    setFieldError('budget', 'Ngân sách phải là số lớn hơn 0 VNĐ.', budgetInput);
    isValid = false;
  } else {
    setFieldError('budget', '', budgetInput);
  }

  const needDomainInput = document.getElementById('needDomain');

  if (!isValid) {
    return { isValid: false, data: null };
  }

  const userNeeds = {
    siteType: selectedSiteType.value,
    trafficLabel: trafficSelect.value,
    trafficVisits: Number(selectedOption.getAttribute('data-visits')) || 1000,
    budget: budgetValue,
    needDomain: Boolean(needDomainInput.checked),
  };

  return { isValid: true, data: userNeeds };
}

/**
 * ==========================================
 * QUẢN LÝ ĐĂNG KÝ TƯ VẤN (LOCALSTORAGE + SUPABASE)
 * ==========================================
 */

/**
 * Đọc danh sách khách hàng từ localStorage
 */
function getLocalLeads() {
  try {
    const raw = localStorage.getItem('leads');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

/**
 * Chuẩn hóa số điện thoại về dạng 0xxxxxxxxx để so sánh trùng lặp
 */
function normalizePhone(phone) {
  return String(phone || '').trim().replace(/^\+84/, '0');
}

/**
 * Kiểm tra xem SĐT đã đăng ký cùng gói này trong localStorage chưa
 */
function isDuplicateLead(phone, planChosen) {
  const leads = getLocalLeads();
  const normPhone = normalizePhone(phone);
  return leads.some(
    (item) =>
      normalizePhone(item.phone) === normPhone &&
      String(item.planChosen).toLowerCase() === String(planChosen).toLowerCase()
  );
}

/**
 * Lưu khách hàng:
 * 1. Lưu vào localStorage trước (đúng yêu cầu đề và dự phòng khi mất mạng)
 * 2. Insert lên bảng "leads" của Supabase (không dùng .select() sau insert)
 */
async function saveLead(lead) {
  // 1. Lưu localStorage trước
  const leads = getLocalLeads();
  leads.unshift(lead);
  localStorage.setItem('leads', JSON.stringify(leads));

  // 2. Đồng bộ lên Supabase
  const sb = await initSupabaseClient();
  if (!sb) {
    return { cloud: false };
  }

  try {
    const { error } = await sb.from('leads').insert({
      name: lead.name,
      phone: lead.phone,
      plan_chosen: lead.planChosen,
      needs: lead.needs,
    });
    if (error) throw error;
    return { cloud: true };
  } catch (err) {
    console.error('Supabase lỗi khi lưu lead:', err);
    return { cloud: false };
  }
}

/**
 * Khởi tạo sự kiện đóng/mở và gửi Form Modal Đăng ký tư vấn
 */
function initLeadModal() {
  const modal = document.getElementById('lead-modal');
  const modalPlanName = document.getElementById('modal-plan-name');
  const planChosenInput = document.getElementById('lead-plan-chosen');
  const nameInput = document.getElementById('lead-name');
  const phoneInput = document.getElementById('lead-phone');
  const closeBtn = document.getElementById('btn-close-modal');
  const cancelBtn = document.getElementById('btn-cancel-modal');
  const leadForm = document.getElementById('lead-form');
  const submitLeadBtn = document.getElementById('btn-submit-lead');
  const messageBox = document.getElementById('lead-form-message');

  if (!modal || !leadForm) return;

  function openModal(planName) {
    modalPlanName.textContent = planName;
    planChosenInput.value = planName;
    nameInput.value = '';
    phoneInput.value = '';
    setFieldError('lead-name', '', nameInput);
    setFieldError('lead-phone', '', phoneInput);
    messageBox.classList.add('hidden');
    messageBox.textContent = '';
    modal.classList.remove('hidden');
    setTimeout(() => nameInput.focus(), 50);
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  // Lắng nghe sự kiện click vào bất kỳ nút ".btn-open-lead" nào trên trang
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('.btn-open-lead');
    if (!btn) return;
    const planName = btn.getAttribute('data-plan-name') || 'Business';
    openModal(planName);
  });

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Đóng khi bấm ra vùng nền tối bên ngoài hộp thoại
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  // Đóng khi nhấn phím Escape
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  nameInput.addEventListener('input', () => {
    if (nameInput.value.trim()) setFieldError('lead-name', '', nameInput);
  });

  phoneInput.addEventListener('input', () => {
    if (phoneInput.value.trim()) setFieldError('lead-phone', '', phoneInput);
  });

  leadForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nameVal = nameInput.value.trim();
    const phoneVal = phoneInput.value.trim();
    const planChosen = planChosenInput.value || 'Business';
    const phoneRegex = /^(0|\+84)\d{9}$/;

    let valid = true;

    if (!nameVal) {
      setFieldError('lead-name', 'Vui lòng nhập họ và tên của bạn.', nameInput);
      valid = false;
    } else {
      setFieldError('lead-name', '', nameInput);
    }

    if (!phoneVal) {
      setFieldError('lead-phone', 'Vui lòng nhập số điện thoại liên hệ.', phoneInput);
      valid = false;
    } else if (!phoneRegex.test(phoneVal)) {
      setFieldError(
        'lead-phone',
        'Số điện thoại không hợp lệ (gồm 10 chữ số bắt đầu bằng 0 hoặc +84).',
        phoneInput
      );
      valid = false;
    } else if (isDuplicateLead(phoneVal, planChosen)) {
      setFieldError(
        'lead-phone',
        `Số điện thoại này đã đăng ký tư vấn gói ${planChosen} trước đó.`,
        phoneInput
      );
      valid = false;
    } else {
      setFieldError('lead-phone', '', phoneInput);
    }

    if (!valid) return;

    const newLead = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'lead_' + Date.now(),
      name: nameVal,
      phone: phoneVal,
      planChosen: planChosen,
      needs: currentUserNeeds || null,
      createdAt: new Date().toISOString(),
    };

    submitLeadBtn.disabled = true;
    submitLeadBtn.textContent = 'Đang lưu...';

    await saveLead(newLead);

    submitLeadBtn.disabled = false;
    submitLeadBtn.textContent = 'Gửi thông tin';

    messageBox.className =
      'rounded-xl p-3 text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-800';
    messageBox.textContent = `Đăng ký tư vấn gói ${planChosen} thành công! Chuyên viên sẽ sớm liên hệ với bạn.`;
    messageBox.classList.remove('hidden');

    // Nếu đang mở trang #admin và đã đăng nhập thì cập nhật lại danh sách
    if (window.location.hash === '#admin') {
      loadAdminLeads();
    }

    setTimeout(() => {
      closeModal();
    }, 1200);
  });
}

/**
 * ==========================================
 * KHU VỰC QUẢN TRỊ ẨN (#admin) VỚI SUPABASE AUTH
 * ==========================================
 */

/**
 * Định dạng chuỗi nhu cầu để hiển thị gọn trên bảng Admin
 */
function formatNeedsSummary(needs) {
  if (!needs || typeof needs !== 'object') return 'Chưa chọn nhu cầu';
  const parts = [];
  if (needs.siteType) parts.push(needs.siteType);
  if (needs.trafficLabel) parts.push(`${needs.trafficLabel} lượt/tháng`);
  if (needs.budget) parts.push(`${Number(needs.budget).toLocaleString('vi-VN')}đ`);
  if (typeof needs.needDomain === 'boolean') {
    parts.push(needs.needDomain ? 'Kèm tên miền' : 'Không kèm tên miền');
  }
  return parts.join(' | ') || 'Chưa chọn nhu cầu';
}

/**
 * Render bảng danh sách khách hàng trong khu vực #admin
 */
function renderLeadTable(leads) {
  const tbody = document.getElementById('admin-leads-tbody');
  if (!tbody) return;

  currentAdminLeads = Array.isArray(leads) ? leads : [];

  if (currentAdminLeads.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-6 text-center text-sm text-slate-500">
          Chưa có khách hàng nào đăng ký tư vấn.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = currentAdminLeads
    .map((item) => {
      const createdDate = item.created_at || item.createdAt;
      const timeStr = createdDate
        ? new Date(createdDate).toLocaleString('vi-VN')
        : '';
      const planName = item.plan_chosen || item.planChosen || '';
      const needsStr = formatNeedsSummary(item.needs);

      return `
        <tr class="hover:bg-slate-50">
          <td class="p-3.5 text-xs text-slate-500 whitespace-nowrap">${timeStr}</td>
          <td class="p-3.5 font-medium text-slate-900">${escapeHtml(item.name || '')}</td>
          <td class="p-3.5 font-mono text-slate-700">${escapeHtml(item.phone || '')}</td>
          <td class="p-3.5">
            <span class="inline-block text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-0.5 rounded-md">
              ${escapeHtml(planName)}
            </span>
          </td>
          <td class="p-3.5 text-xs text-slate-600">${escapeHtml(needsStr)}</td>
          <td class="p-3.5 text-right whitespace-nowrap">
            <button
              type="button"
              data-delete-lead-id="${escapeHtml(String(item.id))}"
              class="btn-delete-lead text-xs font-semibold text-red-600 hover:text-red-800 px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 transition-colors"
            >
              Xóa
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

/**
 * Chống XSS cơ bản khi hiển thị tên/SĐT khách nhập
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Tải danh sách khách hàng trên trang #admin (chỉ tải khi đã đăng nhập Supabase)
 */
async function loadAdminLeads() {
  const sb = await initSupabaseClient();
  const loginBox = document.getElementById('admin-login-box');
  const dataBox = document.getElementById('admin-data-box');
  const exportBtn = document.getElementById('btn-export-csv');
  const logoutBtn = document.getElementById('btn-admin-logout');
  const statusNote = document.getElementById('admin-status-note');

  if (!loginBox || !dataBox) return;

  if (!sb) {
    // Chưa cấu hình Supabase -> Giữ ở màn hình đăng nhập, không hiển thị dữ liệu khi chưa đăng nhập
    loginBox.classList.remove('hidden');
    dataBox.classList.add('hidden');
    exportBtn.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    return;
  }

  const { data: sessionData } = await sb.auth.getSession();
  const session = sessionData?.session;

  if (!session) {
    // Chưa đăng nhập thì không hiện dữ liệu gì
    loginBox.classList.remove('hidden');
    dataBox.classList.add('hidden');
    exportBtn.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    document.getElementById('admin-leads-tbody').innerHTML = '';
    return;
  }

  // Đã đăng nhập -> Ẩn form login, tải danh sách từ bảng leads (mới nhất lên đầu)
  loginBox.classList.add('hidden');
  dataBox.classList.remove('hidden');
  exportBtn.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');

  const { data, error } = await sb
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Lỗi tải danh sách từ Supabase:', error);
    statusNote.textContent = 'Không thể tải dữ liệu từ Supabase: ' + error.message;
    renderLeadTable([]);
    return;
  }

  statusNote.textContent = `Đang hiển thị ${data.length} khách hàng từ cơ sở dữ liệu Supabase (tài khoản: ${session.user.email}).`;
  renderLeadTable(data);
}

/**
 * Xóa 1 dòng khách hàng trên Supabase và localStorage
 */
async function deleteLeadById(id) {
  const sb = await initSupabaseClient();
  if (sb) {
    const { error } = await sb.from('leads').delete().eq('id', id);
    if (error) {
      alert('Không thể xóa dòng này trên Supabase: ' + error.message);
      return;
    }
  }

  // Đồng bộ xóa trong localStorage nếu trùng id
  const localLeads = getLocalLeads().filter((item) => String(item.id) !== String(id));
  localStorage.setItem('leads', JSON.stringify(localLeads));

  await loadAdminLeads();
}

/**
 * Xuất danh sách khách hàng hiện tại ra file CSV
 */
function exportLeadsToCSV() {
  if (!currentAdminLeads || currentAdminLeads.length === 0) {
    alert('Chưa có dữ liệu khách hàng để xuất CSV.');
    return;
  }

  const headers = ['ID', 'Thời gian', 'Họ và tên', 'Số điện thoại', 'Gói quan tâm', 'Nhu cầu'];
  const rows = currentAdminLeads.map((item) => {
    const createdDate = item.created_at || item.createdAt || '';
    const planName = item.plan_chosen || item.planChosen || '';
    const needsStr = formatNeedsSummary(item.needs);
    return [
      item.id,
      createdDate,
      item.name,
      item.phone,
      planName,
      needsStr,
    ].map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`);
  });

  const csvContent =
    '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `danh-sach-khach-hang-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Khởi tạo Khu vực quản trị ẩn (#admin)
 */
function initAdminSection() {
  const sectionAdmin = document.getElementById('section-admin');
  const loginForm = document.getElementById('admin-login-form');
  const emailInput = document.getElementById('admin-email');
  const passwordInput = document.getElementById('admin-password');
  const loginError = document.getElementById('admin-login-error');
  const loginBtn = document.getElementById('btn-admin-login');
  const logoutBtn = document.getElementById('btn-admin-logout');
  const exportBtn = document.getElementById('btn-export-csv');

  if (!sectionAdmin) return;

  function syncAdminVisibility() {
    const isAdminHash = window.location.hash === '#admin';
    sectionAdmin.classList.toggle('hidden', !isAdminHash);
    if (isAdminHash) {
      loadAdminLeads();
      sectionAdmin.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  window.addEventListener('hashchange', syncAdminVisibility);
  syncAdminVisibility();

  // Xử lý đăng nhập Supabase Auth
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      loginError.classList.add('hidden');

      const sb = await initSupabaseClient();
      if (!sb) {
        loginError.textContent =
          'Chưa cấu hình SUPABASE_URL và SUPABASE_ANON_KEY trong file config.js hoặc Vercel.';
        loginError.classList.remove('hidden');
        return;
      }

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        loginError.textContent = 'Vui lòng nhập đầy đủ email và mật khẩu quản trị.';
        loginError.classList.remove('hidden');
        return;
      }

      loginBtn.disabled = true;
      loginBtn.textContent = 'Đang đăng nhập...';

      const { error } = await sb.auth.signInWithPassword({ email, password });

      loginBtn.disabled = false;
      loginBtn.textContent = 'Đăng nhập';

      if (error) {
        loginError.textContent = 'Sai email hoặc mật khẩu quản trị.';
        loginError.classList.remove('hidden');
        return;
      }

      passwordInput.value = '';
      await loadAdminLeads();
    });
  }

  // Xử lý đăng xuất
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const sb = await initSupabaseClient();
      if (sb) {
        await sb.auth.signOut();
      }
      currentAdminLeads = [];
      await loadAdminLeads();
    });
  }

  // Xử lý nút Xuất CSV
  if (exportBtn) {
    exportBtn.addEventListener('click', exportLeadsToCSV);
  }

  // Xử lý nút Xóa từng dòng khách hàng
  sectionAdmin.addEventListener('click', (event) => {
    const delBtn = event.target.closest('.btn-delete-lead');
    if (!delBtn) return;
    const leadId = delBtn.getAttribute('data-delete-lead-id');
    if (leadId) {
      deleteLeadById(leadId);
    }
  });
}

/**
 * Khởi tạo các sự kiện tương tác trên Form nhu cầu
 */
function initFormInteractions() {
  const form = document.getElementById('needs-form');
  const submitBtn = document.getElementById('btn-advise');
  const siteTypeCards = document.querySelectorAll('.site-type-card');
  const siteTypeRadios = document.querySelectorAll('input[name="siteType"]');
  const trafficSelect = document.getElementById('traffic');
  const budgetInput = document.getElementById('budget');
  const budgetFormatted = document.getElementById('budget-Formatted');
  const budgetChips = document.querySelectorAll('.budget-chip');
  const needDomainCheckbox = document.getElementById('needDomain');
  const needDomainBadge = document.getElementById('needDomain-badge');
  const needDomainText = document.getElementById('needDomain-text');
  const feedbackBox = document.getElementById('form-feedback');
  const sectionResults = document.getElementById('section-results');
  const aiLoadingBox = document.getElementById('ai-loading');
  const resultsContainer = document.getElementById('results-container');
  const scenarioShopBtn = document.getElementById('btn-scenario-shop');
  const scenarioBlogBtn = document.getElementById('btn-scenario-blog');

  // Hàm điền nhanh kịch bản mẫu vào Form và tự động kích hoạt tư vấn
  function applyPresetScenario({ siteType, traffic, budget, needDomain }) {
    // 1. Chọn loại website
    siteTypeRadios.forEach((radio) => {
      const matched = radio.value === siteType;
      radio.checked = matched;
      const parentCard = radio.closest('.site-type-card');
      if (parentCard) parentCard.classList.toggle('is-selected', matched);
    });
    setFieldError('siteType', '');

    // 2. Chọn lượng truy cập
    trafficSelect.value = traffic;
    setFieldError('traffic', '', trafficSelect);

    // 3. Điền ngân sách
    budgetInput.value = String(budget);
    syncBudgetDisplay();

    // 4. Bật/tắt tên miền
    needDomainCheckbox.checked = Boolean(needDomain);
    needDomainCheckbox.dispatchEvent(new Event('change'));

    // 5. Kích hoạt tư vấn ngay
    form.requestSubmit();
  }

  if (scenarioShopBtn) {
    scenarioShopBtn.addEventListener('click', () => {
      applyPresetScenario({
        siteType: 'Bán hàng',
        traffic: 'Dưới 1.000',
        budget: 100000,
        needDomain: true,
      });
    });
  }

  if (scenarioBlogBtn) {
    scenarioBlogBtn.addEventListener('click', () => {
      applyPresetScenario({
        siteType: 'Blog',
        traffic: 'Trên 50.000',
        budget: 800000,
        needDomain: false,
      });
    });
  }

  siteTypeRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      siteTypeCards.forEach((card) => card.classList.remove('is-selected'));
      const parentCard = radio.closest('.site-type-card');
      if (parentCard) parentCard.classList.add('is-selected');
      setFieldError('siteType', '');
    });
  });

  trafficSelect.addEventListener('change', () => {
    if (trafficSelect.value) {
      setFieldError('traffic', '', trafficSelect);
    }
  });

  function syncBudgetDisplay() {
    const val = Number(budgetInput.value);
    budgetFormatted.textContent = formatVND(val);

    budgetChips.forEach((chip) => {
      const chipVal = Number(chip.getAttribute('data-budget'));
      chip.classList.toggle('is-active', chipVal === val);
    });

    if (budgetInput.value.trim() !== '' && val > 0) {
      setFieldError('budget', '', budgetInput);
    }
  }

  budgetInput.addEventListener('input', syncBudgetDisplay);

  budgetChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      budgetInput.value = chip.getAttribute('data-budget');
      syncBudgetDisplay();
    });
  });

  needDomainCheckbox.addEventListener('change', () => {
    const isChecked = needDomainCheckbox.checked;
    needDomainBadge.textContent = isChecked ? 'Có' : 'Không';
    needDomainBadge.className = isChecked
      ? 'ml-2.5 text-xs font-bold text-brand-700 w-10'
      : 'ml-2.5 text-xs font-bold text-slate-500 w-10';
    needDomainText.textContent = isChecked
      ? 'Có — Ưu tiên gói tặng kèm tên miền miễn phí năm đầu'
      : 'Không — Bạn đã có sẵn tên miền hoặc chưa cần mua ngay';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = validateNeedsForm();

    if (!result.isValid) {
      feedbackBox.classList.add('hidden');
      return;
    }

    const userNeeds = result.data;
    currentUserNeeds = userNeeds;
    feedbackBox.classList.add('hidden');

    const topPlans = scorePlans(userNeeds, PLANS_DATA);

    if (sectionResults && aiLoadingBox && resultsContainer) {
      sectionResults.classList.remove('hidden');
      resultsContainer.innerHTML = '';
      aiLoadingBox.classList.remove('hidden');
      sectionResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-70', 'cursor-not-allowed');
      submitBtn.textContent = 'AI đang phân tích nhu cầu của bạn...';
    }

    const { advice, isFallback } = await getAIAdvice(userNeeds, topPlans);

    if (aiLoadingBox) {
      aiLoadingBox.classList.add('hidden');
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-70', 'cursor-not-allowed');
      submitBtn.textContent = 'Tư vấn cho tôi';
    }

    renderResults(topPlans, advice, isFallback, userNeeds);
    renderComparisonTable(
      topPlans.map((p) => p.id),
      topPlans[0].id
    );

    if (sectionResults) {
      sectionResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

// Khởi chạy khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  initFormInteractions();
  initLeadModal();
  initAdminSection();

  if (typeof renderFAQAccordion === 'function') {
    renderFAQAccordion();
  }

  // Hiển thị mặc định bảng so sánh ban đầu
  renderComparisonTable(['business', 'basic', 'shop-pro'], 'business');
});
