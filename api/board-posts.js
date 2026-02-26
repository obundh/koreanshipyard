const {
  buildAuthConfig,
  getBearerToken,
  parseJsonBody,
  readErrorPayload,
  verifyAdminAccessToken,
} = require("./_admin-auth");

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

function pickPostId(req, body) {
  const queryId = pickStringParam(req?.query?.id);
  const bodyId = pickStringParam(body?.id);
  const raw = queryId || bodyId;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function sanitizeAttachment(payload) {
  const attachmentUrl =
    typeof payload?.attachmentUrl === "string"
      ? payload.attachmentUrl.trim()
      : "";
  const attachmentName =
    typeof payload?.attachmentName === "string"
      ? payload.attachmentName.trim()
      : "";

  if (!attachmentUrl && !attachmentName) {
    return { ok: true, attachmentUrl: null, attachmentName: null };
  }

  if (!attachmentUrl) {
    return { ok: false, message: "첨부 파일 URL이 없습니다." };
  }

  if (attachmentUrl.length > 2000) {
    return { ok: false, message: "첨부 파일 URL 길이가 너무 깁니다." };
  }

  if (attachmentName.length > 200) {
    return { ok: false, message: "첨부 파일명이 너무 깁니다." };
  }

  return {
    ok: true,
    attachmentUrl,
    attachmentName: attachmentName || null,
  };
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
      message: "제목은 120자 이하로 입력해 주세요.",
    };
  }

  if (content.length > 2000) {
    return {
      ok: false,
      message: "내용은 2000자 이하로 입력해 주세요.",
    };
  }

  if (author.length > 30) {
    return {
      ok: false,
      message: "작성자명은 30자 이하로 입력해 주세요.",
    };
  }

  const attachment = sanitizeAttachment(payload);
  if (!attachment.ok) {
    return attachment;
  }

  return {
    ok: true,
    payload: {
      author: author || null,
      title,
      content,
      attachment_url: attachment.attachmentUrl,
      attachment_name: attachment.attachmentName,
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const needsAdmin = req.method === "POST" || req.method === "DELETE";
  const configResult = buildAuthConfig({
    requireAdminEmails: needsAdmin,
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
    const limit = pickLimit(req);
    const query = `?select=id,title,author,content,attachment_url,attachment_name,created_at&order=created_at.desc&limit=${limit}`;

    try {
      const response = await fetch(`${endpointBase}${query}`, {
        method: "GET",
        headers: serviceHeaders,
      });

      if (!response.ok) {
        const detail = await readErrorPayload(response);
        return res.status(502).json({
          message: "공지사항 조회에 실패했습니다.",
          detail,
        });
      }

      const posts = await response.json();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(Array.isArray(posts) ? posts : []);
    } catch (_) {
      return res.status(502).json({
        message: "공지사항 조회 중 서버 오류가 발생했습니다.",
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

  const body = parseJsonBody(req.body) || {};

  if (req.method === "DELETE") {
    const postId = pickPostId(req, body);
    if (!postId) {
      return res.status(400).json({
        message: "삭제할 공지 ID가 올바르지 않습니다.",
      });
    }

    try {
      const response = await fetch(`${endpointBase}?id=eq.${postId}`, {
        method: "DELETE",
        headers: {
          ...serviceHeaders,
          Prefer: "return=representation",
        },
      });

      if (!response.ok) {
        const detail = await readErrorPayload(response);
        return res.status(502).json({
          message: "공지사항 삭제에 실패했습니다.",
          detail,
        });
      }

      const deletedRows = await response.json();
      if (!Array.isArray(deletedRows) || !deletedRows.length) {
        return res.status(404).json({
          message: "삭제할 공지사항을 찾지 못했습니다.",
        });
      }

      return res.status(200).json({
        id: postId,
      });
    } catch (_) {
      return res.status(502).json({
        message: "공지사항 삭제 중 서버 오류가 발생했습니다.",
      });
    }
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
        ...serviceHeaders,
        Prefer: "return=representation",
      },
      body: JSON.stringify(sanitized.payload),
    });

    if (!response.ok) {
      const detail = await readErrorPayload(response);
      return res.status(502).json({
        message: "공지사항 등록에 실패했습니다.",
        detail,
      });
    }

    const inserted = await response.json();
    const row = Array.isArray(inserted) ? inserted[0] : inserted;
    return res.status(201).json(row || {});
  } catch (_) {
    return res.status(502).json({
      message: "공지사항 등록 중 서버 오류가 발생했습니다.",
    });
  }
};
