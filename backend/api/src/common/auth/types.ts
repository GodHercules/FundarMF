export type ActorRole = "CLIENTE" | "OPERADOR" | "MASTER" | "SYSTEM";

export interface Actor {
  role: ActorRole;
  userId?: string;
  email?: string;
  whatsapp?: string;
  tenantKey?: string;
}

declare global {
  namespace Express {
    interface Request {
      actor?: Actor;
      sessionId?: string;
      correlationId?: string;
    }
  }
}

export {};
