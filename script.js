const heroProducts = [
  {
    tab: "FRP 선박",
    title: "FRP 선박 건조 및 수리",
    description: "FRP 선박 건조 및 수리 작업을 현장 맞춤형으로 안정적으로 수행합니다.",
    meta: "주요 업무: FRP 선박 건조 및 수리",
    image: "shipphoto/낚시선_5.5t-6.67t_2.jpg",
    position: "center 72%",
  },
  {
    tab: "낚시선",
    title: "낚시선 생산 라인",
    description: "3톤부터 9.77톤급까지 현장 요구에 맞춘 낚시선을 안정적으로 제작합니다.",
    meta: "톤급: 3톤 ~ 9.77톤급",
    image: "shipphoto/낚시선_5.5t-6.67t_2.jpg",
    position: "center 90%",
  },
  {
    tab: "어선",
    title: "어선 생산 라인",
    description: "3톤부터 50톤급까지 각 톤급별 몰드를 보유해 안정적인 생산이 가능합니다.",
    meta: "톤급: 3톤 ~ 50톤급 (각 톤급별 몰드 보유)",
    image: "shipphoto/어선_12t-19t_2.jpg",
    position: "center 70%",
  },
  {
    tab: "기타선박(통선)",
    title: "기타선박(통선) 생산 라인",
    description: "7.93톤부터 9.77톤급 통선 생산 기준에 맞춰 품질과 납기를 관리합니다.",
    meta: "톤급: 7.93톤 ~ 9.77톤급",
    image: "sample-image-1.png",
    position: "center center",
  },
];

const ADMIN_TOKEN_STORAGE_KEY = "kms_admin_access_token";
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
  const deepRgb = rootStyles.getPropertyValue("--theme-deep-rgb").trim() || "1, 18, 56";
  const midRgb = rootStyles.getPropertyValue("--theme-mid-rgb").trim() || "18, 58, 130";
  return `linear-gradient(120deg, rgba(${deepRgb}, 0.28), rgba(${midRgb}, 0.12) 45%, rgba(${deepRgb}, 0.3))`;
}

function renderHero(index) {
  if (!hasHero) {
    return;
  }

  const safeIndex = (index + heroProducts.length) % heroProducts.length;
  const product = heroProducts[safeIndex];
  const backgroundPosition = product.position || "center center";
  activeHeroIndex = safeIndex;

  heroStage.style.backgroundImage = `${buildHeroGradient()}, url("${product.image}")`;
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
    tab.textContent = heroProducts[tabIndex]?.tab || tab.textContent;
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
      throw new Error(`MAP_DATA_FAILED_${response.status}`);
    }

    const mapData = await response.json();
    if (!mapData?.clientId || !mapData?.center) {
      throw new Error("INVALID_MAP_DATA");
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
      mapElement.textContent = "지도 API 경로(/api/naver-map-data)를 찾지 못했습니다.";
      return;
    }

    if (detail.includes("SDK_LOAD_FAILED") || detail.includes("SDK_NOT_READY")) {
      mapElement.textContent = "네이버 지도 SDK 로드에 실패했습니다. 도메인 허용 설정을 확인해 주세요.";
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

  if (!window.__kmsLightboxState) {
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

    window.__kmsLightboxState = { openLightbox };
  }

  const lightboxState = window.__kmsLightboxState;
  productImages.forEach((image) => {
    if (image.dataset.lightboxBound === "true") {
      return;
    }

    const alt = image.getAttribute("alt") || "제품 사진";
    image.setAttribute("tabindex", "0");
    image.setAttribute("role", "button");
    image.setAttribute("aria-label", `${alt} 크게 보기`);

    image.addEventListener("click", () => lightboxState.openLightbox(image));
    image.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      lightboxState.openLightbox(image);
    });

    image.dataset.lightboxBound = "true";
  });
}

initProductImageLightbox();

function formatBoardDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${d} ${hh}:${mm}`;
}

function readAdminToken() {
  try {
    return String(window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "").trim();
  } catch (_) {
    return "";
  }
}

function clearAdminToken() {
  try {
    window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch (_) {
    // Ignore storage access errors.
  }
}

async function readErrorMessage(response, fallbackMessage) {
  try {
    const payload = await response.json();
    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    if (typeof payload?.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
  } catch (_) {
    // Ignore parse errors.
  }
  return fallbackMessage;
}

function createBoardItem(post, options = {}) {
  const item = document.createElement("li");
  item.className = "board-post-item";

  const top = document.createElement("div");
  top.className = "board-post-top";

  const title = document.createElement("p");
  title.className = "board-post-title";
  title.textContent = String(post?.title || "(제목 없음)");

  const date = document.createElement("span");
  date.className = "board-post-date";
  date.textContent = formatBoardDate(post?.created_at);

  const meta = document.createElement("p");
  meta.className = "board-post-meta";
  meta.textContent = post?.author ? `작성자: ${post.author}` : "작성자: 미기재";

  const content = document.createElement("p");
  content.className = "board-post-content";
  content.textContent = String(post?.content || "");

  const actions = document.createElement("div");
  actions.className = "board-post-actions";

  const attachmentUrl = String(post?.attachment_url || "").trim();
  const attachmentName = String(post?.attachment_name || "").trim();
  if (attachmentUrl) {
    const attachmentLink = document.createElement("a");
    attachmentLink.className = "board-attachment-link";
    attachmentLink.href = attachmentUrl;
    attachmentLink.target = "_blank";
    attachmentLink.rel = "noopener";
    attachmentLink.textContent = attachmentName || "첨부 파일 열기";
    actions.appendChild(attachmentLink);
  }

  if (options.canDelete && typeof options.onDelete === "function") {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-ghost board-delete-btn";
    deleteButton.textContent = "삭제";
    deleteButton.addEventListener("click", () => options.onDelete(post));
    actions.appendChild(deleteButton);
  }

  top.appendChild(title);
  top.appendChild(date);
  item.appendChild(top);
  item.appendChild(meta);
  item.appendChild(content);
  if (actions.childElementCount) {
    item.appendChild(actions);
  }

  return item;
}

async function initBoard() {
  const root = document.querySelector("[data-board-root]");
  if (!root) {
    return;
  }

  const postList = root.querySelector("#board-post-list");
  const status = root.querySelector("#board-status");
  if (!postList || !status) {
    return;
  }

  let canManage = Boolean(readAdminToken());

  function setStatus(message, mode = "normal") {
    status.textContent = message;
    status.classList.remove("is-error", "is-ok");
    if (mode === "error") {
      status.classList.add("is-error");
    }
    if (mode === "ok") {
      status.classList.add("is-ok");
    }
  }

  function renderEmpty(message) {
    postList.innerHTML = "";
    const empty = document.createElement("li");
    empty.className = "board-empty";
    empty.textContent = message;
    postList.appendChild(empty);
  }

  async function deletePost(postId) {
    const token = readAdminToken();
    if (!token) {
      setStatus("관리자 로그인 후 삭제할 수 있습니다.", "error");
      return false;
    }

    if (!window.confirm("이 공지사항을 삭제하시겠습니까?")) {
      return false;
    }

    try {
      const response = await fetch(`/api/board-posts?id=${encodeURIComponent(String(postId || ""))}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "공지사항 삭제에 실패했습니다.");
        if (response.status === 401 || response.status === 403) {
          clearAdminToken();
          canManage = false;
        }
        throw new Error(message);
      }

      setStatus("공지사항을 삭제했습니다.", "ok");
      return true;
    } catch (error) {
      console.error(error);
      setStatus(String(error?.message || "공지사항 삭제에 실패했습니다."), "error");
      return false;
    }
  }

  async function loadPosts() {
    try {
      setStatus("공지사항을 불러오는 중입니다...");
      const response = await fetch("/api/board-posts?limit=20", { method: "GET" });
      if (!response.ok) {
        throw new Error(`LOAD_FAILED_${response.status}`);
      }

      const posts = await response.json();
      postList.innerHTML = "";

      if (!Array.isArray(posts) || !posts.length) {
        renderEmpty("등록된 공지사항이 없습니다.");
        setStatus("공지사항 0건", "ok");
        return;
      }

      posts.forEach((post) => {
        postList.appendChild(
          createBoardItem(post, {
            canDelete: canManage,
            onDelete: async (targetPost) => {
              const deleted = await deletePost(targetPost?.id);
              if (deleted) {
                await loadPosts();
              }
            },
          }),
        );
      });

      setStatus(`공지사항 ${posts.length}건`, "ok");
    } catch (error) {
      console.error(error);
      renderEmpty("공지사항을 불러오지 못했습니다.");
      setStatus("불러오기 실패: 서버 API(/api/board-posts) 설정을 확인해 주세요.", "error");
    }
  }

  window.addEventListener("kms-admin-auth-change", async (event) => {
    canManage = Boolean(event?.detail?.loggedIn) && Boolean(readAdminToken());
    await loadPosts();
  });

  window.addEventListener("focus", async () => {
    const next = Boolean(readAdminToken());
    if (next === canManage) {
      return;
    }
    canManage = next;
    await loadPosts();
  });

  await loadPosts();
}

initBoard();

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("FILE_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

async function uploadAttachmentFile(file, token) {
  const dataUrl = await readFileAsDataUrl(file);
  const response = await fetch("/api/upload-asset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      dataUrl,
      folder: "board-attachments",
    }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, "첨부 파일 업로드에 실패했습니다.");
    throw new Error(message);
  }

  const payload = await response.json();
  const url = String(payload?.url || "").trim();
  if (!url) {
    throw new Error("첨부 파일 URL을 받지 못했습니다.");
  }

  return {
    url,
    name: file.name,
  };
}

async function initBoardWritePage() {
  const root = document.querySelector("[data-board-write-root]");
  if (!root) {
    return;
  }

  const form = root.querySelector("#board-write-form");
  const authGuide = root.querySelector("#board-write-auth");
  const status = root.querySelector("#board-write-status");
  const attachmentInput = root.querySelector("#board-attachment");
  const attachmentMeta = root.querySelector("#board-attachment-meta");
  const attachmentClear = root.querySelector("#board-attachment-clear");
  if (!form || !authGuide || !status) {
    return;
  }

  const attachmentState = { url: "", name: "" };

  function setStatus(message, mode = "normal") {
    status.textContent = message;
    status.classList.remove("is-error", "is-ok");
    if (mode === "error") {
      status.classList.add("is-error");
    }
    if (mode === "ok") {
      status.classList.add("is-ok");
    }
  }

  function syncAttachmentUi() {
    if (!attachmentMeta || !attachmentClear) {
      return;
    }

    if (!attachmentState.url) {
      attachmentMeta.textContent = "첨부 파일 없음";
      attachmentClear.hidden = true;
      return;
    }

    attachmentMeta.textContent = `첨부됨: ${attachmentState.name}`;
    attachmentClear.hidden = false;
  }

  function clearAttachment() {
    attachmentState.url = "";
    attachmentState.name = "";
    if (attachmentInput) {
      attachmentInput.value = "";
    }
    syncAttachmentUi();
  }

  function syncWriteAccess() {
    const hasToken = Boolean(readAdminToken());
    authGuide.hidden = hasToken;
    form.hidden = !hasToken;
    form.classList.toggle("is-disabled", !hasToken);
    if (!hasToken) {
      clearAttachment();
    }
  }

  if (attachmentClear) {
    attachmentClear.addEventListener("click", () => clearAttachment());
  }

  if (attachmentInput) {
    attachmentInput.addEventListener("change", async () => {
      const file = attachmentInput.files?.[0];
      if (!file) {
        return;
      }

      const token = readAdminToken();
      if (!token) {
        setStatus("관리자 로그인 후 첨부할 수 있습니다.", "error");
        clearAttachment();
        syncWriteAccess();
        return;
      }

      if (Number(file.size || 0) > 4 * 1024 * 1024) {
        setStatus("첨부 파일은 4MB 이하만 업로드할 수 있습니다.", "error");
        clearAttachment();
        return;
      }

      try {
        setStatus("첨부 파일 업로드 중입니다...");
        const uploaded = await uploadAttachmentFile(file, token);
        attachmentState.url = uploaded.url;
        attachmentState.name = uploaded.name;
        syncAttachmentUi();
        setStatus("첨부 파일 업로드가 완료되었습니다.", "ok");
      } catch (error) {
        console.error(error);
        clearAttachment();
        setStatus(String(error?.message || "첨부 파일 업로드에 실패했습니다."), "error");
      }
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = readAdminToken();
    if (!token) {
      setStatus("관리자 로그인 후 이용해 주세요.", "error");
      syncWriteAccess();
      return;
    }

    const formData = new FormData(form);
    const author = String(formData.get("author") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const content = String(formData.get("content") || "").trim();

    if (!title || !content) {
      setStatus("제목과 내용은 필수 입력입니다.", "error");
      return;
    }

    try {
      setStatus("공지사항 등록 중입니다...");
      const response = await fetch("/api/board-posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          author,
          title,
          content,
          attachmentUrl: attachmentState.url,
          attachmentName: attachmentState.name,
        }),
      });

      if (!response.ok) {
        const errorMessage = await readErrorMessage(response, "공지사항 등록에 실패했습니다.");
        if (response.status === 401 || response.status === 403) {
          clearAdminToken();
          syncWriteAccess();
        }
        throw new Error(errorMessage);
      }

      form.reset();
      clearAttachment();
      setStatus("공지사항이 등록되었습니다.", "ok");
      window.setTimeout(() => {
        window.location.href = "notice.html";
      }, 600);
    } catch (error) {
      console.error(error);
      setStatus(String(error?.message || "공지사항 등록에 실패했습니다."), "error");
    }
  });

  window.addEventListener("kms-admin-auth-change", syncWriteAccess);
  window.addEventListener("focus", syncWriteAccess);
  syncAttachmentUi();
  syncWriteAccess();
}

initBoardWritePage();

function createBoardPreviewItem(post) {
  const item = document.createElement("li");
  item.className = "board-post-item";

  const top = document.createElement("div");
  top.className = "board-post-top";

  const title = document.createElement("p");
  title.className = "board-post-title";
  title.textContent = String(post?.title || "(제목 없음)");

  const date = document.createElement("span");
  date.className = "board-post-date";
  date.textContent = formatBoardDate(post?.created_at);

  const content = document.createElement("p");
  content.className = "board-post-content";
  content.textContent = String(post?.content || "");

  top.appendChild(title);
  top.appendChild(date);
  item.appendChild(top);
  item.appendChild(content);

  return item;
}

async function initBoardPreview() {
  const root = document.querySelector("[data-board-preview-root]");
  if (!root) {
    return;
  }

  const postList = root.querySelector("#board-preview-list");
  const status = root.querySelector("#board-preview-status");
  if (!postList || !status) {
    return;
  }

  function setStatus(message, mode = "normal") {
    status.textContent = message;
    status.classList.remove("is-error", "is-ok");
    if (mode === "error") {
      status.classList.add("is-error");
    }
    if (mode === "ok") {
      status.classList.add("is-ok");
    }
  }

  function renderEmpty(message) {
    postList.innerHTML = "";
    const empty = document.createElement("li");
    empty.className = "board-empty";
    empty.textContent = message;
    postList.appendChild(empty);
  }

  try {
    setStatus("최근 공지를 불러오는 중입니다...");
    const response = await fetch("/api/board-posts?limit=3", { method: "GET" });
    if (!response.ok) {
      throw new Error(`PREVIEW_LOAD_FAILED_${response.status}`);
    }

    const posts = await response.json();
    postList.innerHTML = "";

    if (!Array.isArray(posts) || !posts.length) {
      renderEmpty("등록된 공지사항이 없습니다.");
      setStatus("최근 공지 0건", "ok");
      return;
    }

    posts.forEach((post) => {
      postList.appendChild(createBoardPreviewItem(post));
    });
    setStatus(`최근 공지 ${posts.length}건`, "ok");
  } catch (error) {
    console.error(error);
    renderEmpty("공지사항을 불러오지 못했습니다.");
    setStatus("불러오기 실패: 서버 API(/api/board-posts) 설정을 확인해 주세요.", "error");
  }
}

initBoardPreview();
