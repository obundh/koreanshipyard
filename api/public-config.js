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

async function ensureBucketExists(supabaseUrl, serviceRoleKey, bucketName) {
  if (!serviceRoleKey) {
    return {
      ok: false,
      message: "SUPABASE_SERVICE_ROLE_KEY가 없어 버킷 자동 생성을 할 수 없습니다.",
    };
  }

  const safeBucketName = encodeURIComponent(String(bucketName || "").trim());
  const commonHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  const readResponse = await fetch(`${supabaseUrl}/storage/v1/bucket/${safeBucketName}`, {
    method: "GET",
    headers: commonHeaders,
  });

  if (readResponse.ok) {
    return { ok: true };
  }

  const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({
      id: bucketName,
      name: bucketName,
      public: true,
    }),
  });

  if (response.ok || response.status === 409) {
    return { ok: true };
  }

  const detail = await readErrorPayload(response);
  if (/already exists|resource already exists|duplicate/i.test(String(detail || ""))) {
    return { ok: true };
  }

  return {
    ok: false,
    message: "스토리지 버킷 생성에 실패했습니다.",
    detail,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const supabaseAnonKey = String(
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "",
  ).trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const storageBucket = String(process.env.SUPABASE_STORAGE_BUCKET || "site-assets").trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      message: "공개 업로드 설정(SUPABASE_URL / SUPABASE_ANON_KEY)이 누락되었습니다.",
    });
  }

  const bucketReady = await ensureBucketExists(supabaseUrl, serviceRoleKey, storageBucket);
  if (!bucketReady.ok) {
    return res.status(500).json({
      message: bucketReady.message,
      detail: bucketReady.detail || "",
    });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey,
    storageBucket,
  });
};
