"use client";

import { Slide, type CloseButtonProps, type IconProps, ToastContainer, type TypeOptions } from "react-toastify";

function ToastIcon({ type, isLoading }: IconProps) {
  if (isLoading) {
    return <span className="fm-toast-icon fm-toast-icon--loading" aria-hidden="true" />;
  }

  const paths: Record<Exclude<TypeOptions, "default">, string> = {
    success: "M5 12.5 9 16l10-10",
    error: "m7 7 10 10M17 7 7 17",
    warning: "M12 8v4m0 4h.01",
    info: "M12 11v5m0-8h.01"
  };

  const path = paths[type as Exclude<TypeOptions, "default">] ?? paths.info;

  return (
    <span className={`fm-toast-icon fm-toast-icon--${type}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        {type === "warning" ? <path d="M12 3 2.7 20h18.6L12 3Z" /> : null}
        <path d={path} />
      </svg>
    </span>
  );
}

function ToastCloseButton({ closeToast, ariaLabel }: CloseButtonProps) {
  return (
    <button type="button" className="fm-toast-close" onClick={closeToast} aria-label={ariaLabel ?? "Fechar notificação"}>
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="m5 5 10 10M15 5 5 15" />
      </svg>
    </button>
  );
}

export function Notifications() {
  return (
    <ToastContainer
      className="fm-toastify"
      toastClassName="fm-toast"
      progressClassName="fm-toast-progress"
      position="top-center"
      autoClose={7000}
      newestOnTop
      limit={3}
      closeOnClick
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
      role="alert"
      aria-label="Notificações do sistema"
      icon={ToastIcon}
      closeButton={ToastCloseButton}
      transition={Slide}
    />
  );
}
