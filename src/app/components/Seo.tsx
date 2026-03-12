import { useEffect } from "react";
import { useLocation } from "react-router-dom";

type SeoConfig = {
  title: string;
  description: string;
  keywords: string;
  path: string;
  robots?: string;
  jsonLd?: Record<string, unknown>;
};

const APP_URL = String(import.meta.env.VITE_APP_URL ?? "https://jobbridge.apexsight.co.za").replace(/\/+$/, "");
const DEFAULT_OG_IMAGE = `${APP_URL}/src/app/assets/apexsight_logo_transparent.png`;

function upsertMeta(selector: { name?: string; property?: string }, content: string) {
  const key = selector.name ? `meta[name="${selector.name}"]` : `meta[property="${selector.property}"]`;
  let element = document.head.querySelector(key) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    if (selector.name) element.name = selector.name;
    if (selector.property) element.setAttribute("property", selector.property);
    document.head.appendChild(element);
  }
  element.content = content;
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

function upsertJsonLd(data: Record<string, unknown> | undefined) {
  const id = "apexsight-seo-jsonld";
  const existing = document.getElementById(id);
  if (!data) {
    existing?.remove();
    return;
  }

  const script = existing ?? document.createElement("script");
  script.id = id;
  script.setAttribute("type", "application/ld+json");
  script.textContent = JSON.stringify(data);
  if (!existing) document.head.appendChild(script);
}

function getSeoConfig(pathname: string): SeoConfig {
  if (pathname === "/skilllink") {
    return {
      title: "SkillLink | AI Career Readiness, Skills Assessments, Jobs in South Africa",
      description:
        "SkillLink helps candidates build career-ready profiles with AI-supported skills assessments, verified credentials, and better access to jobs and career opportunities in South Africa.",
      keywords:
        "jobs south africa, careers south africa, AI career platform, skills assessment, job seekers, career readiness, verified skills, recruitment platform",
      path: "/skilllink",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "SkillLink",
        description:
          "AI-supported career readiness platform for candidates, skills assessments, verified credentials, and job opportunities in South Africa.",
        url: `${APP_URL}/skilllink`,
        about: ["jobs", "careers", "skills assessments", "AI career readiness"],
      },
    };
  }

  if (pathname === "/jobbridge") {
    return {
      title: "JobBridge | AI Recruiting Software, Hiring Workflow, Jobs and Talent Search",
      description:
        "JobBridge is an AI-assisted recruiting and hiring platform for employers to post jobs, search candidates, review talent fit, message applicants, and manage hiring workflows in one place.",
      keywords:
        "AI recruiting software, hiring platform, recruitment software, talent search, candidate matching, job posting platform, employer hiring, AI hiring",
      path: "/jobbridge",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "JobBridge",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "AI-assisted recruiting software for employers to manage jobs, candidate search, talent review, messaging, interviews, and hiring workflow.",
        url: `${APP_URL}/jobbridge`,
      },
    };
  }

  if (pathname === "/") {
    return {
      title: "ApexSight | AI Recruitment Platform, Jobs, Careers, Talent Search",
      description:
        "ApexSight connects SkillLink and JobBridge into one AI-powered recruitment platform for jobs, careers, candidate assessments, talent search, and modern hiring workflows.",
      keywords:
        "AI recruitment platform, jobs, careers, hiring platform, talent platform, candidate assessments, recruitment software, job search, employer hiring",
      path: "/",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "ApexSight",
        url: APP_URL,
        description:
          "AI-powered talent infrastructure connecting candidate career readiness and employer hiring workflows.",
        sameAs: [APP_URL],
      },
    };
  }

  return {
    title: "ApexSight Platform",
    description:
      "ApexSight recruitment and talent platform.",
    keywords: "ApexSight, jobs, careers, recruiting, talent platform",
    path: pathname,
    robots: "noindex, nofollow",
  };
}

export function Seo() {
  const location = useLocation();

  useEffect(() => {
    const config = getSeoConfig(location.pathname);
    const canonicalUrl = `${APP_URL}${config.path === "/" ? "" : config.path}`;
    const robots = config.robots ?? "index, follow";

    document.title = config.title;
    upsertMeta({ name: "description" }, config.description);
    upsertMeta({ name: "keywords" }, config.keywords);
    upsertMeta({ name: "robots" }, robots);
    upsertMeta({ property: "og:type" }, "website");
    upsertMeta({ property: "og:site_name" }, "ApexSight");
    upsertMeta({ property: "og:title" }, config.title);
    upsertMeta({ property: "og:description" }, config.description);
    upsertMeta({ property: "og:url" }, canonicalUrl);
    upsertMeta({ property: "og:image" }, DEFAULT_OG_IMAGE);
    upsertMeta({ name: "twitter:card" }, "summary_large_image");
    upsertMeta({ name: "twitter:title" }, config.title);
    upsertMeta({ name: "twitter:description" }, config.description);
    upsertMeta({ name: "twitter:image" }, DEFAULT_OG_IMAGE);
    upsertLink("canonical", canonicalUrl);
    upsertJsonLd(config.jsonLd);
  }, [location.pathname]);

  return null;
}
