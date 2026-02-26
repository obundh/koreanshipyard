const TABLE_NAME = "board_posts";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function pickStringParam(value) {
  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }
  return String(value || "").trim();
}

function pickLimit(req) {
  const raw = pickStringParam(req?.query?.limit);
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.max(1, parsed));
}

function parseJsonBody(body) {
  if (body && typeof body === "object") {
    return body;
  }

  if (typeof body === "string" && body.trim()) {
    try {
      return JSON.parse(body);
    } catch (_) {
      return null;
    }
  }

  return null;
}

function sanitizePostPayload(payload) {
  const author = typeof payload?.author === "string" ? payload.author.trim() : "";
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  const content = typeof payload?.content === "string" ? payload.content.trim() : "";

  if (!title || !content) {
    return {
      ok: false,
      message: "제목과 내용은 필수 입력입니다.",
    };
  }

  if (title.length > 120) {
    return {
      ok: false,
      message: "제목은 120자 이하여야 합니다.",
    };
  }

  if (content.length > 2000) {
    return {
      ok: false,
      message: "내용은 2000자 이하여야 합니다.",
    };
  }

  if (author.length > 30) {
    return {
      ok: false,
      message: "작성자는 30자 이하여야 합니다.",
    };
  }

  return {
    ok: true,
    payload: {
      author: author || null,
      title,
      content,
    },
  };
}

function buildSupabaseConfig() {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return {
    endpointBase: `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${TABLE_NAME}`,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  };
}

async function readErrorPayload(response) {
  try {
    const json = await response.json();
    if (json && typeof json.message === "string") {
      return json.message;
    }
    return JSON.stringify(json);
  } catch (_) {
    try {
      return await response.text();
    } catch (_) {
      return "UNKNOWN_ERROR";
    }
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const supabaseConfig = buildSupabaseConfig();
  if (!supabaseConfig) {
    return res.status(500).json({
      message: "SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.",
    });
  }

  const { endpointBase, headers } = supabaseConfig;

  if (req.method === "GET") {
    const limit = pickLimit(req);
    const query = `?select=id,title,author,content,created_at&order=created_at.desc&limit=${limit}`;

    try {
      const response = await fetch(`${endpointBase}${query}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const detail = await readErrorPayload(response);
        return res.status(502).json({
          message: "Supabase 공지 조회에 실패했습니다.",
          detail,
        });
      }

      const posts = await response.json();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(Array.isArray(posts) ? posts : []);
    } catch (error) {
      return res.status(502).json({
        message: "공지 조회 중 서버 오류가 발생했습니다.",
      });
    }
  }

  const body = parseJsonBody(req.body);
  if (!body) {
    return res.status(400).json({
      message: "요청 본문(JSON) 형식이 올바르지 않습니다.",
    });
  }

  const sanitized = sanitizePostPayload(body);
  if (!sanitized.ok) {
    return res.status(400).json({
      message: sanitized.message,
    });
  }

  try {
    const response = await fetch(endpointBase, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "return=representation",
      },
      body: JSON.stringify(sanitized.payload),
    });

    if (!response.ok) {
      const detail = await readErrorPayload(response);
      return res.status(502).json({
        message: "Supabase 공지 등록에 실패했습니다.",
        detail,
      });
    }

    const inserted = await response.json();
    const row = Array.isArray(inserted) ? inserted[0] : inserted;
    return res.status(201).json(row || {});
  } catch (error) {
    return res.status(502).json({
      message: "공지 등록 중 서버 오류가 발생했습니다.",
    });
  }
};
