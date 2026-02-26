(function () {
  "use strict";

  const AUTH_EVENT_NAME = "kms-admin-auth-change";
  const ADMIN_TOKEN_STORAGE_KEY = "kms_admin_access_token";
  const ADMIN_EMAIL_STORAGE_KEY = "kms_admin_email";
  const ADMIN_LOGIN_ENDPOINT = "/api/admin-login";
  const ADMIN_SESSION_ENDPOINT = "/api/admin-session";
  const SITE_CONTENT_ENDPOINT = "/api/site-content";
  const UPLOAD_ASSET_ENDPOINT = "/api/upload-asset";
  const PUBLIC_CONFIG_ENDPOINT = "/api/public-config";
  const MAX_ASSET_BYTES = 50 * 1024 * 1024;

  const adminState = {
    token: "",
    email: "",
    loggedIn: false,
  };

  const siteContentState = {
    content: {},
    loaded: false,
  };

  const adminControlledElements = new Set();
  let loginModalRefs = null;
  let editorModalRefs = null;
  let publicUploadConfigPromise = null;

  function safeSessionStorageGet(key) {
    try {
      return String(window.sessionStorage.getItem(key) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function safeSessionStorageSet(key, value) {
    try {
      if (!value) {
        window.sessionStorage.removeItem(key);
        return;
      }
      window.sessionStorage.setItem(key, value);
    } catch (_) {
      // Ignore storage errors.
    }
  }

  function safeLocalStorageGet(key) {
    try {
      return String(window.localStorage.getItem(key) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function safeLocalStorageSet(key, value) {
    try {
      if (!value) {
        window.localStorage.removeItem(key);
        return;
      }
      window.localStorage.setItem(key, value);
    } catch (_) {
      // Ignore storage errors.
    }
  }

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sanitizePathSegment(value) {
    return String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function splitFileName(fileName) {
    const raw = String(fileName || "").trim();
    const lastDotIndex = raw.lastIndexOf(".");
    if (lastDotIndex <= 0 || lastDotIndex === raw.length - 1) {
      return {
        base: raw || "asset",
        ext: "bin",
      };
    }

    return {
      base: raw.slice(0, lastDotIndex),
      ext: raw.slice(lastDotIndex + 1),
    };
  }

  function encodeObjectPath(path) {
    return String(path || "")
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  }

  function updateAdminElementVisibility() {
    adminControlledElements.forEach((element) => {
      element.hidden = !adminState.loggedIn;
    });
  }

  function dispatchAdminAuthChange() {
    updateAdminElementVisibility();
    window.dispatchEvent(
      new CustomEvent(AUTH_EVENT_NAME, {
        detail: {
          loggedIn: adminState.loggedIn,
          email: adminState.email,
        },
      }),
    );
  }

  function setAdminAuth(token, email) {
    adminState.token = String(token || "").trim();
    adminState.email = String(email || "").trim();
    adminState.loggedIn = Boolean(adminState.token && adminState.email);
    safeSessionStorageSet(ADMIN_TOKEN_STORAGE_KEY, adminState.token);
    safeSessionStorageSet(ADMIN_EMAIL_STORAGE_KEY, adminState.email);
    safeLocalStorageSet(ADMIN_TOKEN_STORAGE_KEY, adminState.token);
    safeLocalStorageSet(ADMIN_EMAIL_STORAGE_KEY, adminState.email);
    syncFooterAdminTriggerText();
    dispatchAdminAuthChange();
  }

  function clearAdminAuth() {
    setAdminAuth("", "");
  }

  function isAdminLoggedIn() {
    return adminState.loggedIn;
  }

  function getAdminToken() {
    return adminState.token;
  }

  async function readErrorMessage(response, fallbackMessage) {
    try {
      const payload = await response.json();
      const detail =
        typeof payload?.detail === "string" && payload.detail.trim()
          ? payload.detail.trim()
          : "";
      if (typeof payload?.message === "string" && payload.message.trim()) {
        const message = payload.message.trim();
        if (detail && /실패/.test(message)) {
          return `${message} (${detail})`;
        }
        return message;
      }
      if (detail) {
        return detail;
      }
    } catch (_) {
      // Ignore parse errors.
    }

    return fallbackMessage;
  }

  async function verifyAdminToken(token) {
    if (!token) {
      return {
        ok: false,
        message: "로그인이 필요합니다.",
      };
    }

    try {
      const response = await fetch(ADMIN_SESSION_ENDPOINT, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "관리자 세션 확인에 실패했습니다.");
        return {
          ok: false,
          message,
        };
      }

      const payload = await response.json();
      const email = String(payload?.email || "").trim();
      if (!email) {
        return {
          ok: false,
          message: "유효한 관리자 계정이 아닙니다.",
        };
      }

      return {
        ok: true,
        email,
      };
    } catch (_) {
      return {
        ok: false,
        message: "관리자 세션 확인 중 연결 오류가 발생했습니다.",
      };
    }
  }

  async function bootstrapAdminAuthFromStorage() {
    const token = safeSessionStorageGet(ADMIN_TOKEN_STORAGE_KEY)
      || safeLocalStorageGet(ADMIN_TOKEN_STORAGE_KEY);
    const email = safeSessionStorageGet(ADMIN_EMAIL_STORAGE_KEY)
      || safeLocalStorageGet(ADMIN_EMAIL_STORAGE_KEY);

    if (!token) {
      clearAdminAuth();
      return;
    }

    const verified = await verifyAdminToken(token);
    if (!verified.ok) {
      clearAdminAuth();
      return;
    }

    setAdminAuth(token, verified.email || email);
  }

  function syncFooterAdminTriggerText() {
    document.querySelectorAll("[data-admin-login-trigger]").forEach((button) => {
      button.textContent = adminState.loggedIn ? "관리자" : "로그인";
      button.setAttribute("aria-label", adminState.loggedIn ? "관리자 메뉴 열기" : "관리자 로그인 열기");
    });
  }

  function registerAdminControlledElement(element) {
    if (!element) {
      return element;
    }
    adminControlledElements.add(element);
    element.hidden = !adminState.loggedIn;
    return element;
  }

  function ensureFooterAdminTrigger() {
    const representativeRows = Array.from(document.querySelectorAll(".footer-inner p"))
      .filter((node) => node.textContent.includes("대표자"));

    representativeRows.forEach((row) => {
      if (row.querySelector("[data-admin-login-trigger]")) {
        return;
      }

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "footer-admin-trigger";
      trigger.dataset.adminLoginTrigger = "true";
      trigger.textContent = "로그인";
      trigger.addEventListener("click", () => {
        openLoginModal();
      });

      row.append(" ");
      row.appendChild(trigger);
    });

    syncFooterAdminTriggerText();
  }

  function ensureLoginModal() {
    if (loginModalRefs) {
      return loginModalRefs;
    }

    const root = document.createElement("div");
    root.className = "admin-login-modal";
    root.hidden = true;
    root.innerHTML = `
      <div class="admin-login-backdrop" data-close-login-modal="true"></div>
      <section class="admin-login-panel" role="dialog" aria-modal="true" aria-label="관리자 로그인">
        <button class="admin-login-close" type="button" data-close-login-modal="true" aria-label="닫기">&times;</button>
        <p class="admin-login-eyebrow">ADMIN</p>
        <h2>관리자 로그인</h2>
        <p class="admin-login-copy">로그인 후 페이지별 수정 버튼으로 콘텐츠를 변경할 수 있습니다.</p>
        <form id="footer-admin-login-form" class="admin-login-form" autocomplete="on">
          <label for="footer-admin-email">이메일</label>
          <input id="footer-admin-email" name="email" type="email" required placeholder="관리자 이메일">
          <label for="footer-admin-password">비밀번호</label>
          <input id="footer-admin-password" name="password" type="password" required placeholder="비밀번호">
          <button class="btn btn-primary" type="submit">로그인</button>
        </form>
        <div id="footer-admin-session-box" class="admin-login-session" hidden>
          <p id="footer-admin-session-email" class="board-status is-ok"></p>
          <button id="footer-admin-logout-btn" class="btn btn-ghost" type="button">로그아웃</button>
        </div>
        <p id="footer-admin-login-status" class="board-status">푸터 로그인은 관리자 전용입니다.</p>
      </section>
    `;

    document.body.appendChild(root);

    const form = root.querySelector("#footer-admin-login-form");
    const emailInput = root.querySelector("#footer-admin-email");
    const passwordInput = root.querySelector("#footer-admin-password");
    const sessionBox = root.querySelector("#footer-admin-session-box");
    const sessionEmail = root.querySelector("#footer-admin-session-email");
    const logoutButton = root.querySelector("#footer-admin-logout-btn");
    const status = root.querySelector("#footer-admin-login-status");

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

    function syncSessionUi() {
      const loggedIn = adminState.loggedIn;
      form.hidden = loggedIn;
      sessionBox.hidden = !loggedIn;
      sessionEmail.textContent = loggedIn ? `${adminState.email} 로그인 상태` : "";
      if (!loggedIn) {
        setStatus("푸터 로그인은 관리자 전용입니다.");
      }
    }

    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.dataset.closeLoginModal === "true") {
        closeLoginModal();
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = String(emailInput.value || "").trim();
      const password = String(passwordInput.value || "").trim();
      if (!email || !password) {
        setStatus("이메일과 비밀번호를 입력해 주세요.", "error");
        return;
      }

      try {
        setStatus("관리자 로그인 중...");
        const response = await fetch(ADMIN_LOGIN_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const message = await readErrorMessage(response, "관리자 로그인에 실패했습니다.");
          throw new Error(message);
        }

        const payload = await response.json();
        const accessToken = String(payload?.accessToken || "").trim();
        const verifiedEmail = String(payload?.email || email).trim();

        if (!accessToken || !verifiedEmail) {
          throw new Error("로그인 토큰을 발급받지 못했습니다.");
        }

        setAdminAuth(accessToken, verifiedEmail);
        setStatus("관리자 로그인 완료", "ok");
        form.reset();
        syncSessionUi();
        closeLoginModal();

        if (document.querySelector("[data-board-root]")) {
          window.location.reload();
          return;
        }
      } catch (error) {
        setStatus(String(error?.message || "관리자 로그인에 실패했습니다."), "error");
      }
    });

    logoutButton.addEventListener("click", () => {
      clearAdminAuth();
      syncSessionUi();
      setStatus("로그아웃되었습니다.");
      if (document.querySelector("[data-board-root]")) {
        window.location.reload();
      }
    });

    window.addEventListener(AUTH_EVENT_NAME, syncSessionUi);
    syncSessionUi();

    loginModalRefs = {
      root,
      emailInput,
      setStatus,
      syncSessionUi,
    };

    return loginModalRefs;
  }

  function openLoginModal() {
    const modal = ensureLoginModal();
    modal.root.hidden = false;
    document.body.classList.add("admin-modal-open");
    modal.syncSessionUi();
    if (!adminState.loggedIn) {
      modal.emailInput.focus();
    }
  }

  function closeLoginModal() {
    if (!loginModalRefs) {
      return;
    }

    loginModalRefs.root.hidden = true;
    document.body.classList.remove("admin-modal-open");
  }

  function ensureEditorModal() {
    if (editorModalRefs) {
      return editorModalRefs;
    }

    const root = document.createElement("div");
    root.className = "admin-editor-modal";
    root.hidden = true;
    root.innerHTML = `
      <div class="admin-editor-backdrop" data-close-editor-modal="true"></div>
      <section class="admin-editor-panel" role="dialog" aria-modal="true" aria-label="관리자 수정 패널">
        <button class="admin-editor-close" type="button" data-close-editor-modal="true" aria-label="닫기">&times;</button>
        <p class="admin-login-eyebrow">EDIT</p>
        <h2 id="admin-editor-title">콘텐츠 수정</h2>
        <form id="admin-editor-form">
          <div id="admin-editor-body" class="admin-editor-body"></div>
          <p id="admin-editor-status" class="board-status"></p>
          <div class="admin-editor-actions">
            <button id="admin-editor-cancel" class="btn btn-ghost" type="button">취소</button>
            <button id="admin-editor-save" class="btn btn-primary" type="submit">저장</button>
          </div>
        </form>
      </section>
    `;

    document.body.appendChild(root);

    const title = root.querySelector("#admin-editor-title");
    const body = root.querySelector("#admin-editor-body");
    const status = root.querySelector("#admin-editor-status");
    const form = root.querySelector("#admin-editor-form");
    const saveButton = root.querySelector("#admin-editor-save");
    const cancelButton = root.querySelector("#admin-editor-cancel");
    let currentReader = null;
    let currentSaver = null;

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

    function close() {
      root.hidden = true;
      document.body.classList.remove("admin-modal-open");
      setStatus("");
      currentReader = null;
      currentSaver = null;
    }

    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.dataset.closeEditorModal === "true") {
        close();
      }
    });

    cancelButton.addEventListener("click", () => {
      close();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (typeof currentReader !== "function" || typeof currentSaver !== "function") {
        return;
      }

      try {
        saveButton.disabled = true;
        setStatus("저장 중...");
        const payload = currentReader();
        await currentSaver(payload);
        setStatus("저장 완료", "ok");
        window.setTimeout(() => {
          close();
        }, 240);
      } catch (error) {
        setStatus(String(error?.message || "저장에 실패했습니다."), "error");
      } finally {
        saveButton.disabled = false;
      }
    });

    editorModalRefs = {
      root,
      title,
      body,
      saveButton,
      setStatus,
      open(config) {
        title.textContent = config.title;
        saveButton.textContent = config.saveLabel || "저장";
        body.innerHTML = "";
        currentReader = config.buildBody(body);
        currentSaver = config.onSave;
        setStatus("");
        root.hidden = false;
        document.body.classList.add("admin-modal-open");
      },
    };

    return editorModalRefs;
  }

  function createEditorRow(label, input) {
    const row = document.createElement("div");
    row.className = "admin-field-row";

    const caption = document.createElement("label");
    caption.className = "admin-field-label";
    caption.textContent = label;

    row.appendChild(caption);
    row.appendChild(input);
    return row;
  }

  function createInput(type, placeholder, value = "") {
    const input = document.createElement("input");
    input.type = type;
    input.className = "admin-field-input";
    input.placeholder = placeholder;
    input.value = value;
    return input;
  }

  function createTextarea(placeholder, value = "", rows = 3) {
    const textarea = document.createElement("textarea");
    textarea.className = "admin-field-textarea";
    textarea.placeholder = placeholder;
    textarea.rows = rows;
    textarea.value = value;
    return textarea;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("FILE_READ_FAILED"));
      reader.readAsDataURL(file);
    });
  }

  async function getPublicUploadConfig() {
    if (!publicUploadConfigPromise) {
      publicUploadConfigPromise = fetch(PUBLIC_CONFIG_ENDPOINT, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      })
        .then(async (response) => {
          if (!response.ok) {
            const message = await readErrorMessage(response, "공개 업로드 설정을 불러오지 못했습니다.");
            throw new Error(message);
          }
          return response.json();
        })
        .then((payload) => {
          const supabaseUrl = String(payload?.supabaseUrl || "").trim().replace(/\/$/, "");
          const supabaseAnonKey = String(payload?.supabaseAnonKey || "").trim();
          const storageBucket = String(payload?.storageBucket || "site-assets").trim();

          if (!supabaseUrl || !supabaseAnonKey || !storageBucket) {
            throw new Error("업로드 설정이 올바르지 않습니다.");
          }

          return {
            supabaseUrl,
            supabaseAnonKey,
            storageBucket,
          };
        })
        .catch((error) => {
          publicUploadConfigPromise = null;
          throw error;
        });
    }

    return publicUploadConfigPromise;
  }

  function buildAssetObjectPath(fileName, folder) {
    const safeFolder = sanitizePathSegment(folder || "cms-assets") || "cms-assets";
    const { base, ext } = splitFileName(fileName);
    const safeBase = sanitizePathSegment(base) || "asset";
    const safeExt = sanitizePathSegment(ext) || "bin";
    const stamp = Date.now();
    const random = Math.random().toString(36).slice(2, 9);
    return `${safeFolder}/${stamp}-${random}-${safeBase}.${safeExt}`;
  }

  async function uploadAssetDirectToStorage(file, folder) {
    if (!isAdminLoggedIn()) {
      throw new Error("관리자 로그인 후 업로드할 수 있습니다.");
    }

    const config = await getPublicUploadConfig();
    const objectPath = buildAssetObjectPath(file?.name, folder);
    const encodedPath = encodeObjectPath(objectPath);
    const uploadUrl = `${config.supabaseUrl}/storage/v1/object/${config.storageBucket}/${encodedPath}`;

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${getAdminToken()}`,
        "Content-Type": String(file?.type || "application/octet-stream"),
        "x-upsert": "true",
      },
      body: file,
    });

    if (!response.ok) {
      const message = await readErrorMessage(response, "스토리지 직접 업로드에 실패했습니다.");
      throw new Error(message);
    }

    return `${config.supabaseUrl}/storage/v1/object/public/${config.storageBucket}/${encodedPath}`;
  }

  async function uploadAssetFile(file, folder) {
    try {
      return await uploadAssetDirectToStorage(file, folder);
    } catch (directError) {
      const canFallbackWithApi = Number(file?.size || 0) <= 2.8 * 1024 * 1024;
      if (!canFallbackWithApi) {
        throw directError;
      }
    }

    const dataUrl = await readFileAsDataUrl(file);
    const response = await fetch(UPLOAD_ASSET_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAdminToken()}`,
      },
      body: JSON.stringify({
        fileName: file.name,
        dataUrl,
        folder: folder || "cms-assets",
      }),
    });

    if (!response.ok) {
      const message = await readErrorMessage(response, "파일 업로드에 실패했습니다.");
      throw new Error(message);
    }

    const payload = await response.json();
    const url = String(payload?.url || "").trim();
    if (!url) {
      throw new Error("업로드 URL을 받지 못했습니다.");
    }

    return url;
  }

  function createAssetPickerField(targetInput, options = {}) {
    const {
      accept = "*/*",
      mimePrefix = "",
      folder = "cms-assets",
      clearLabel = "파일 제거",
      helpText = "파일 선택 시 즉시 적용됩니다. (50MB 이하)",
      typeName = "파일",
      previewType = "none",
    } = options;

    const wrapper = document.createElement("div");
    wrapper.className = "admin-image-picker";

    const controls = document.createElement("div");
    controls.className = "admin-image-picker-controls";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = accept;
    fileInput.className = "admin-file-input";

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "btn btn-ghost admin-inline-delete-btn";
    clearButton.textContent = clearLabel;

    controls.appendChild(fileInput);
    controls.appendChild(clearButton);

    const help = document.createElement("p");
    help.className = "admin-image-picker-help";
    help.textContent = helpText;

    const previewImage = document.createElement("img");
    previewImage.className = "admin-image-picker-preview";
    previewImage.alt = "선택 이미지 미리보기";

    const previewVideo = document.createElement("video");
    previewVideo.className = "admin-image-picker-preview";
    previewVideo.controls = true;
    previewVideo.preload = "metadata";
    previewVideo.muted = true;

    function setHelp(message, mode = "normal") {
      help.textContent = message;
      help.classList.remove("is-error", "is-ok");
      if (mode === "error") {
        help.classList.add("is-error");
      }
      if (mode === "ok") {
        help.classList.add("is-ok");
      }
    }

    function syncPreviewByValue() {
      const value = String(targetInput.value || "").trim();
      if (!value) {
        previewImage.hidden = true;
        previewImage.removeAttribute("src");
        previewVideo.hidden = true;
        previewVideo.removeAttribute("src");
        return;
      }

      if (previewType === "image") {
        previewImage.src = value;
        previewImage.hidden = false;
        previewVideo.hidden = true;
        previewVideo.removeAttribute("src");
        return;
      }

      if (previewType === "video") {
        previewVideo.src = value;
        previewVideo.hidden = false;
        previewImage.hidden = true;
        previewImage.removeAttribute("src");
        return;
      }

      previewImage.hidden = true;
      previewImage.removeAttribute("src");
      previewVideo.hidden = true;
      previewVideo.removeAttribute("src");
    }

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) {
        return;
      }

      if (mimePrefix && !String(file.type || "").startsWith(mimePrefix)) {
        setHelp(`${typeName} 파일만 선택할 수 있습니다.`, "error");
        return;
      }

      if (Number(file.size || 0) > MAX_ASSET_BYTES) {
        setHelp("파일 용량은 50MB 이하만 업로드할 수 있습니다.", "error");
        return;
      }

      try {
        setHelp("업로드 중입니다...");
        const uploadedUrl = await uploadAssetFile(file, folder);
        targetInput.value = uploadedUrl;
        syncPreviewByValue();
        setHelp(`업로드 완료: ${file.name}`, "ok");
      } catch (error) {
        setHelp(String(error?.message || "업로드 중 오류가 발생했습니다."), "error");
      }
    });

    clearButton.addEventListener("click", () => {
      targetInput.value = "";
      fileInput.value = "";
      syncPreviewByValue();
      setHelp(`${typeName}을(를) 제거했습니다.`, "ok");
    });

    targetInput.addEventListener("input", () => {
      syncPreviewByValue();
    });

    syncPreviewByValue();
    wrapper.appendChild(controls);
    wrapper.appendChild(help);
    wrapper.appendChild(previewImage);
    wrapper.appendChild(previewVideo);
    return wrapper;
  }

  function createImagePickerField(targetInput) {
    return createAssetPickerField(targetInput, {
      accept: "image/*",
      mimePrefix: "image/",
      folder: "cms-images",
      clearLabel: "이미지 제거",
      helpText: "파일 선택 시 즉시 적용됩니다. (50MB 이하)",
      typeName: "이미지",
      previewType: "image",
    });
  }

  function createVideoPickerField(targetInput) {
    return createAssetPickerField(targetInput, {
      accept: "video/*",
      mimePrefix: "video/",
      folder: "cms-videos",
      clearLabel: "영상 제거",
      helpText: "파일 선택 시 즉시 적용됩니다. (50MB 이하)",
      typeName: "영상",
      previewType: "video",
    });
  }

  async function loadSiteContent() {
    try {
      const response = await fetch(SITE_CONTENT_ENDPOINT, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("사이트 콘텐츠를 불러오지 못했습니다.");
      }

      const payload = await response.json();
      siteContentState.content = payload?.content && typeof payload.content === "object"
        ? payload.content
        : {};
      siteContentState.loaded = true;
    } catch (_) {
      siteContentState.content = {};
      siteContentState.loaded = true;
    }
  }

  async function saveSiteContentPatch(patch) {
    if (!isAdminLoggedIn()) {
      throw new Error("관리자 로그인 후 저장할 수 있습니다.");
    }

    const nextContent = {
      ...siteContentState.content,
      ...cloneValue(patch),
    };

    const response = await fetch(SITE_CONTENT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAdminToken()}`,
      },
      body: JSON.stringify({
        content: nextContent,
      }),
    });

    if (!response.ok) {
      const message = await readErrorMessage(response, "사이트 콘텐츠 저장에 실패했습니다.");
      throw new Error(message);
    }

    const payload = await response.json();
    siteContentState.content = payload?.content && typeof payload.content === "object"
      ? payload.content
      : nextContent;
  }

  function applyIndexHeroSlides() {
    if (!document.querySelector(".hero-stage")) {
      return;
    }
    if (typeof heroProducts === "undefined" || !Array.isArray(heroProducts)) {
      return;
    }

    const savedSlides = siteContentState.content?.indexHeroSlides;
    if (!Array.isArray(savedSlides) || !savedSlides.length) {
      return;
    }

    const limit = Math.min(savedSlides.length, heroProducts.length);
    for (let index = 0; index < limit; index += 1) {
      const next = savedSlides[index];
      if (!next || typeof next !== "object") {
        continue;
      }
      heroProducts[index] = {
        ...heroProducts[index],
        ...next,
      };
    }

    const tabs = Array.from(document.querySelectorAll(".hero-tab"));
    tabs.forEach((tab, index) => {
      if (!savedSlides[index]?.tab) {
        return;
      }
      tab.textContent = String(savedSlides[index].tab);
    });

    if (typeof renderHero === "function") {
      renderHero(0);
    }
  }

  function applyAboutVideo() {
    const sourceNode = document.querySelector(".about-video source");
    const videoNode = document.querySelector(".about-video");
    const savedSrc = String(siteContentState.content?.aboutIntroVideoSrc || "").trim();

    if (!sourceNode || !videoNode || !savedSrc) {
      return;
    }

    sourceNode.src = savedSrc;
    videoNode.load();
  }

  function renderProcessSteps(steps) {
    const timeline = document.querySelector(".process-timeline");
    if (!timeline || !Array.isArray(steps) || !steps.length) {
      return;
    }

    timeline.innerHTML = "";
    steps.forEach((stepTitle, index) => {
      const li = document.createElement("li");
      li.className = "process-step reveal-item";

      const order = document.createElement("span");
      order.className = "process-order";
      order.textContent = String(index + 1).padStart(2, "0");

      const body = document.createElement("div");
      body.className = "process-step-body";

      const heading = document.createElement("h3");
      heading.textContent = String(stepTitle || "").trim() || "공정 단계";

      body.appendChild(heading);
      li.appendChild(order);
      li.appendChild(body);
      timeline.appendChild(li);
    });
  }

  function applyProcessSteps() {
    const savedSteps = siteContentState.content?.processSteps;
    if (!Array.isArray(savedSteps) || !savedSteps.length) {
      return;
    }
    renderProcessSteps(savedSteps);
  }

  function getProductContainers() {
    const containers = Array.from(document.querySelectorAll(".tonnage-grid, #other-vessel .product-grid"));
    return containers.map((element, index) => {
      if (!element.dataset.productContainerId) {
        element.dataset.productContainerId = `pc-${index + 1}`;
      }

      const label = element.closest(".tonnage-group")?.querySelector(".tonnage-group-head h3")?.textContent?.trim()
        || element.closest("section")?.querySelector(".panel-head h2")?.textContent?.trim()
        || `그룹 ${index + 1}`;

      return {
        id: element.dataset.productContainerId,
        label,
        element,
      };
    });
  }

  function extractProductCardsFromDom(containerMeta) {
    const cards = [];
    containerMeta.forEach((container) => {
      const cardNodes = Array.from(container.element.querySelectorAll(".product-card"));
      cardNodes.forEach((cardNode, index) => {
        const image = cardNode.querySelector("img");
        const slot = cardNode.querySelector(".image-slot");
        const title = cardNode.querySelector(".card-body h3")?.textContent?.trim() || "제품";
        const description = cardNode.querySelector(".card-body p")?.textContent?.trim() || "";

        cards.push({
          id: cardNode.dataset.cmsCardId || `${container.id}-card-${index + 1}`,
          containerId: container.id,
          imageSrc: image ? String(image.getAttribute("src") || "").trim() : "",
          alt: image ? String(image.getAttribute("alt") || "").trim() : "",
          slotLabel: slot ? slot.textContent.trim() : "",
          title,
          description,
        });
      });
    });
    return cards;
  }

  function buildProductCardElement(item) {
    const card = document.createElement("article");
    card.className = "product-card reveal-item";
    card.dataset.cmsCardId = String(item.id || `card-${Date.now()}`);

    const imageSrc = String(item.imageSrc || "").trim();
    if (imageSrc) {
      const img = document.createElement("img");
      img.src = imageSrc;
      img.alt = String(item.alt || item.title || "제품 사진").trim();
      card.appendChild(img);
    } else {
      const slot = document.createElement("div");
      slot.className = "image-slot";
      slot.role = "img";
      slot.setAttribute("aria-label", String(item.alt || item.title || "이미지 슬롯").trim());
      slot.textContent = String(item.slotLabel || "이미지 슬롯").trim();
      card.appendChild(slot);
    }

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("h3");
    title.textContent = String(item.title || "제품명").trim();

    const description = document.createElement("p");
    description.textContent = String(item.description || "").trim();

    body.appendChild(title);
    body.appendChild(description);
    card.appendChild(body);
    return card;
  }

  function renderProductCards(cards, containerMeta) {
    const grouped = new Map();
    cards.forEach((item) => {
      const key = String(item.containerId || "");
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(item);
    });

    containerMeta.forEach((container) => {
      const rows = grouped.get(container.id) || [];
      container.element.innerHTML = "";
      rows.forEach((row) => {
        container.element.appendChild(buildProductCardElement(row));
      });
    });

    if (typeof initProductImageLightbox === "function") {
      initProductImageLightbox();
    }
  }

  function applyProductsContent() {
    if (!document.querySelector(".fishing-vessel-panel")) {
      return;
    }

    const containerMeta = getProductContainers();
    if (!containerMeta.length) {
      return;
    }

    const savedCards = siteContentState.content?.productCards;
    if (!Array.isArray(savedCards) || !savedCards.length) {
      return;
    }

    renderProductCards(savedCards, containerMeta);
  }

  function createSectionEditButton(parent, label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-ghost admin-edit-btn";
    button.textContent = label;
    button.addEventListener("click", onClick);
    parent.appendChild(button);
    registerAdminControlledElement(button);
    return button;
  }

  function initIndexEditor() {
    const heroActions = document.querySelector(".hero-actions");
    if (
      !document.querySelector(".hero-stage")
      || !heroActions
      || typeof heroProducts === "undefined"
      || !Array.isArray(heroProducts)
    ) {
      return;
    }

    createSectionEditButton(heroActions, "메인 수정", () => {
      const modal = ensureEditorModal();
      modal.open({
        title: "메인 배경/문구 수정",
        saveLabel: "메인 저장",
        buildBody(body) {
          const currentSlides = Array.isArray(siteContentState.content?.indexHeroSlides)
            ? cloneValue(siteContentState.content.indexHeroSlides)
            : (typeof heroProducts !== "undefined" && Array.isArray(heroProducts) ? cloneValue(heroProducts) : []);

          const slideRows = [];
          currentSlides.forEach((slide, index) => {
            const card = document.createElement("div");
            card.className = "admin-edit-card";

            const title = document.createElement("h3");
            title.textContent = `슬라이드 ${index + 1}`;
            card.appendChild(title);

            const tabInput = createInput("text", "탭명", slide.tab || "");
            const headingInput = createInput("text", "제목", slide.title || "");
            const descInput = createTextarea("설명", slide.description || "", 2);
            const metaInput = createInput("text", "메타 문구", slide.meta || "");
            const imageInput = createInput("text", "이미지 경로 또는 URL", slide.image || "");
            const positionInput = createInput("text", "배경 위치 (예: center 72%)", slide.position || "");

            card.appendChild(createEditorRow("탭명", tabInput));
            card.appendChild(createEditorRow("제목", headingInput));
            card.appendChild(createEditorRow("설명", descInput));
            card.appendChild(createEditorRow("메타", metaInput));
            card.appendChild(createEditorRow("이미지", imageInput));
            card.appendChild(createEditorRow("이미지 파일", createImagePickerField(imageInput)));
            card.appendChild(createEditorRow("위치", positionInput));
            body.appendChild(card);

            slideRows.push({
              tabInput,
              headingInput,
              descInput,
              metaInput,
              imageInput,
              positionInput,
            });
          });

          return () => slideRows.map((row, index) => ({
            ...(currentSlides[index] || {}),
            tab: row.tabInput.value.trim(),
            title: row.headingInput.value.trim(),
            description: row.descInput.value.trim(),
            meta: row.metaInput.value.trim(),
            image: row.imageInput.value.trim(),
            position: row.positionInput.value.trim(),
          }));
        },
        onSave: async (slides) => {
          await saveSiteContentPatch({
            indexHeroSlides: slides,
          });
          applyIndexHeroSlides();
        },
      });
    });
  }

  function initAboutEditor() {
    const panelHead = document.querySelector("#intro-video .panel-head");
    if (!panelHead) {
      return;
    }

    createSectionEditButton(panelHead, "영상 수정", () => {
      const modal = ensureEditorModal();
      modal.open({
        title: "회사소개 영상 수정",
        saveLabel: "영상 저장",
        buildBody(body) {
          const current = String(
            siteContentState.content?.aboutIntroVideoSrc
            || document.querySelector(".about-video source")?.getAttribute("src")
            || "",
          ).trim();

          const input = createInput("text", "영상 파일 경로 또는 URL", current);
          body.appendChild(createEditorRow("영상 소스", input));
          body.appendChild(createEditorRow("영상 파일", createVideoPickerField(input)));

          return () => ({
            aboutIntroVideoSrc: input.value.trim(),
          });
        },
        onSave: async (payload) => {
          await saveSiteContentPatch(payload);
          applyAboutVideo();
        },
      });
    });
  }

  function initProcessEditor() {
    const panelHead = document.querySelector("#process-flow .panel-head");
    if (!panelHead) {
      return;
    }

    createSectionEditButton(panelHead, "공정 수정", () => {
      const modal = ensureEditorModal();
      modal.open({
        title: "공정 과정 수정",
        saveLabel: "공정 저장",
        buildBody(body) {
          const initialSteps = Array.isArray(siteContentState.content?.processSteps) && siteContentState.content.processSteps.length
            ? cloneValue(siteContentState.content.processSteps)
            : Array.from(document.querySelectorAll(".process-step-body h3")).map((node) => node.textContent.trim());

          const list = document.createElement("div");
          list.className = "admin-dynamic-list";
          body.appendChild(list);

          const addButton = document.createElement("button");
          addButton.type = "button";
          addButton.className = "btn btn-ghost admin-inline-add-btn";
          addButton.textContent = "단계 추가";
          body.appendChild(addButton);

          const rows = [];

          function addRow(value = "") {
            const row = document.createElement("div");
            row.className = "admin-dynamic-row";

            const input = createInput("text", "공정 단계명", value);
            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "btn btn-ghost admin-inline-delete-btn";
            removeButton.textContent = "삭제";
            removeButton.addEventListener("click", () => {
              row.remove();
            });

            row.appendChild(input);
            row.appendChild(removeButton);
            list.appendChild(row);
            rows.push({ row, input });
          }

          initialSteps.forEach((step) => addRow(step));
          addButton.addEventListener("click", () => {
            addRow("");
          });

          return () => ({
            processSteps: rows
              .filter((row) => row.row.isConnected)
              .map((row) => row.input.value.trim())
              .filter(Boolean),
          });
        },
        onSave: async (payload) => {
          if (!Array.isArray(payload.processSteps) || !payload.processSteps.length) {
            throw new Error("공정 단계는 1개 이상이어야 합니다.");
          }
          await saveSiteContentPatch(payload);
          applyProcessSteps();
        },
      });
    });
  }

  function initProductsEditor() {
    const panelHead = document.querySelector("#fishing-boat .panel-head");
    if (!panelHead) {
      return;
    }

    createSectionEditButton(panelHead, "제품 수정", () => {
      const containerMeta = getProductContainers();
      const containerMap = new Map(containerMeta.map((row) => [row.id, row.label]));
      const modal = ensureEditorModal();

      modal.open({
        title: "생산 제품 수정",
        saveLabel: "제품 저장",
        buildBody(body) {
          const currentCards = Array.isArray(siteContentState.content?.productCards) && siteContentState.content.productCards.length
            ? cloneValue(siteContentState.content.productCards)
            : extractProductCardsFromDom(containerMeta);

          const rows = [];
          const list = document.createElement("div");
          list.className = "admin-dynamic-list";
          body.appendChild(list);

          const addButton = document.createElement("button");
          addButton.type = "button";
          addButton.className = "btn btn-ghost admin-inline-add-btn";
          addButton.textContent = "카드 추가";
          body.appendChild(addButton);

          function createContainerSelect(selectedId) {
            const select = document.createElement("select");
            select.className = "admin-field-select";
            containerMeta.forEach((container) => {
              const option = document.createElement("option");
              option.value = container.id;
              option.textContent = container.label;
              option.selected = container.id === selectedId;
              select.appendChild(option);
            });
            return select;
          }

          function addCardRow(item) {
            const row = document.createElement("div");
            row.className = "admin-edit-card";

            const heading = document.createElement("h3");
            heading.textContent = "제품 카드";
            row.appendChild(heading);

            const containerSelect = createContainerSelect(item.containerId || containerMeta[0]?.id || "");
            const imageInput = createInput("text", "이미지 경로(비우면 슬롯)", item.imageSrc || "");
            const titleInput = createInput("text", "카드 제목", item.title || "");
            const descInput = createTextarea("카드 설명", item.description || "", 2);
            const altInput = createInput("text", "대체 텍스트", item.alt || "");
            const slotLabelInput = createInput("text", "슬롯 라벨", item.slotLabel || "");

            row.appendChild(createEditorRow("배치 그룹", containerSelect));
            row.appendChild(createEditorRow("이미지", imageInput));
            row.appendChild(createEditorRow("이미지 파일", createImagePickerField(imageInput)));
            row.appendChild(createEditorRow("제목", titleInput));
            row.appendChild(createEditorRow("설명", descInput));
            row.appendChild(createEditorRow("대체 텍스트", altInput));
            row.appendChild(createEditorRow("슬롯 라벨", slotLabelInput));

            const actions = document.createElement("div");
            actions.className = "admin-row-actions";
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "btn btn-ghost admin-inline-delete-btn";
            deleteButton.textContent = "삭제";
            deleteButton.addEventListener("click", () => {
              row.remove();
            });
            actions.appendChild(deleteButton);
            row.appendChild(actions);

            list.appendChild(row);
            rows.push({
              row,
              containerSelect,
              imageInput,
              titleInput,
              descInput,
              altInput,
              slotLabelInput,
              id: item.id || `pc-card-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            });
          }

          currentCards.forEach((item) => {
            addCardRow(item);
          });

          addButton.addEventListener("click", () => {
            addCardRow({
              containerId: containerMeta[0]?.id || "",
              imageSrc: "",
              title: "새 제품",
              description: "",
              alt: "",
              slotLabel: "이미지 슬롯",
            });
          });

          return () => ({
            productCards: rows
              .filter((row) => row.row.isConnected)
              .map((row) => ({
                id: row.id,
                containerId: row.containerSelect.value,
                imageSrc: row.imageInput.value.trim(),
                title: row.titleInput.value.trim(),
                description: row.descInput.value.trim(),
                alt: row.altInput.value.trim(),
                slotLabel: row.slotLabelInput.value.trim(),
                containerLabel: containerMap.get(row.containerSelect.value) || "",
              }))
              .filter((item) => item.containerId && item.title),
          });
        },
        onSave: async (payload) => {
          if (!Array.isArray(payload.productCards) || !payload.productCards.length) {
            throw new Error("제품 카드는 1개 이상 유지해 주세요.");
          }
          await saveSiteContentPatch(payload);
          applyProductsContent();
        },
      });
    });
  }

  function initNoticeAdminControls() {
    const writeLink = document.querySelector("#board-write-link");
    if (writeLink) {
      registerAdminControlledElement(writeLink);
    }

    const writeRoot = document.querySelector("[data-board-write-root]");
    if (!writeRoot) {
      return;
    }

    const authGuide = writeRoot.querySelector("#board-write-auth");
    const form = writeRoot.querySelector("#board-write-form");
    if (!authGuide || !form) {
      return;
    }

    function syncWriteUi() {
      const visible = adminState.loggedIn;
      authGuide.hidden = visible;
      form.hidden = !visible;
    }

    window.addEventListener(AUTH_EVENT_NAME, syncWriteUi);
    syncWriteUi();
  }

  async function initAdminCms() {
    ensureFooterAdminTrigger();

    await bootstrapAdminAuthFromStorage();
    await loadSiteContent();

    applyIndexHeroSlides();
    applyAboutVideo();
    applyProcessSteps();
    applyProductsContent();

    initNoticeAdminControls();
    initIndexEditor();
    initAboutEditor();
    initProductsEditor();
    initProcessEditor();
  }

  initAdminCms();
})();

