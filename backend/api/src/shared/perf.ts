import { performance } from "node:perf_hooks";

import { addPerfTime } from "./request-context";

export const timeAsync = async <T>(field: "hashMs" | "externalMs", task: () => Promise<T>) => {
  const start = performance.now();
  try {
    return await task();
  } finally {
    addPerfTime(field, performance.now() - start);
  }
};
