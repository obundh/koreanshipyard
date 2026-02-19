const heroProducts = [
  {
    title: "고속 알루미늄 작업선",
    description: "항만 지원과 해상 작업에 최적화된 경량 선체로 기동성과 연료 효율을 동시에 확보합니다.",
    meta: "용도: 항만 지원 / 근해 작업",
    image: "sample-image-1.png",
  },
  {
    title: "고출력 항만 예인선",
    description: "협수로 조종 성능과 선회 안정성을 강화해 항만 입출항 지원 작업에 대응합니다.",
    meta: "용도: 예인 / 부두 지원",
    image: "sample-image-1.png",
  },
  {
    title: "대형 산업용 바지선",
    description: "플랫 데크와 보강 구조를 적용해 해상 구조물, 중량 화물 이송 프로젝트를 안정적으로 수행합니다.",
    meta: "용도: 화물 운송 / 해양 플랜트 지원",
    image: "sample-image-1.png",
  },
  {
    title: "연안 경비 순찰정",
    description: "파고 대응력을 높인 선체와 고속 추진 구성을 통해 신속한 연안 임무 수행이 가능합니다.",
    meta: "용도: 감시 / 구조 / 순찰",
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
let heroRotationTimer = null;

function renderHero(index) {
  if (!hasHero) {
    return;
  }
  const safeIndex = (index + heroProducts.length) % heroProducts.length;
  const product = heroProducts[safeIndex];
  activeHeroIndex = safeIndex;

  heroStage.style.backgroundImage =
    `linear-gradient(120deg, rgba(5, 20, 34, 0.7), rgba(8, 28, 45, 0.35) 45%, rgba(9, 45, 64, 0.7)), url("${product.image}")`;
  heroTitle.textContent = product.title;
  heroDesc.textContent = product.description;
  heroMeta.textContent = product.meta;

  heroTabs.forEach((tab, tabIndex) => {
    const selected = tabIndex === safeIndex;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
}

function setHeroRotation() {
  if (!hasHero) {
    return;
  }
  if (prefersReducedMotion || heroProducts.length <= 1) {
    return;
  }
  clearInterval(heroRotationTimer);
  heroRotationTimer = setInterval(() => {
    renderHero(activeHeroIndex + 1);
  }, 5200);
}

if (hasHero) {
  heroTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetIndex = Number(tab.dataset.index ?? 0);
      renderHero(targetIndex);
      setHeroRotation();
    });
  });

  renderHero(0);
  setHeroRotation();
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
