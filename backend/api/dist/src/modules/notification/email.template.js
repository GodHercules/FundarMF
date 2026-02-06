"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderBaseEmail = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mjml_1 = __importDefault(require("mjml"));
const cache = new Map();
const resolveTemplatePath = (name) => {
    const envDir = process.env.NOTIFY_TEMPLATE_DIR?.trim();
    if (envDir && envDir.length > 0) {
        return path_1.default.join(envDir, `${name}.mjml`);
    }
    const candidates = [
        path_1.default.join(process.cwd(), "src", "modules", "notification", "templates", "email"),
        path_1.default.join(process.cwd(), "api", "src", "modules", "notification", "templates", "email"),
        path_1.default.join(process.cwd(), "backend", "api", "src", "modules", "notification", "templates", "email")
    ];
    const baseDir = candidates.find((dir) => fs_1.default.existsSync(dir));
    if (!baseDir) {
        throw new Error("Email template directory not found. Set NOTIFY_TEMPLATE_DIR.");
    }
    return path_1.default.join(baseDir, `${name}.mjml`);
};
const loadTemplate = (name) => {
    const cached = cache.get(name);
    if (cached)
        return cached;
    const templatePath = resolveTemplatePath(name);
    const content = fs_1.default.readFileSync(templatePath, "utf8");
    cache.set(name, content);
    return content;
};
const escapeHtml = (value) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const toHtmlBody = (body) => {
    return body
        .split("\n")
        .map((line) => line.trim())
        .map((line) => (line.length === 0 ? "<br/>" : `<p style="margin:0 0 8px;">${escapeHtml(line)}</p>`))
        .join("");
};
const renderBaseEmail = (payload) => {
    const template = loadTemplate("base");
    const brandName = process.env.WHATSAPP_BRAND ?? process.env.COMPANY_NAME ?? "FundarMF";
    const companyName = process.env.COMPANY_NAME ?? "FundarMF";
    const companyLocation = process.env.COMPANY_LOCATION ?? "Brasil";
    const preheader = payload.preheader ?? payload.title;
    const bodyHtml = toHtmlBody(payload.body);
    const ctaBlock = payload.ctaLabel && payload.ctaUrl
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
    const { html, errors } = (0, mjml_1.default)(mjml, { validationLevel: "soft" });
    if (errors.length > 0) {
        console.warn("[notify] MJML warnings", errors);
    }
    return { html, text: payload.body };
};
exports.renderBaseEmail = renderBaseEmail;
//# sourceMappingURL=email.template.js.map