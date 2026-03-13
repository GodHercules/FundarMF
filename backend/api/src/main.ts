import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./modules/app.module";
import { NotificationService } from "./modules/notification/notification.service";
import { requestContextMiddleware } from "./shared/request-context";
import { RequestLoggingInterceptor } from "./shared/request-logging.interceptor";
import { installTerminalErrorMonitor } from "./shared/terminal-error-monitor";

function withDbPoolDefaults(urlRaw: string | undefined, defaults: { connectionLimit: number; poolTimeout: number }) {
  if (!urlRaw) return urlRaw;
  try {
    const url = new URL(urlRaw);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", String(defaults.connectionLimit));
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", String(defaults.poolTimeout));
    }
    return url.toString();
  } catch {
    return urlRaw;
  }
}

async function bootstrap() {
  // Allow the API to start from different working directories (`backend`, `backend/api`, repo root).
  // This avoids missing env vars when pnpm/nest resolves `cwd` differently across local/dev/prod.
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", "..", ".env"),
    path.resolve(process.cwd(), "api", ".env"),
    path.resolve(process.cwd(), "..", "api", ".env")
  ];
  const envPath = candidates.find((p) => fs.existsSync(p));
  if (envPath) dotenv.config({ path: envPath });
  else dotenv.config();

  process.env.DATABASE_URL = withDbPoolDefaults(process.env.DATABASE_URL, {
    connectionLimit: Number(process.env.API_DB_CONNECTION_LIMIT ?? 10),
    poolTimeout: Number(process.env.DB_POOL_TIMEOUT_SECONDS ?? 10)
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const notificationService = app.get(NotificationService);
  installTerminalErrorMonitor(notificationService);

  // Render (and most hosted platforms) run Node behind a reverse proxy and will set X-Forwarded-For.
  // express-rate-limit validates this header and requires trust proxy to be enabled to avoid IP spoofing.
  const trustProxyRaw = process.env.TRUST_PROXY?.trim();
  if (trustProxyRaw) {
    if (trustProxyRaw === "true") app.set("trust proxy", true);
    else if (trustProxyRaw === "false") app.set("trust proxy", false);
    else {
      const n = Number(trustProxyRaw);
      if (Number.isFinite(n)) app.set("trust proxy", n);
    }
  } else if (process.env.RENDER || process.env.NODE_ENV === "production") {
    // 1 hop is the safe default: trust only the immediate proxy in front of the app.
    app.set("trust proxy", 1);
  }

  app.use(requestContextMiddleware);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONTEND_URL?.split(",") ?? "http://localhost:3000",
    credentials: true
  });

  app.use(
    rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
      max: Number(process.env.RATE_LIMIT_MAX ?? 5),
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  const swaggerEnabled =
    (process.env.SWAGGER_ENABLED ?? (process.env.NODE_ENV !== "production" ? "true" : "false")) === "true";
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle("FundarMF API")
      .setDescription("Workflow de abertura de empresa")
      .setVersion("0.1.0")
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("/docs", app, document);
  }

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`FundarMF API running on http://localhost:${port}`);
}

bootstrap();
