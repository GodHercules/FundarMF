import { toast } from "react-toastify";

export type NotifyType = "success" | "error" | "info";

export type NotifyPayload = {
  type: NotifyType;
  message: string;
};

const shouldFixEncoding = (value: string) => /Ã|Â|\uFFFD/.test(value);

const fixMojibake = (value: string) => {
  if (!shouldFixEncoding(value)) return value;
  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder("utf-8").decode(bytes);
    return decoded;
  } catch {
    return value;
  }
};

export function notify(payload: NotifyPayload) {
  if (typeof window === "undefined") return;
  const message = fixMojibake(payload.message);
  if (payload.type === "success") toast.success(message);
  else if (payload.type === "error") toast.error(message);
  else toast.info(message);
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
