const {
  buildAuthConfig,
  getBearerToken,
  parseJsonBody,
  readErrorPayload,
  verifyAdminAccessToken,
} = require("./_admin-auth");

const DEFAULT_BUCKET = "site-assets";

function sanitizeSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9/_-]/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl || "").trim();
  const match = /^data:([^;]+);base64,(.+)$/i.exec(raw);
  if (!match) {
    return null;
  }

  const mime = String(match[1] || "").trim().toLowerCase();
  const base64 = String(match[2] || "").trim();
  if (!mime.startsWith("image/") || !base64) {
    return null;
  }

  return { mime, base64 };
}

function extensionFromMime(mime) {
  const normalized = String(mime || "").toLowerCase();
  if (normalized === "image/jpeg") {
    return "jpg";
  }
  if (normalized === "image/png") {
    return "png";
  }
  if (normalized === "image/webp") {
    return "webp";
  }
  if (normalized === "image/gif") {
    return "gif";
  }
  if (normalized === "image/svg+xml") {
    return "svg";
  }
  return "bin";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const configResult = buildAuthConfig({
    requireAdminEmails: true,
  });
  if (!configResult.ok) {
    return res.status(500).json({
      message: configResult.message,
    });
  }

  const accessToken = getBearerToken(req);
  const authResult = await verifyAdminAccessToken(configResult, accessToken);
  if (!authResult.ok) {
    return res.status(authResult.status || 401).json({
      message: authResult.message,
    });
  }

  const body = parseJsonBody(req.body);
  if (!body) {
    return res.status(400).json({
      message: "요청 본문(JSON) 형식이 올바르지 않습니다.",
    });
  }

  const parsed = parseDataUrl(body.dataUrl);
  if (!parsed) {
    return res.status(400).json({
      message: "이미지 데이터(dataUrl)가 올바르지 않습니다.",
    });
  }

  let binary;
  try {
    binary = Buffer.from(parsed.base64, "base64");
  } catch (_) {
    return res.status(400).json({
      message: "이미지 데이터 디코딩에 실패했습니다.",
    });
  }

  if (!binary.length) {
    return res.status(400).json({
      message: "이미지 데이터가 비어 있습니다.",
    });
  }

  if (binary.length > 2 * 1024 * 1024) {
    return res.status(400).json({
      message: "이미지 파일은 2MB 이하만 업로드할 수 있습니다.",
    });
  }

  const bucketName = sanitizeSegment(process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET) || DEFAULT_BUCKET;
  const folder = sanitizeSegment(body.folder || "cms-images") || "cms-images";
  const ext = extensionFromMime(parsed.mime);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const objectPath = `${folder}/${filename}`;
  const encodedPath = objectPath.split("/").map((segment) => encodeURIComponent(segment)).join("/");

  const uploadUrl = `${configResult.supabaseUrl}/storage/v1/object/${bucketName}/${encodedPath}`;
  const publicUrl = `${configResult.supabaseUrl}/storage/v1/object/public/${bucketName}/${encodedPath}`;

  try {
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: configResult.serviceRoleKey,
        Authorization: `Bearer ${configResult.serviceRoleKey}`,
        "Content-Type": parsed.mime,
        "x-upsert": "true",
      },
      body: binary,
    });

    if (!uploadResponse.ok) {
      const detail = await readErrorPayload(uploadResponse);
      return res.status(502).json({
        message: "이미지 업로드에 실패했습니다. Storage 버킷 설정을 확인해 주세요.",
        detail,
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      url: publicUrl,
      path: objectPath,
      bucket: bucketName,
    });
  } catch (_) {
    return res.status(502).json({
      message: "이미지 업로드 중 서버 오류가 발생했습니다.",
    });
  }
};
