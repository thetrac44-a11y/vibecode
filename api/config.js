/**
 * api/config.js
 * Trả về cấu hình công khai của Supabase (SUPABASE_URL và SUPABASE_ANON_KEY) từ biến môi trường Vercel.
 * Lưu ý: GEMINI_API_KEY tuyệt đối KHÔNG được trả về ở đây (chỉ dùng nội bộ trong api/advice.js).
 */

module.exports = function handler(req, res) {
  res.status(200).json({
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  });
}
