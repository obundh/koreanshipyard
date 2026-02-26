const heroProducts = [
  {
    title: "낚시선 생산 라인",
    description: "3톤부터 9.77톤급까지 현장 요구에 맞춘 낚시선을 안정적으로 제작합니다.",
    meta: "톤급: 3톤 ~ 9.77톤급",
    image: "shipphoto/낚시선_5.5t-6.67t_2.jpg",
    position: "center 90%",
  },
  {
    title: "어선 생산 라인",
    description: "3톤부터 50톤급까지 각 톤급별 몰드를 보유해 안정적인 생산이 가능합니다.",
    meta: "톤급: 3톤 ~ 50톤급 (각 톤급별 몰드 보유)",
    image: "shipphoto/어선_12t-19t_2.jpg",
    position: "center 70%",
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

function buildHeroGradient() {
  const rootStyles = getComputedStyle(document.documentElement);
  const deepRgb = rootStyles.getPropertyValue("--theme-deep-rgb").trim() || "6, 24, 56";
  const midRgb = rootStyles.getPropertyValue("--theme-mid-rgb").trim() || "20, 53, 108";
  return `linear-gradient(120deg, rgba(${deepRgb}, 0.28), rgba(${midRgb}, 0.12) 45%, rgba(${deepRgb}, 0.3))`;
}

function renderHero(index) {
  if (!hasHero) {
    return;
  }

  const safeIndex = (index + heroProducts.length) % heroProducts.length;
  const product = heroProducts[safeIndex];
  activeHeroIndex = safeIndex;
  const backgroundPosition = product.position ?? "center center";

  heroStage.style.backgroundImage =
    `${buildHeroGradient()}, url("${product.image}")`;
  heroStage.style.backgroundPosition = `center center, ${backgroundPosition}`;
  heroStage.style.backgroundSize = "cover, cover";
  heroStage.style.backgroundRepeat = "no-repeat, no-repeat";

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

const THEME_STORAGE_KEY = "kms_theme_key";
const CUSTOM_ACCENT_STORAGE_KEY = "kms_custom_accent";

const themePresets = {
  A: {
    bg: "#edf2f8",
    surface: "#ffffff",
    ink: "#10283f",
    inkSoft: "#4a5d72",
    primary: "#0f2f66",
    secondary: "#1d57b8",
    accent: "#0050b8",
    deep: "#061838",
    mid: "#14356c",
    soft: "#4090d0",
    overlay: "#091a39",
    brandTop: "#f4f9ff",
    brandMid: "#bcdcff",
    brandBottom: "#085ed6",
  },
  B: {
    bg: "#eff5f2",
    surface: "#ffffff",
    ink: "#193429",
    inkSoft: "#54695f",
    primary: "#1f4f3f",
    secondary: "#2f7c68",
    accent: "#2fa37f",
    deep: "#102c25",
    mid: "#2a6557",
    soft: "#85bfae",
    overlay: "#102a25",
    brandTop: "#f5fffb",
    brandMid: "#bde7d9",
    brandBottom: "#2f9b7e",
  },
  C: {
    bg: "#f7f2eb",
    surface: "#fffdf9",
    ink: "#352a1f",
    inkSoft: "#6f6256",
    primary: "#5a4730",
    secondary: "#9b7445",
    accent: "#c7863b",
    deep: "#2e2217",
    mid: "#6b4a27",
    soft: "#d0b089",
    overlay: "#332518",
    brandTop: "#fff7ec",
    brandMid: "#e4c89e",
    brandBottom: "#b9792e",
  },
  D: {
    bg: "#f5eff1",
    surface: "#fffafb",
    ink: "#352430",
    inkSoft: "#6e5965",
    primary: "#5a3247",
    secondary: "#8f4d6c",
    accent: "#be5f89",
    deep: "#2b1421",
    mid: "#66334d",
    soft: "#c79ab1",
    overlay: "#341826",
    brandTop: "#fff5fa",
    brandMid: "#e6b8cc",
    brandBottom: "#ad4f79",
  },
  E: {
    bg: "#eef1ef",
    surface: "#fbfdfc",
    ink: "#1f2e28",
    inkSoft: "#556560",
    primary: "#29443a",
    secondary: "#4a7565",
    accent: "#5c9d86",
    deep: "#13251f",
    mid: "#2f5649",
    soft: "#9ab9ad",
    overlay: "#172c24",
    brandTop: "#f3fff9",
    brandMid: "#bfded2",
    brandBottom: "#4c8f78",
  },
};

function normalizeHex(hex) {
  if (typeof hex !== "string") {
    return "#0050b8";
  }

  const value = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    return value.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const r = value[1];
    const g = value[2];
    const b = value[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return "#0050b8";
}

function hexToRgb(hex) {
  const safeHex = normalizeHex(hex);
  const value = safeHex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(rgb) {
  const toHex = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function mixHex(baseHex, targetHex, ratio) {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  const amount = Math.max(0, Math.min(1, ratio));

  return rgbToHex({
    r: base.r + (target.r - base.r) * amount,
    g: base.g + (target.g - base.g) * amount,
    b: base.b + (target.b - base.b) * amount,
  });
}

function rgbChannels(hex) {
  const rgb = hexToRgb(hex);
  return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
}

function buildCustomPalette(accentHex) {
  const accent = normalizeHex(accentHex);

  return {
    ...themePresets.A,
    bg: mixHex("#ffffff", accent, 0.06),
    primary: mixHex(accent, "#081d3b", 0.44),
    secondary: mixHex(accent, "#ffffff", 0.16),
    accent,
    deep: mixHex(accent, "#041325", 0.6),
    mid: mixHex(accent, "#0d2e58", 0.42),
    soft: mixHex(accent, "#ffffff", 0.46),
    overlay: mixHex(accent, "#061a33", 0.62),
    brandTop: "#f4f9ff",
    brandMid: mixHex(accent, "#ffffff", 0.62),
    brandBottom: accent,
  };
}

function setThemePalette(palette) {
  const root = document.documentElement;
  root.style.setProperty("--bg", palette.bg);
  root.style.setProperty("--surface", palette.surface);
  root.style.setProperty("--ink", palette.ink);
  root.style.setProperty("--ink-soft", palette.inkSoft);
  root.style.setProperty("--theme-primary", palette.primary);
  root.style.setProperty("--theme-secondary", palette.secondary);
  root.style.setProperty("--theme-accent", palette.accent);
  root.style.setProperty("--theme-accent-rgb", rgbChannels(palette.accent));
  root.style.setProperty("--theme-soft-rgb", rgbChannels(palette.soft));
  root.style.setProperty("--theme-deep-rgb", rgbChannels(palette.deep));
  root.style.setProperty("--theme-mid-rgb", rgbChannels(palette.mid));
  root.style.setProperty("--theme-overlay-rgb", rgbChannels(palette.overlay));
  root.style.setProperty("--brand-top", palette.brandTop);
  root.style.setProperty("--brand-mid", palette.brandMid);
  root.style.setProperty("--brand-bottom", palette.brandBottom);

  if (hasHero) {
    renderHero(activeHeroIndex);
  }
}

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {
    // Ignore storage failures.
  }
}

function initThemeCustomizer() {
  if (document.querySelector(".theme-switcher")) {
    return;
  }

  const savedTheme = readStorage(THEME_STORAGE_KEY) || "A";
  const savedCustomAccent = normalizeHex(readStorage(CUSTOM_ACCENT_STORAGE_KEY) || themePresets.A.accent);

  let currentThemeKey = themePresets[savedTheme] ? savedTheme : "A";
  let currentPalette = themePresets[currentThemeKey];

  if (savedTheme === "CUSTOM") {
    currentThemeKey = "CUSTOM";
    currentPalette = buildCustomPalette(savedCustomAccent);
  }

  setThemePalette(currentPalette);

  const switcher = document.createElement("aside");
  switcher.className = "theme-switcher";

  const presetButtons = Object.keys(themePresets)
    .map((key) => `<button type="button" class="theme-preset-btn" data-theme-key="${key}">${key}안</button>`)
    .join("");

  switcher.innerHTML = `
    <button type="button" class="theme-switcher-toggle" aria-expanded="true">A~E 컬러안 + RGB 팔레트</button>
    <div class="theme-switcher-body">
      <p class="theme-switcher-title">A안은 현재 기본 디자인입니다.</p>
      <div class="theme-preset-grid">${presetButtons}</div>
      <div class="theme-custom">
        <label for="theme-color-input">커스텀 포인트 컬러</label>
        <div class="theme-color-row">
          <input id="theme-color-input" class="theme-color-input" type="color" value="${currentPalette.accent}">
          <p class="theme-rgb" id="theme-rgb-value"></p>
        </div>
        <button type="button" class="theme-custom-apply">커스텀 적용</button>
      </div>
    </div>
  `;

  document.body.appendChild(switcher);

  const toggleButton = switcher.querySelector(".theme-switcher-toggle");
  const switcherBody = switcher.querySelector(".theme-switcher-body");
  const presetButtonNodes = Array.from(switcher.querySelectorAll(".theme-preset-btn"));
  const colorInput = switcher.querySelector(".theme-color-input");
  const rgbValue = switcher.querySelector("#theme-rgb-value");
  const customApply = switcher.querySelector(".theme-custom-apply");

  function updateRgbText(hex) {
    const rgb = hexToRgb(hex);
    rgbValue.textContent = `RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}`;
    rgbValue.setAttribute("title", "클릭하면 RGB 값이 복사됩니다.");
  }

  function updatePresetActive(themeKey) {
    presetButtonNodes.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.themeKey === themeKey);
    });
  }

  updateRgbText(currentPalette.accent);
  updatePresetActive(currentThemeKey);

  toggleButton.addEventListener("click", () => {
    const isExpanded = toggleButton.getAttribute("aria-expanded") === "true";
    toggleButton.setAttribute("aria-expanded", String(!isExpanded));
    switcherBody.hidden = isExpanded;
  });

  colorInput.addEventListener("input", () => {
    updateRgbText(colorInput.value);
  });

  rgbValue.addEventListener("click", async () => {
    const value = rgbValue.textContent.replace("RGB:", "").trim();
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      rgbValue.textContent = `복사됨: ${value}`;
      setTimeout(() => updateRgbText(colorInput.value), 900);
    } catch (_) {
      // Clipboard may be unavailable in some browsers.
    }
  });

  presetButtonNodes.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.themeKey;
      if (!key || !themePresets[key]) {
        return;
      }

      const palette = themePresets[key];
      currentThemeKey = key;
      currentPalette = palette;
      setThemePalette(palette);
      colorInput.value = palette.accent;
      updateRgbText(palette.accent);
      updatePresetActive(key);
      writeStorage(THEME_STORAGE_KEY, key);
    });
  });

  customApply.addEventListener("click", () => {
    const accent = normalizeHex(colorInput.value);
    const palette = buildCustomPalette(accent);
    currentThemeKey = "CUSTOM";
    currentPalette = palette;
    setThemePalette(palette);
    updateRgbText(accent);
    updatePresetActive("CUSTOM");
    writeStorage(THEME_STORAGE_KEY, "CUSTOM");
    writeStorage(CUSTOM_ACCENT_STORAGE_KEY, accent);
  });
}

initThemeCustomizer();

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

function initProductImageLightbox() {
  const productImages = document.querySelectorAll(".product-card img");

  if (!productImages.length) {
    return;
  }

  const lightbox = document.createElement("div");
  lightbox.className = "image-lightbox";
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.innerHTML = `
    <div class="image-lightbox-backdrop" data-close-lightbox="true"></div>
    <figure class="image-lightbox-figure" role="dialog" aria-modal="true" aria-label="확대 이미지 보기">
      <button type="button" class="image-lightbox-close" data-close-lightbox="true" aria-label="확대 이미지 닫기">&times;</button>
      <img src="" alt="">
      <figcaption></figcaption>
    </figure>
  `;

  document.body.appendChild(lightbox);

  const lightboxImage = lightbox.querySelector("img");
  const lightboxCaption = lightbox.querySelector("figcaption");
  let lastFocusedElement = null;

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");

    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
  }

  function openLightbox(image) {
    const src = image.getAttribute("src");
    const alt = image.getAttribute("alt") || "제품 사진";

    if (!src) {
      return;
    }

    lastFocusedElement = document.activeElement;
    lightboxImage.src = src;
    lightboxImage.alt = alt;
    lightboxCaption.textContent = alt;

    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
  }

  productImages.forEach((image) => {
    const alt = image.getAttribute("alt") || "제품 사진";
    image.setAttribute("tabindex", "0");
    image.setAttribute("role", "button");
    image.setAttribute("aria-label", `${alt} 크게 보기`);

    image.addEventListener("click", () => {
      openLightbox(image);
    });

    image.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openLightbox(image);
    });
  });

  lightbox.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.dataset.closeLightbox === "true") {
      closeLightbox();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox.classList.contains("is-open")) {
      closeLightbox();
    }
  });
}

initProductImageLightbox();
