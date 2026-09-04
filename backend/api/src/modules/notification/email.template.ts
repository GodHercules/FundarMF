import fs from "fs";
import mjml2html from "mjml";
import path from "path";

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
const logoCacheKey = "mf-logo-data-uri";
const fundarLogoCacheKey = "fundar-logo-data-uri";

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

const loadAssetDataUri = (fileName: string, mimeType: string, cacheKey: string) => {
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const candidates = [
    path.join(process.cwd(), "src", "modules", "notification", "templates", "email", "assets", fileName),
    path.join(process.cwd(), "api", "src", "modules", "notification", "templates", "email", "assets", fileName),
    path.join(process.cwd(), "backend", "api", "src", "modules", "notification", "templates", "email", "assets", fileName)
  ];
  const assetPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!assetPath) return "";

  const dataUri = `data:${mimeType};base64,${fs.readFileSync(assetPath).toString("base64")}`;
  cache.set(cacheKey, dataUri);
  return dataUri;
};

const loadLogo = () => {
  const configuredLogo = process.env.EMAIL_LOGO_URL?.trim();
  return configuredLogo || loadAssetDataUri("mf-logo.png", "image/png", logoCacheKey);
};

const loadFundarLogo = () => loadAssetDataUri("fundar-logo.png", "image/png", fundarLogoCacheKey);

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
    .map((line) => {
      if (line.length === 0) return '<div style="height:8px;line-height:8px;">&nbsp;</div>';

      const field = line.match(/^(Empresa|Etapa atual):\s*(.*)$/i);
      if (field) {
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;border-collapse:separate;"><tr><td style="padding:12px 14px;background:#f8fafc;border:1px solid #e5eaf2;border-radius:12px;"><span style="display:block;color:#64748b;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(field[1])}</span><span style="display:block;margin-top:3px;color:#0f2442;font-size:15px;font-weight:700;">${escapeHtml(field[2])}</span></td></tr></table>`;
      }

      if (/^Andamento da alteração Contratual$/i.test(line)) {
        return `<p style="margin:0 0 12px;color:#0f2442;font-size:14px;font-weight:700;">${escapeHtml(line)}</p>`;
      }

      return `<p style="margin:0 0 14px;">${escapeHtml(line)}</p>`;
    })
    .join("");
};

export const renderBaseEmail = (payload: EmailTemplatePayload): RenderedEmail => {
  const template = loadTemplate("base");
  const brandName = process.env.WHATSAPP_BRAND ?? process.env.COMPANY_NAME ?? "FundarMF";
  const companyName = process.env.COMPANY_NAME ?? "FundarMF";
  const companyLocation = process.env.COMPANY_LOCATION ?? "Brasil";
  const logoUrl = loadLogo();
  const fundarLogoUrl = loadFundarLogo();
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
    .replace(/{{logoUrl}}/g, escapeHtml(logoUrl))
    .replace(/{{fundarLogoUrl}}/g, escapeHtml(fundarLogoUrl))
    .replace(/{{bodyHtml}}/g, bodyHtml)
    .replace(/{{ctaBlock}}/g, ctaBlock);

  if (mjml.includes("{{")) {
    throw new Error("Email template contains unresolved placeholders.");
  }

  const { html, errors } = mjml2html(mjml, { validationLevel: "soft" });
  if (errors.length > 0) {
    console.warn("[notify] MJML warnings", errors);
  }

  return { html: html.replace(/^<html>/i, '<html lang="pt-BR">'), text: payload.body };
};
