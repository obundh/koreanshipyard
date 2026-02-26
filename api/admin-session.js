const {
  buildAuthConfig,
  getBearerToken,
  verifyAdminAccessToken,
} = require("./_admin-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
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
  const verifyResult = await verifyAdminAccessToken(configResult, accessToken);

  if (!verifyResult.ok) {
    return res.status(verifyResult.status || 401).json({
      message: verifyResult.message,
    });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    email: verifyResult.email,
  });
};
