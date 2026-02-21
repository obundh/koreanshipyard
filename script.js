const heroProducts = [
  {
    title: "낚시선 생산 라인",
    description: "3톤부터 9.77톤급까지 현장 요구에 맞춘 낚시선을 안정적으로 제작합니다.",
    meta: "톤급: 3톤 ~ 9.77톤급",
    image: "sample-image-1.png",
  },
  {
    title: "어선 생산 라인",
    description: "3톤부터 50톤급까지 각 톤급별 몰드를 보유해 안정적인 생산이 가능합니다.",
    meta: "톤급: 3톤 ~ 50톤급 (각 톤급별 몰드 보유)",
    image: "sample-image-1.png",
  },
  {
    title: "기타선박(통선) 생산 라인",
    description: "7.93톤부터 9.77톤급 통선 생산 기준에 맞춰 품질과 납기를 관리합니다.",
    meta: "톤급: 7.93톤 ~ 9.77톤급",
    image: "sample-image-1.png",
  },
];

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const heroStage = document.querySelector(".hero-stage");
const heroTitle = document.querySelector("#hero-title");
const heroDesc = document.querySelector("#hero-desc");
const heroMeta = document.querySelector("#hero-meta");
const heroTabs = document.querySelectorAll(".hero-tab");
const hasHero =
  heroStage &&
  heroTitle &&
  heroDesc &&
  heroMeta &&
  heroTabs.length === heroProducts.length;
let activeHeroIndex = 0;

function renderHero(index) {
  if (!hasHero) {
    return;
  }

  const safeIndex = (index + heroProducts.length) % heroProducts.length;
  const product = heroProducts[safeIndex];
  activeHeroIndex = safeIndex;

  heroStage.style.backgroundImage =
    `linear-gradient(120deg, rgba(8, 24, 54, 0.74), rgba(20, 53, 108, 0.42) 45%, rgba(11, 33, 70, 0.78)), url("${product.image}")`;

  heroTitle.textContent = product.title;
  heroDesc.textContent = product.description;
  heroMeta.textContent = product.meta;

  heroTabs.forEach((tab, tabIndex) => {
    const selected = tabIndex === safeIndex;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
}

if (hasHero) {
  heroTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetIndex = Number(tab.dataset.index ?? 0);
      renderHero(targetIndex);
    });
  });

  renderHero(0);
}

const revealTargets = document.querySelectorAll(".reveal, .reveal-item");

revealTargets.forEach((node, index) => {
  if (node.classList.contains("reveal-item")) {
    node.style.setProperty("--stagger", `${(index % 6) * 0.08}s`);
  }
});

if (prefersReducedMotion) {
  revealTargets.forEach((node) => node.classList.add("is-visible"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -8% 0px",
    },
  );

  revealTargets.forEach((node) => revealObserver.observe(node));
}

function loadNaverMapsSdk(clientId) {
  if (window.naver?.maps) {
    return Promise.resolve();
  }

  const scriptId = "naver-maps-sdk";
  const existingScript = document.getElementById(scriptId);

  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("SDK_LOAD_FAILED")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const sdk = document.createElement("script");
    sdk.id = scriptId;
    sdk.async = true;
    sdk.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    sdk.addEventListener("load", () => resolve(), { once: true });
    sdk.addEventListener("error", () => reject(new Error("SDK_LOAD_FAILED")), { once: true });
    document.head.appendChild(sdk);
  });
}

async function initLocationMap() {
  const mapElement = document.querySelector("#naver-map");
  if (!mapElement) {
    return;
  }

  mapElement.textContent = "지도를 불러오는 중입니다...";

  try {
    const response = await fetch("/api/naver-map-data", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      let reason = `MAP_DATA_FAILED_${response.status}`;
      try {
        const errorBody = await response.json();
        if (typeof errorBody?.message === "string" && errorBody.message.trim()) {
          reason = errorBody.message;
        }
      } catch (_) {
        // Ignore response body parse errors.
      }
      throw new Error(reason);
    }

    const mapData = await response.json();

    if (!mapData?.clientId || !mapData?.center) {
      throw new Error("INVALID_MAP_DATA");
    }

    if (typeof mapData.message === "string" && mapData.message.trim()) {
      console.warn("[map]", mapData.message);
    }

    await loadNaverMapsSdk(mapData.clientId);

    if (!window.naver?.maps) {
      throw new Error("SDK_NOT_READY");
    }

    mapElement.textContent = "";
    mapElement.classList.add("is-ready");

    const center = new window.naver.maps.LatLng(mapData.center.lat, mapData.center.lng);
    const map = new window.naver.maps.Map(mapElement, {
      center,
      zoom: 14,
      zoomControl: true,
      zoomControlOptions: {
        position: window.naver.maps.Position.TOP_RIGHT,
      },
    });

    new window.naver.maps.Marker({
      position: center,
      map,
      title: "한국마린조선",
    });
  } catch (error) {
    console.error(error);
    mapElement.classList.remove("is-ready");
    const detail = String(error?.message || "");

    if (detail.includes("404")) {
      mapElement.textContent = "지도 API 경로(/api/naver-map-data)를 찾지 못했습니다. Vercel 배포 환경에서 확인해 주세요.";
      return;
    }

    if (detail.includes("SDK_LOAD_FAILED") || detail.includes("SDK_NOT_READY")) {
      mapElement.textContent = "네이버 지도 SDK 로드에 실패했습니다. 도메인 허용(URL) 설정을 확인해 주세요.";
      return;
    }

    mapElement.textContent = "지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

initLocationMap();
