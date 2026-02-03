export type NotifyType = "success" | "error" | "info";

export type NotifyPayload = {
  type: NotifyType;
  message: string;
};

export function notify(payload: NotifyPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("app-notify", { detail: payload }));
}

export function notifySuccess(message: string) {
  notify({ type: "success", message });
}

export function notifyError(message: string) {
  notify({ type: "error", message });
}

export function notifyInfo(message: string) {
  notify({ type: "info", message });
}
