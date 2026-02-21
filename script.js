const heroProducts = [
  {
    title: "낚시선 생산 라인",
    description: "3톤부터 9.77톤급까지 현장 요구에 맞춘 낚시선을 안정적으로 제작합니다.",
    meta: "선급: 3톤 ~ 9.77톤급",
    image: "sample-image-1.png",
  },
  {
    title: "어선 생산 라인",
    description: "3톤부터 50톤급까지 각 톤급별 몰드를 보유해 생산 대응이 가능합니다.",
    meta: "선급: 3톤 ~ 50톤급 (각 톤급별 몰드 보유)",
    image: "sample-image-1.png",
  },
  {
    title: "기타선박(통선) 생산 라인",
    description: "7.93톤부터 9.77톤급 통선 생산 기준에 맞춰 품질과 납기를 관리합니다.",
    meta: "선급: 7.93톤 ~ 9.77톤급",
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
