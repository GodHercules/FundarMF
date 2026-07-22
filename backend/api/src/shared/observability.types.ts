export type ErrorSeverity = "info" | "warn" | "error" | "fatal";
export type ErrorCategory =
  | "database"
  | "http"
  | "integration"
  | "worker"
  | "runtime"
  | "file_processing"
  | "configuration"
  | "unknown";

export type ErrorProcessType = "api" | "worker" | "cron" | "script" | "frontend";

export type ErrorCaptureContext = {
  service?: string;
  processType?: ErrorProcessType;
  operation?: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  request?: {
    method?: string;
    route?: string;
    url?: string;
    statusCode?: number;
    requestId?: string;
    userId?: string | null;
    tenantId?: string | null;
    ip?: string;
  };
  execution?: {
    command?: string;
    exitCode?: number;
    stderr?: string;
    processId?: number;
    jobId?: string;
    attempt?: number;
  };
  entity?: string;
  entityId?: string;
  additionalData?: unknown;
  retriable?: boolean;
};

export type ErrorEventPayload = {
  eventId: string;
  eventType: "application_error";
  timestamp: string;
  severity: ErrorSeverity;
  environment: string;
  application: string;
  service: string;
  version: string | null;
  error: {
    name: string;
    message: string;
    code: string | null;
    category: ErrorCategory;
    summary: string;
    possibleCause: string | null;
    stack: string | null;
  };
  origin: {
    file: string | null;
    function: string | null;
    line: number | null;
    column: number | null;
    module: string | null;
  };
  execution: {
    processId: number;
    processType: ErrorProcessType;
    command: string | null;
    exitCode: number | null;
    stderr: string | null;
  };
  request: {
    method: string | null;
    route: string | null;
    url: string | null;
    statusCode: number | null;
    requestId: string | null;
    userId: string | null;
    tenantId: string | null;
    ip: string | null;
  };
  context: {
    operation: string | null;
    entity: string | null;
    entityId: string | null;
    jobId: string | null;
    attempt: number | null;
    additionalData: unknown;
  };
  diagnosis: {
    impact: string;
    retriable: boolean;
    suggestedAction: string;
  };
};
