const {
  buildAuthConfig,
  getBearerToken,
  parseJsonBody,
  readErrorPayload,
  verifyAdminAccessToken,
} = require("./_admin-auth");

const TABLE_NAME = "site_content";
const ROW_ID = "global";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const configResult = buildAuthConfig({
    requireAdminEmails: req.method === "POST",
  });
  if (!configResult.ok) {
    return res.status(500).json({
      message: configResult.message,
    });
  }

  const endpointBase = `${configResult.supabaseUrl}/rest/v1/${TABLE_NAME}`;
  const serviceHeaders = {
    apikey: configResult.serviceRoleKey,
    Authorization: `Bearer ${configResult.serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  if (req.method === "GET") {
    const query = `?select=id,content,updated_at&id=eq.${ROW_ID}&limit=1`;

    try {
      const response = await fetch(`${endpointBase}${query}`, {
        method: "GET",
        headers: serviceHeaders,
      });

      if (!response.ok) {
        const detail = await readErrorPayload(response);
        return res.status(502).json({
          message: "사이트 콘텐츠 조회에 실패했습니다.",
          detail,
        });
      }

      const rows = await response.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      return res.status(200).json({
        content: isPlainObject(row?.content) ? row.content : {},
        updatedAt: row?.updated_at || null,
      });
    } catch (_) {
      return res.status(502).json({
        message: "사이트 콘텐츠 조회 중 서버 오류가 발생했습니다.",
      });
    }
  }

  const accessToken = getBearerToken(req);
  const authResult = await verifyAdminAccessToken(configResult, accessToken);
  if (!authResult.ok) {
    return res.status(authResult.status || 401).json({
      message: authResult.message,
    });
  }

  const body = parseJsonBody(req.body);
  const content = body?.content;

  if (!isPlainObject(content)) {
    return res.status(400).json({
      message: "content 객체를 전달해 주세요.",
    });
  }

  const payload = {
    id: ROW_ID,
    content,
  };

  try {
    const response = await fetch(`${endpointBase}?on_conflict=id`, {
      method: "POST",
      headers: {
        ...serviceHeaders,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await readErrorPayload(response);
      return res.status(502).json({
        message: "사이트 콘텐츠 저장에 실패했습니다.",
        detail,
      });
    }

    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    return res.status(200).json({
      content: isPlainObject(row?.content) ? row.content : content,
      updatedAt: row?.updated_at || null,
    });
  } catch (_) {
    return res.status(502).json({
      message: "사이트 콘텐츠 저장 중 서버 오류가 발생했습니다.",
    });
  }
};
