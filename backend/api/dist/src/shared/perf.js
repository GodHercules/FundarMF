"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeAsync = void 0;
const node_perf_hooks_1 = require("node:perf_hooks");
const request_context_1 = require("./request-context");
const timeAsync = async (field, task) => {
    const start = node_perf_hooks_1.performance.now();
    try {
        return await task();
    }
    finally {
        (0, request_context_1.addPerfTime)(field, node_perf_hooks_1.performance.now() - start);
    }
};
exports.timeAsync = timeAsync;
//# sourceMappingURL=perf.js.map