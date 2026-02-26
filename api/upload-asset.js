const {
  buildAuthConfig,
  getBearerToken,
  parseJsonBody,
  readErrorPayload,
  verifyAdminAccessToken,
} = require("./_admin-auth");

const DEFAULT_BUCKET = "site-assets";
const MAX_FILE_BYTES = Math.floor(4.3 * 1024 * 1024);

const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
const ALLOWED_EXACT_MIMES = new Set([
  "application/pdf",
  "application/x-hwp",
  "application/haansofthwp",
  "application/msword",
  "application/vnd.ms-powerpoint",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

function sanitizeSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9/_-]/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function pickHeader(req, key) {
  const headers = req?.headers || {};
  const value = headers[key] ?? headers[key.toLowerCase()];

  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }

  return String(value || "").trim();
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req?.body)) {
    return req.body;
  }

  if (req?.body instanceof Uint8Array) {
    return Buffer.from(req.body);
  }

  if (typeof req?.body === "string") {
    return Buffer.from(req.body);
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

function extensionFromFileName(fileName) {
  const raw = String(fileName || "").trim();
  const match = /\.([a-zA-Z0-9]+)$/.exec(raw);
  if (!match) {
    return "bin";
  }
  return String(match[1] || "bin").toLowerCase();
}

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl || "").trim();
  const match = /^data:([^;]+);base64,(.+)$/i.exec(raw);
  if (!match) {
    return null;
  }

  const mime = String(match[1] || "").trim().toLowerCase();
  const base64 = String(match[2] || "").trim();

  if (!mime || !base64) {
    return null;
  }

  return { mime, base64 };
}

function isAllowedMime(mime) {
  if (!mime) {
    return false;
  }

  if (ALLOWED_EXACT_MIMES.has(mime)) {
    return true;
  }

  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

function extensionFromMime(mime) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-msvideo": "avi",
    "application/pdf": "pdf",
    "application/x-hwp": "hwp",
    "application/haansofthwp": "hwp",
    "application/msword": "doc",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/plain": "txt",
  };

  return map[mime] || "bin";
}

async function ensureBucketExists(config, bucketName) {
  const createBucketUrl = `${config.supabaseUrl}/storage/v1/bucket`;
  const response = await fetch(createBucketUrl, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: bucketName,
      name: bucketName,
      public: true,
    }),
  });

  if (response.ok || response.status === 409) {
    return;
  }

  const detail = await readErrorPayload(response);
  if (/already exists|resource already exists|duplicate/i.test(String(detail || ""))) {
    return;
  }

  throw new Error(detail || "버킷 생성 실패");
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

  const contentTypeHeader = pickHeader(req, "content-type").toLowerCase();
  const contentType = contentTypeHeader.split(";")[0].trim();
  const isJsonBody = contentType.includes("application/json");

  let mime = "";
  let folder = "cms-assets";
  let binary;
  let ext = "bin";

  if (isJsonBody) {
    const body = parseJsonBody(req.body);
    if (!body) {
      return res.status(400).json({
        message: "요청 본문(JSON) 형식이 올바르지 않습니다.",
      });
    }

    const parsed = parseDataUrl(body.dataUrl);
    if (!parsed) {
      return res.status(400).json({
        message: "파일 데이터(dataUrl)가 올바르지 않습니다.",
      });
    }

    if (!isAllowedMime(parsed.mime)) {
      return res.status(400).json({
        message: "지원하지 않는 파일 형식입니다.",
      });
    }

    try {
      binary = Buffer.from(parsed.base64, "base64");
    } catch (_) {
      return res.status(400).json({
        message: "파일 데이터 디코딩에 실패했습니다.",
      });
    }

    mime = parsed.mime;
    folder = sanitizeSegment(body.folder || "cms-assets") || "cms-assets";
    ext = extensionFromMime(mime);
  } else {
    const fileName = decodeURIComponent(pickHeader(req, "x-file-name") || "asset.bin");
    const folderHeader = pickHeader(req, "x-upload-folder");
    folder = sanitizeSegment(folderHeader || "cms-assets") || "cms-assets";

    const binaryMime = String(contentType || "").trim().toLowerCase();
    if (!binaryMime || binaryMime === "application/octet-stream") {
      ext = extensionFromFileName(fileName);
      mime = binaryMime || "application/octet-stream";
    } else {
      if (!isAllowedMime(binaryMime)) {
        return res.status(400).json({
          message: "지원하지 않는 파일 형식입니다.",
        });
      }
      mime = binaryMime;
      ext = extensionFromMime(binaryMime);
    }

    try {
      binary = await readRawBody(req);
    } catch (_) {
      return res.status(400).json({
        message: "파일 데이터 읽기에 실패했습니다.",
      });
    }
  }

  if (!binary.length) {
    return res.status(400).json({
      message: "업로드할 파일 데이터가 없습니다.",
    });
  }

  if (binary.length > MAX_FILE_BYTES) {
    return res.status(413).json({
      message: "파일은 약 4.3MB 이하만 업로드할 수 있습니다.",
    });
  }

  const bucketName =
    sanitizeSegment(process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET) ||
    DEFAULT_BUCKET;
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const objectPath = `${folder}/${filename}`;
  const encodedPath = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const uploadUrl = `${configResult.supabaseUrl}/storage/v1/object/${bucketName}/${encodedPath}`;
  const publicUrl = `${configResult.supabaseUrl}/storage/v1/object/public/${bucketName}/${encodedPath}`;

  try {
    await ensureBucketExists(configResult, bucketName);

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: configResult.serviceRoleKey,
        Authorization: `Bearer ${configResult.serviceRoleKey}`,
        "Content-Type": mime || "application/octet-stream",
        "x-upsert": "true",
      },
      body: binary,
    });

    if (!uploadResponse.ok) {
      const detail = await readErrorPayload(uploadResponse);
      return res.status(502).json({
        message: "파일 업로드에 실패했습니다. Storage 버킷 설정을 확인해 주세요.",
        detail,
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      url: publicUrl,
      path: objectPath,
      bucket: bucketName,
      mime: mime || "application/octet-stream",
      size: binary.length,
    });
  } catch (_) {
    return res.status(502).json({
      message: "파일 업로드 중 서버 오류가 발생했습니다.",
    });
  }
};
