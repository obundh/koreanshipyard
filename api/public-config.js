module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const supabaseAnonKey = String(
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "",
  ).trim();
  const storageBucket = String(process.env.SUPABASE_STORAGE_BUCKET || "site-assets").trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      message: "공개 업로드 설정(SUPABASE_URL / SUPABASE_ANON_KEY)이 누락되었습니다.",
    });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey,
    storageBucket,
  });
};
