"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PhoneInput } from "@/components/PhoneInput";
import { notifySuccess } from "@/lib/notify";

type ProcessStartMode = "link" | "internal";

type OperatorNewProcessModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

function showInternalProcessLoader(target: Window) {
  const loadingDocument = target.document;
  loadingDocument.open();
  loadingDocument.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Preparando preenchimento</title><style>:root{font-family:system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f9fb;color:#121a29}.loading{display:grid;justify-items:center;gap:14px;padding:32px;text-align:center}.loader{width:38px;height:38px;border:3px solid #d9dee7;border-top-color:#315efb;border-radius:50%;animation:spin 1s linear infinite}h1{margin:0;font-size:18px}p{margin:0;max-width:340px;color:#4f5b6d;font-size:14px;line-height:1.5}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.loader{animation-duration:2s}}</style></head><body><main class="loading" role="status" aria-live="polite"><div class="loader" aria-hidden="true"></div><h1>Preparando o preenchimento</h1><p>Aguarde enquanto abrimos o formulário interno já autenticado.</p></main></body></html>`);
  loadingDocument.close();
}

export function OperatorNewProcessModal({ open, onClose, onCreated }: OperatorNewProcessModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [startMode, setStartMode] = useState<ProcessStartMode>("link");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", sendEmail: true, sendWhatsapp: true });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
    if (open) {
      setMessage(null);
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
  }, [open]);

  function closeModal() {
    if (creating) return;
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    setMessage(null);

    if (!form.nome.trim() || !form.email.trim()) {
      setMessage("Informe o nome da empresa e o e-mail do cliente.");
      return;
    }
    if (startMode === "link" && !form.sendEmail && !form.sendWhatsapp) {
      setMessage("Selecione pelo menos um canal para enviar o acesso seguro.");
      return;
    }

    let internalWindow: Window | null = null;
    if (startMode === "internal") {
      internalWindow = window.open("about:blank", "_blank");
      if (!internalWindow) {
        setMessage("Permita pop-ups neste site para abrir o preenchimento interno.");
        return;
      }
      showInternalProcessLoader(internalWindow);
    }

    const openedInternalWindow = internalWindow;
    setCreating(true);
    try {
      const created = await api<{ id: string }>("/processes", {
        method: "POST",
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim(),
          telefone: form.telefone,
          sendEmail: startMode === "link" ? form.sendEmail : false,
          sendWhatsapp: startMode === "link" ? form.sendWhatsapp : false
        })
      });

      if (startMode === "internal" && openedInternalWindow) {
        openedInternalWindow.location.href = new URL(`/client/process/${created.id}?modo=interno`, window.location.origin).toString();
        openedInternalWindow.focus();
        notifySuccess("Processo interno iniciado em uma nova aba.");
      } else {
        notifySuccess("Processo iniciado e link enviado.");
      }

      setForm({ nome: "", email: "", telefone: "", sendEmail: true, sendWhatsapp: true });
      onCreated();
      onClose();
    } catch (error) {
      openedInternalWindow?.close();
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar o processo.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="operator-process-dialog"
      aria-labelledby="operator-process-dialog-title"
      onCancel={(event) => { event.preventDefault(); closeModal(); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}
    >
      <div className="operator-process-modal">
        <header className="operator-process-modal-header">
          <div>
            <p className="operator-breadcrumb">Atalho operacional</p>
            <h2 id="operator-process-dialog-title">Começar um novo atendimento</h2>
            <p>Escolha como os dados iniciais serão preenchidos.</p>
          </div>
          <button ref={closeButtonRef} type="button" className="operator-dialog-close" aria-label="Fechar novo atendimento" onClick={closeModal}>×</button>
        </header>

        <form className="operator-process-modal-body" onSubmit={handleSubmit}>
          <div className="operator-start-options" role="group" aria-label="Modo de início do processo">
            <button type="button" className={startMode === "link" ? "is-selected" : ""} onClick={() => setStartMode("link")} aria-pressed={startMode === "link"}>
              <strong>Iniciar processo link cliente</strong>
              <span>O cliente preenche com acesso seguro.</span>
            </button>
            <button type="button" className={startMode === "internal" ? "is-selected" : ""} onClick={() => setStartMode("internal")} aria-pressed={startMode === "internal"}>
              <strong>Iniciar processo interno</strong>
              <span>O formulário abre em uma nova aba.</span>
            </button>
          </div>

          <div className="operator-start-form">
            <label htmlFor="operator-company-name">Nome da empresa</label>
            <Input id="operator-company-name" name="companyName" autoComplete="organization" placeholder="Nome da empresa" value={form.nome} onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))} />
            <label htmlFor="operator-client-email">E-mail do cliente</label>
            <Input id="operator-client-email" name="email" type="email" autoComplete="email" placeholder="E-mail do cliente" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            <PhoneInput label="WhatsApp do cliente" value={form.telefone} onChange={(value) => setForm((prev) => ({ ...prev, telefone: value }))} />
            {startMode === "link" && <div className="operator-check-options"><label><input type="checkbox" checked={form.sendEmail} onChange={(event) => setForm((prev) => ({ ...prev, sendEmail: event.target.checked }))} /> E-mail</label><label><input type="checkbox" checked={form.sendWhatsapp} onChange={(event) => setForm((prev) => ({ ...prev, sendWhatsapp: event.target.checked }))} /> WhatsApp</label></div>}
          </div>

          {message && <p className="operator-form-message" role="alert">{message}</p>}
          <div className="operator-process-modal-actions">
            <Button type="button" variant="ghost" onClick={closeModal} disabled={creating}>Cancelar</Button>
            <Button type="submit" variant="accent" disabled={creating}>{creating ? "Iniciando…" : startMode === "link" ? "Enviar acesso seguro" : "Iniciar processo interno"}</Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
