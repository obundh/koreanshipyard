const {
  buildAuthConfig,
  parseJsonBody,
  readErrorPayload,
  verifyAdminAccessToken,
} = require("./_admin-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const configResult = buildAuthConfig({
    requireAnonKey: true,
    requireAdminEmails: true,
  });
  if (!configResult.ok) {
    return res.status(500).json({
      message: configResult.message,
    });
  }

  const body = parseJsonBody(req.body);
  if (!body) {
    return res.status(400).json({
      message: "요청 본문(JSON) 형식이 올바르지 않습니다.",
    });
  }

  const email = String(body.email || "").trim();
  const password = String(body.password || "").trim();

  if (!email || !password) {
    return res.status(400).json({
      message: "이메일과 비밀번호를 입력해 주세요.",
    });
  }

  try {
    const signInResponse = await fetch(
      `${configResult.supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: configResult.anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      },
    );

    if (!signInResponse.ok) {
      const detail = await readErrorPayload(signInResponse);
      return res.status(401).json({
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
        detail,
      });
    }

    const session = await signInResponse.json();
    const accessToken = String(session?.access_token || "").trim();

    if (!accessToken) {
      return res.status(401).json({
        message: "로그인 토큰을 발급받지 못했습니다.",
      });
    }

    const verifyResult = await verifyAdminAccessToken(configResult, accessToken);
    if (!verifyResult.ok) {
      return res.status(verifyResult.status || 403).json({
        message: verifyResult.message,
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      accessToken,
      email: verifyResult.email,
      expiresIn: Number(session?.expires_in || 0),
    });
  } catch (_) {
    return res.status(502).json({
      message: "로그인 처리 중 서버 오류가 발생했습니다.",
    });
  }
};
