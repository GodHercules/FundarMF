"use client";

import { ToastContainer } from "react-toastify";

export function Notifications() {
  return <ToastContainer position="top-center" autoClose={7000} newestOnTop limit={3} closeOnClick pauseOnFocusLoss draggable pauseOnHover theme="light" role="alert" />;
}
