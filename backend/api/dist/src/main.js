"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = __importDefault(require("dotenv"));
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./modules/app.module");
const request_context_1 = require("./shared/request-context");
const request_logging_interceptor_1 = require("./shared/request-logging.interceptor");
async function bootstrap() {
    const backendEnv = node_path_1.default.join(process.cwd(), ".env");
    const apiEnv = node_path_1.default.join(process.cwd(), "api", ".env");
    if (node_fs_1.default.existsSync(backendEnv)) {
        dotenv_1.default.config({ path: backendEnv });
    }
    else if (node_fs_1.default.existsSync(apiEnv)) {
        dotenv_1.default.config({ path: apiEnv });
    }
    else {
        dotenv_1.default.config();
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    // Render (and most hosted platforms) run Node behind a reverse proxy and will set X-Forwarded-For.
    // express-rate-limit validates this header and requires trust proxy to be enabled to avoid IP spoofing.
    const trustProxyRaw = process.env.TRUST_PROXY?.trim();
    if (trustProxyRaw) {
        if (trustProxyRaw === "true")
            app.set("trust proxy", true);
        else if (trustProxyRaw === "false")
            app.set("trust proxy", false);
        else {
            const n = Number(trustProxyRaw);
            if (Number.isFinite(n))
                app.set("trust proxy", n);
        }
    }
    else if (process.env.RENDER || process.env.NODE_ENV === "production") {
        // 1 hop is the safe default: trust only the immediate proxy in front of the app.
        app.set("trust proxy", 1);
    }
    app.use(request_context_1.requestContextMiddleware);
    app.use((0, helmet_1.default)());
    app.use((0, cookie_parser_1.default)());
    app.enableCors({
        origin: process.env.FRONTEND_URL?.split(",") ?? "http://localhost:3000",
        credentials: true
    });
    app.use((0, express_rate_limit_1.default)({
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
        max: Number(process.env.RATE_LIMIT_MAX ?? 5),
        standardHeaders: true,
        legacyHeaders: false
    }));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true
    }));
    app.useGlobalInterceptors(new request_logging_interceptor_1.RequestLoggingInterceptor());
    const config = new swagger_1.DocumentBuilder()
        .setTitle("FundarMF API")
        .setDescription("Workflow de abertura de empresa")
        .setVersion("0.1.0")
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup("/docs", app, document);
    const port = Number(process.env.API_PORT ?? 4000);
    await app.listen(port);
    console.log(`FundarMF API running on http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map