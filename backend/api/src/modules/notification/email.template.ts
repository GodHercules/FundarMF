import fs from "fs";
import path from "path";
import mjml2html from "mjml";

type EmailTemplatePayload = {
  title: string;
  body: string;
  preheader?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

type RenderedEmail = {
  html: string;
  text: string;
};

const cache = new Map<string, string>();

const resolveTemplatePath = (name: string) => {
  const envDir = process.env.NOTIFY_TEMPLATE_DIR?.trim();
  if (envDir && envDir.length > 0) {
    return path.join(envDir, `${name}.mjml`);
  }

  const candidates = [
    path.join(process.cwd(), "src", "modules", "notification", "templates", "email"),
    path.join(process.cwd(), "api", "src", "modules", "notification", "templates", "email"),
    path.join(process.cwd(), "backend", "api", "src", "modules", "notification", "templates", "email")
  ];

  const baseDir = candidates.find((dir) => fs.existsSync(dir));
  if (!baseDir) {
    throw new Error("Email template directory not found. Set NOTIFY_TEMPLATE_DIR.");
  }

  return path.join(baseDir, `${name}.mjml`);
};

const loadTemplate = (name: string) => {
  const cached = cache.get(name);
  if (cached) return cached;
  const templatePath = resolveTemplatePath(name);
  const content = fs.readFileSync(templatePath, "utf8");
  cache.set(name, content);
  return content;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toHtmlBody = (body: string) => {
  return body
    .split("\n")
    .map((line) => line.trim())
    .map((line) => (line.length === 0 ? "<br/>" : `<p style="margin:0 0 8px;">${escapeHtml(line)}</p>`))
    .join("");
};

export const renderBaseEmail = (payload: EmailTemplatePayload): RenderedEmail => {
  const template = loadTemplate("base");
  const brandName = process.env.WHATSAPP_BRAND ?? process.env.COMPANY_NAME ?? "FundarMF";
  const companyName = process.env.COMPANY_NAME ?? "FundarMF";
  const companyLocation = process.env.COMPANY_LOCATION ?? "Brasil";
  const preheader = payload.preheader ?? payload.title;
  const bodyHtml = toHtmlBody(payload.body);
  const ctaBlock =
    payload.ctaLabel && payload.ctaUrl
      ? `<mj-button href="${escapeHtml(payload.ctaUrl)}">${escapeHtml(payload.ctaLabel)}</mj-button>`
      : "";

  const mjml = template
    .replace(/{{title}}/g, escapeHtml(payload.title))
    .replace(/{{preheader}}/g, escapeHtml(preheader))
    .replace(/{{brandName}}/g, escapeHtml(brandName))
    .replace(/{{companyName}}/g, escapeHtml(companyName))
    .replace(/{{companyLocation}}/g, escapeHtml(companyLocation))
    .replace(/{{bodyHtml}}/g, bodyHtml)
    .replace(/{{ctaBlock}}/g, ctaBlock);

  const { html, errors } = mjml2html(mjml, { validationLevel: "soft" });
  if (errors.length > 0) {
    console.warn("[notify] MJML warnings", errors);
  }

  return { html, text: payload.body };
};
