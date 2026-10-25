/**
 * api/advice.js
 * Vercel Serverless Function làm Proxy gọi Gemini API.
 * Giúp giấu kín GEMINI_API_KEY trên server (Environment Variables), không lộ ra trình duyệt.
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

function cleanJsonText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên server.' });
  }

  try {
    const { userNeeds, topPlans } = req.body || {};
    if (!userNeeds || !Array.isArray(topPlans) || topPlans.length < 3) {
      return res.status(400).json({ error: 'Dữ liệu đầu vào không hợp lệ.' });
    }

    const userMessage = `NHU CẦU KHÁCH:
- Loại website: ${userNeeds.siteType}
- Lượng truy cập ước tính: ${userNeeds.trafficLabel} lượt/tháng
- Ngân sách: ${Number(userNeeds.budget).toLocaleString('vi-VN')} VNĐ/tháng
- Cần mua kèm tên miền: ${userNeeds.needDomain ? 'Có' : 'Không'}

3 GÓI ĐÃ CHỌN (theo thứ tự: gói phù hợp nhất, thay thế 1, thay thế 2):
${JSON.stringify(topPlans, null, 2)}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: AI_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.4,
        },
      }),
    });

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({ error: `Gemini HTTP ${geminiRes.status}` });
    }

    const resultJson = await geminiRes.json();
    const rawContent = resultJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = cleanJsonText(rawContent);
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Lỗi xử lý AI trên server.' });
  }
}
