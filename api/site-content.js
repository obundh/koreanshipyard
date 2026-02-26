const {
  buildAuthConfig,
  getBearerToken,
  parseJsonBody,
  readErrorPayload,
  verifyAdminAccessToken,
} = require("./_admin-auth");

const TABLE_NAME = "site_content";
const ROW_ID = "global";
const STORAGE_OBJECT_PATH = "cms/site-content.json";
const TABLE_MISSING_PATTERN =
  /site_content.*(does not exist|not exist|schema cache|could not find)|table.*site_content.*(does not exist|could not find)/i;

function hasMissingSiteContentTable(detail) {
  return TABLE_MISSING_PATTERN.test(String(detail || ""));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function encodeStoragePath(path) {
  return String(path || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function ensureBucketExists(config, bucketName) {
  const response = await fetch(`${config.supabaseUrl}/storage/v1/bucket`, {
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

  throw new Error(detail || "스토리지 버킷 준비에 실패했습니다.");
}

async function readContentFromStorage(config) {
  const bucketName = String(process.env.SUPABASE_STORAGE_BUCKET || "site-assets").trim() || "site-assets";
  const encodedPath = encodeStoragePath(STORAGE_OBJECT_PATH);
  const objectUrl = `${config.supabaseUrl}/storage/v1/object/${bucketName}/${encodedPath}`;

  await ensureBucketExists(config, bucketName);

  const response = await fetch(objectUrl, {
    method: "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });

  if (response.status === 404) {
    return {
      content: {},
      updatedAt: null,
    };
  }

  if (!response.ok) {
    const detail = await readErrorPayload(response);
    throw new Error(detail || "스토리지 콘텐츠 조회에 실패했습니다.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }

  const content = isPlainObject(payload?.content)
    ? payload.content
    : (isPlainObject(payload) ? payload : {});

  const updatedAt = typeof payload?.updatedAt === "string"
    ? payload.updatedAt
    : null;

  return {
    content,
    updatedAt,
  };
}

async function writeContentToStorage(config, content) {
  const bucketName = String(process.env.SUPABASE_STORAGE_BUCKET || "site-assets").trim() || "site-assets";
  const encodedPath = encodeStoragePath(STORAGE_OBJECT_PATH);
  const objectUrl = `${config.supabaseUrl}/storage/v1/object/${bucketName}/${encodedPath}`;
  const updatedAt = new Date().toISOString();

  await ensureBucketExists(config, bucketName);

  const response = await fetch(objectUrl, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      "x-upsert": "true",
    },
    body: JSON.stringify({
      id: ROW_ID,
      content,
      updatedAt,
    }),
  });

  if (!response.ok) {
    const detail = await readErrorPayload(response);
    throw new Error(detail || "스토리지 콘텐츠 저장에 실패했습니다.");
  }

  return {
    content,
    updatedAt,
  };
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
        if (hasMissingSiteContentTable(detail)) {
          const fallback = await readContentFromStorage(configResult);
          return res.status(200).json({
            content: fallback.content,
            updatedAt: fallback.updatedAt,
          });
        }

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
      if (hasMissingSiteContentTable(detail)) {
        const fallback = await writeContentToStorage(configResult, content);
        return res.status(200).json({
          content: fallback.content,
          updatedAt: fallback.updatedAt,
        });
      }

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
