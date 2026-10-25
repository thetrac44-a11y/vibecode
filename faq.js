/**
 * faq.js
 * Chứa 5 câu hỏi thường gặp về Hosting & Domain và hàm hiển thị Accordion.
 * Giải thích ngắn gọn, bình dân, dễ hiểu cho chủ shop không rành kỹ thuật.
 */

const FAQ_DATA = [
  {
    id: 'faq-1',
    question: '1. Hosting và tên miền là gì, khác nhau thế nào?',
    answer:
      'Bạn cứ hình dung mở website giống như mở một cửa hàng ngoài đời thực: Tên miền (ví dụ: shopcuaban.vn) chính là số nhà và bảng hiệu để khách tìm đến đúng nơi, còn Hosting là mảnh đất và mặt bằng bên trong để bạn trưng bày hình ảnh sản phẩm, bài viết và giỏ hàng. Muốn website hoạt động trên mạng thì cần có cả hai phần này.'
  },
  {
    id: 'faq-2',
    question: '2. Shared hosting, Cloud hosting và VPS khác nhau ra sao?',
    answer:
      'Shared Hosting giống như thuê một gian hàng nhỏ trong khu chợ chung, chi phí rẻ nhất, rất hợp cho web mới mở hoặc ít khách. Cloud Hosting giống như gian hàng trong trung tâm thương mại hiện đại, có hệ thống dự phòng nên chạy mượt và ổn định hơn khi bạn chạy quảng cáo. Còn VPS giống như thuê nguyên một tòa nhà riêng biệt, bạn có toàn quyền sử dụng tài nguyên mạnh mẽ cho website quy mô lớn.'
  },
  {
    id: 'faq-3',
    question: '3. Tên miền .com và .vn khác nhau thế nào, nên chọn loại nào?',
    answer:
      'Tên miền .vn là tên miền quốc gia Việt Nam, được pháp luật Việt Nam bảo hộ thương hiệu và tạo độ tin cậy rất cao với khách hàng trong nước. Tên miền .com là tên miền quốc tế phổ biến nhất thế giới với chi phí đăng ký rẻ hơn một chút. Nếu bạn bán hàng chủ yếu tại Việt Nam và muốn xây dựng thương hiệu lâu dài thì nên ưu tiên .vn (hoặc mua cả hai để bảo vệ tên shop).'
  },
  {
    id: 'faq-4',
    question: '4. SSL là gì, shop online có bắt buộc cần không?',
    answer:
      'SSL là chứng chỉ bảo mật giúp mã hóa thông tin khách hàng (hiển thị chữ https:// trên thanh địa chỉ trình duyệt). Với shop online thì SSL là bắt buộc phải có: nếu không có SSL, trình duyệt Chrome hay Safari sẽ hiện cảnh báo "Không bảo mật" khiến khách hàng lo ngại không dám đặt hàng. Toàn bộ các gói trong hệ thống đều đã tích hợp sẵn SSL miễn phí cho bạn.'
  },
  {
    id: 'faq-5',
    question: '5. Khi website đông khách hơn thì nâng cấp gói như thế nào?',
    answer:
      'Việc nâng cấp cực kỳ đơn giản và không làm mất dữ liệu hay gián đoạn việc bán hàng của bạn. Bạn chỉ cần liên hệ bộ phận hỗ trợ để chuyển từ gói thấp lên gói cao hơn (ví dụ từ Basic lên Business hoặc Shop Pro) chỉ trong vài phút và chỉ cần bù phần chi phí chênh lệch của thời gian còn lại.'
  }
];

/**
 * Render danh sách 5 câu hỏi dạng Accordion vào khung #faq-container
 * Hỗ trợ: chỉ mở 1 câu cùng lúc, hiệu ứng đóng/mở mượt, thẻ semantic và bàn phím (aria-expanded)
 */
function renderFAQAccordion() {
  const container = document.getElementById('faq-container');
  if (!container || !Array.isArray(FAQ_DATA)) return;

  container.innerHTML = FAQ_DATA.map((item, idx) => {
    const isFirst = idx === 0;
    const panelId = `faq-panel-${item.id}`;
    const buttonId = `faq-btn-${item.id}`;

    return `
      <article class="faq-item rounded-2xl border ${
        isFirst ? 'border-brand-500 bg-brand-50/20' : 'border-slate-200 bg-white'
      } transition-colors overflow-hidden">
        <h3>
          <button
            type="button"
            id="${buttonId}"
            aria-expanded="${isFirst ? 'true' : 'false'}"
            aria-controls="${panelId}"
            data-faq-index="${idx}"
            class="faq-trigger w-full text-left px-5 py-4 sm:px-6 sm:py-5 flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-slate-900 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <span>${item.question}</span>
            <span
              class="faq-indicator shrink-0 w-7 h-7 rounded-lg border border-slate-300 bg-slate-50 text-slate-600 flex items-center justify-center text-sm font-bold transition-colors"
              aria-hidden="true"
            >
              ${isFirst ? '-' : '+'}
            </span>
          </button>
        </h3>
        <div
          id="${panelId}"
          role="region"
          aria-labelledby="${buttonId}"
          class="faq-panel ${isFirst ? 'is-open' : ''}"
        >
          <div class="faq-panel-inner">
            <div class="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 text-sm text-slate-600 leading-relaxed border-t border-slate-100 mt-1 pt-3">
              ${item.answer}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  const triggers = container.querySelectorAll('.faq-trigger');

  function toggleItem(targetBtn) {
    const isCurrentlyOpen = targetBtn.getAttribute('aria-expanded') === 'true';

    // Đóng tất cả các câu hỏi trước
    triggers.forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false');
      const indicator = btn.querySelector('.faq-indicator');
      if (indicator) indicator.textContent = '+';
      const article = btn.closest('.faq-item');
      if (article) {
        article.classList.remove('border-brand-500', 'bg-brand-50/20');
        article.classList.add('border-slate-200', 'bg-white');
      }
      const panelId = btn.getAttribute('aria-controls');
      const panel = document.getElementById(panelId);
      if (panel) panel.classList.remove('is-open');
    });

    // Nếu câu được bấm đang đóng thì mở nó ra (đảm bảo chỉ mở tối đa 1 câu một lúc)
    if (!isCurrentlyOpen) {
      targetBtn.setAttribute('aria-expanded', 'true');
      const indicator = targetBtn.querySelector('.faq-indicator');
      if (indicator) indicator.textContent = '-';
      const article = targetBtn.closest('.faq-item');
      if (article) {
        article.classList.remove('border-slate-200', 'bg-white');
        article.classList.add('border-brand-500', 'bg-brand-50/20');
      }
      const panelId = targetBtn.getAttribute('aria-controls');
      const panel = document.getElementById(panelId);
      if (panel) panel.classList.add('is-open');
    }
  }

  triggers.forEach((btn, index) => {
    btn.addEventListener('click', () => toggleItem(btn));

    // Hỗ trợ di chuyển bằng phím mũi tên Lên / Xuống / Home / End
    btn.addEventListener('keydown', (event) => {
      let nextIndex = null;
      if (event.key === 'ArrowDown') {
        nextIndex = (index + 1) % triggers.length;
      } else if (event.key === 'ArrowUp') {
        nextIndex = (index - 1 + triggers.length) % triggers.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = triggers.length - 1;
      }

      if (nextIndex !== null) {
        event.preventDefault();
        triggers[nextIndex].focus();
      }
    });
  });
}
