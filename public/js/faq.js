/**
 * public/js/faq.js
 * Dữ liệu 05 câu hỏi thường gặp về Hosting & Tên miền và hàm render Accordion
 */

window.FAQ_DATA = [
  {
    id: 'faq-1',
    question: '1. Hosting và Tên miền (Domain) khác nhau như thế nào?',
    answer:
      'Bạn có thể hình dung Tên miền giống như "địa chỉ số nhà" (ví dụ: shopcuaban.vn) để khách gõ vào trình duyệt và tìm tới cửa hàng. Còn Hosting là "mặt bằng đất" nơi lưu trữ toàn bộ hình ảnh sản phẩm, bài viết và dữ liệu đơn hàng. Để mở một website hoạt động trên mạng, bạn cần có cả hai yếu tố này.'
  },
  {
    id: 'faq-2',
    question: '2. Shop mới mở ít khách thì nên chọn gói nào cho tiết kiệm?',
    answer:
      'Nếu bạn mới mở shop hoặc làm trang giới thiệu nhỏ với lượng khách dưới 10.000 lượt/tháng, gói Basic (69.000đ/tháng) hoặc Business (129.000đ/tháng) là lựa chọn kinh tế nhất vì đã được tặng kèm miễn phí tên miền năm đầu và chứng chỉ bảo mật SSL. Khi lượng khách tăng cao hơn, bạn có thể nâng cấp lên gói Shop Pro bất cứ lúc nào mà không mất dữ liệu.'
  },
  {
    id: 'faq-3',
    question: '3. Các gói tặng tên miền miễn phí hoạt động ra sao?',
    answer:
      'Các gói Basic, Business và Shop Pro đều có ưu đãi tặng miễn phí 01 tên miền (.com, .vn, .com.vn hoặc .shop) trong năm đầu tiên khi đăng ký chu kỳ từ 12 tháng. Hệ thống sẽ tự động khấu trừ 100% phí tên miền ngay trên giỏ hàng và mã thanh toán VietQR của bạn.'
  },
  {
    id: 'faq-4',
    question: '4. Thanh toán qua mã VietQR mất bao lâu thì dịch vụ được kích hoạt?',
    answer:
      'Ngay khi bạn quét mã VietQR và bấm nút "Tôi Đã Chuyển Khoản Thành Công", đơn hàng sẽ chuyển sang trạng thái chờ duyệt ưu tiên. Đội ngũ quản trị xác nhận thanh toán và hệ thống tự động cấp địa chỉ IP Hosting cùng cặp Nameservers ngay trong mục "Đơn Hàng Của Tôi" kèm Hóa đơn điện tử có dấu xác nhận ĐÃ THANH TOÁN.'
  },
  {
    id: 'faq-5',
    question: '5. Tôi có cần mua thêm dịch vụ Sao lưu (Daily Backup) hay Ẩn danh tên miền không?',
    answer:
      'Đây là các dịch vụ gia tăng tùy chọn: Bảo vệ ẩn danh Whois (50.000đ/năm) giúp ẩn số điện thoại cá nhân khỏi danh bạ tên miền công khai để tránh cuộc gọi rác; còn Sao lưu tự động hằng ngày (30.000đ/tháng) rất hữu ích cho website bán hàng thường xuyên cập nhật đơn hàng và sản phẩm mới.'
  }
];
