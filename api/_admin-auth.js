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

function pickHeader(req, key) {
  const headers = req?.headers || {};
  const value = headers[key] ?? headers[key.toLowerCase()];

  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }

  return String(value || "").trim();
}

function getBearerToken(req) {
  const authorization = pickHeader(req, "authorization");
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match ? String(match[1] || "").trim() : "";
}

function parseAdminEmails(raw) {
  return new Set(
    String(raw || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function buildAuthConfig({ requireAnonKey = false, requireAdminEmails = false } = {}) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);

  const missing = [];
  if (!supabaseUrl) {
    missing.push("SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (requireAnonKey && !anonKey) {
    missing.push("SUPABASE_ANON_KEY");
  }
  if (requireAdminEmails && !adminEmails.size) {
    missing.push("ADMIN_EMAILS");
  }

  if (missing.length) {
    return {
      ok: false,
      message: `환경변수 누락: ${missing.join(", ")}`,
    };
  }

  return {
    ok: true,
    supabaseUrl,
    serviceRoleKey,
    anonKey,
    adminEmails,
  };
}

async function readErrorPayload(response) {
  try {
    const payload = await response.json();
    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    return JSON.stringify(payload);
  } catch (_) {
    try {
      return await response.text();
    } catch (_) {
      return "UNKNOWN_ERROR";
    }
  }
}

async function fetchUserByAccessToken(config, accessToken) {
  if (!accessToken) {
    return {
      ok: false,
      status: 401,
      message: "관리자 로그인이 필요합니다.",
    };
  }

  try {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const detail = await readErrorPayload(response);
      return {
        ok: false,
        status: response.status === 401 ? 401 : 502,
        message: response.status === 401 ? "로그인이 만료되었습니다." : "관리자 사용자 조회에 실패했습니다.",
        detail,
      };
    }

    const user = await response.json();
    const email = String(user?.email || "").trim();

    if (!email) {
      return {
        ok: false,
        status: 401,
        message: "유효한 관리자 계정이 아닙니다.",
      };
    }

    return {
      ok: true,
      email,
    };
  } catch (_) {
    return {
      ok: false,
      status: 502,
      message: "인증 서버 연결에 실패했습니다.",
    };
  }
}

async function verifyAdminAccessToken(config, accessToken) {
  const userResult = await fetchUserByAccessToken(config, accessToken);
  if (!userResult.ok) {
    return userResult;
  }

  const normalizedEmail = userResult.email.toLowerCase();
  if (!config.adminEmails.has(normalizedEmail)) {
    return {
      ok: false,
      status: 403,
      message: "관리자 권한이 없는 계정입니다.",
    };
  }

  return {
    ok: true,
    email: userResult.email,
  };
}

module.exports = {
  buildAuthConfig,
  getBearerToken,
  parseJsonBody,
  readErrorPayload,
  verifyAdminAccessToken,
};
