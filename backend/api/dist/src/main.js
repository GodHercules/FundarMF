"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./modules/app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
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