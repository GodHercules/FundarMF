"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContextMiddleware = exports.addPerfTime = exports.getRequestContext = void 0;
const node_async_hooks_1 = require("node:async_hooks");
const node_perf_hooks_1 = require("node:perf_hooks");
const node_crypto_1 = require("node:crypto");
const storage = new node_async_hooks_1.AsyncLocalStorage();
const getRequestContext = () => storage.getStore();
exports.getRequestContext = getRequestContext;
const addPerfTime = (field, deltaMs) => {
    const ctx = storage.getStore();
    if (!ctx)
        return;
    const current = ctx.perf[field];
    if (typeof current === "number") {
        ctx.perf[field] = current + deltaMs;
    }
    else {
        ctx.perf[field] = deltaMs;
    }
};
exports.addPerfTime = addPerfTime;
const requestContextMiddleware = (req, res, next) => {
    const incomingId = req.headers["x-correlation-id"];
    const correlationId = typeof incomingId === "string" && incomingId.trim().length > 0 ? incomingId : (0, node_crypto_1.randomUUID)();
    const perf = {
        startTime: Date.now()
    };
    const ctx = {
        correlationId,
        perf,
        startHrTime: node_perf_hooks_1.performance.now()
    };
    storage.run(ctx, () => {
        req.correlationId = correlationId;
        req.perf = perf;
        res.setHeader("x-correlation-id", correlationId);
        next();
    });
};
exports.requestContextMiddleware = requestContextMiddleware;
//# sourceMappingURL=request-context.js.map