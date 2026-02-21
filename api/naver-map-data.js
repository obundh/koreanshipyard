const DEFAULT_QUERY = "전남 여수시 신월로 478-3";
const DEFAULT_CENTER = {
  lat: 34.7605,
  lng: 127.6622,
};

function pickFallbackCenter() {
  const lat = Number(process.env.NAVER_MAP_LAT);
  const lng = Number(process.env.NAVER_MAP_LNG);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return DEFAULT_CENTER;
}

function pickAddress(req) {
  const queryParam = req?.query?.address;
  if (Array.isArray(queryParam)) {
    return queryParam[0];
  }
  if (typeof queryParam === "string" && queryParam.trim()) {
    return queryParam;
  }
  return process.env.NAVER_MAP_QUERY || DEFAULT_QUERY;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const clientId = process.env.NAVER_MAPS_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAPS_CLIENT_SECRET;
  const query = pickAddress(req);
  const fallbackCenter = pickFallbackCenter();

  if (!clientId) {
    return res.status(500).json({
      message: "지도 Client ID 환경변수가 설정되지 않았습니다.",
    });
  }

  if (!clientSecret) {
    return res.status(200).json({
      clientId,
      center: fallbackCenter,
      query,
      geocoded: false,
      message: "Client Secret 미설정으로 기본 좌표를 사용합니다.",
    });
  }

  const endpoint = `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`;

  try {
    const geoResponse = await fetch(endpoint, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
    });

    if (!geoResponse.ok) {
      return res.status(200).json({
        clientId,
        center: fallbackCenter,
        query,
        geocoded: false,
        message: "지오코딩 권한이 없어 기본 좌표를 사용합니다.",
      });
    }

    const payload = await geoResponse.json();
    const first = Array.isArray(payload?.addresses) ? payload.addresses[0] : null;

    if (!first?.x || !first?.y) {
      return res.status(200).json({
        clientId,
        center: fallbackCenter,
        query,
        geocoded: false,
        message: "주소 검색 결과가 없어 기본 좌표를 사용합니다.",
      });
    }

    return res.status(200).json({
      clientId,
      center: {
        lat: Number(first.y),
        lng: Number(first.x),
      },
      roadAddress: first.roadAddress || "",
      jibunAddress: first.jibunAddress || "",
      query,
      geocoded: true,
    });
  } catch (error) {
    return res.status(200).json({
      clientId,
      center: fallbackCenter,
      query,
      geocoded: false,
      message: "지도 API 연결 오류로 기본 좌표를 사용합니다.",
    });
  }
};
