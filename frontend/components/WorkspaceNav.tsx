"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FiArchive, FiBriefcase, FiChevronLeft, FiChevronRight, FiClipboard, FiFileText, FiGrid, FiLogOut, FiMenu, FiUsers, FiX } from "react-icons/fi";
import clsx from "clsx";
import { api } from "@/lib/api";

type WorkspaceRole = "operator" | "master";
type NavItem = { href: string; label: string; description: string; icon: typeof FiGrid };

const links: Record<WorkspaceRole, NavItem[]> = {
  operator: [
    { href: "/operator/dashboard", label: "Visão geral", description: "O que precisa de atenção", icon: FiGrid },
    { href: "/operator/kanban", label: "Processos", description: "Acompanhe por etapa", icon: FiBriefcase },
    { href: "/operator/alteracoes-contratuais", label: "Alterações", description: "Documentos e contratos", icon: FiFileText },
    { href: "/operator/processos-finalizados", label: "Arquivo", description: "Processos concluídos", icon: FiArchive },
    { href: "/operator/clientes-sem-processo", label: "Clientes", description: "Cadastros independentes", icon: FiUsers }
  ],
  master: [{ href: "/master/dashboard", label: "Visão global", description: "Operação completa", icon: FiGrid }]
};

export function WorkspaceNav({ role, onCreateProcess }: { role: WorkspaceRole; onCreateProcess?: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const brandHref = role === "master"
    ? "/master/dashboard"
    : pathname === "/operator/start" || pathname === "/operator/request-link"
      ? "/operator/start"
      : "/operator/dashboard";

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  async function handleLogout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <>
      <button type="button" className="workspace-mobile-trigger" onClick={() => setOpen(true)} aria-label="Abrir navegação">
        <FiMenu aria-hidden="true" />
        <span>FundarMF</span>
      </button>
      {open && <button type="button" className="workspace-nav-overlay" onClick={() => setOpen(false)} aria-label="Fechar navegação" />}
      <aside className={clsx("workspace-nav", open && "is-open", collapsed && "is-collapsed")} aria-label="Navegação principal">
        <div className="workspace-nav-topline">
          <Link href={brandHref} className="workspace-nav-brand" onClick={() => setOpen(false)} aria-label="FundarMF, ir para o painel">
            <span className="workspace-nav-mark" aria-hidden="true">FM</span>
            <span className="workspace-nav-brand-copy"><strong>FundarMF</strong><small>{role === "operator" ? "Portal operador" : "Portal master"}</small></span>
          </Link>
          <button ref={closeButtonRef} type="button" className="workspace-nav-close" onClick={() => setOpen(false)} aria-label="Fechar navegação"><FiX aria-hidden="true" /></button>
        </div>
        <div className="workspace-nav-context"><span className="workspace-nav-context-mark" aria-hidden="true"><FiClipboard /></span><span><strong>Operação diária</strong><small>Ambiente interno</small></span></div>
        <nav className="workspace-nav-links">
          {links[role].map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return <Link key={link.href} href={link.href} className={clsx("workspace-nav-link", active && "is-active")} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}><Icon aria-hidden="true" /><span className="workspace-nav-link-copy"><strong>{link.label}</strong><small>{link.description}</small></span></Link>;
          })}
        </nav>
{role === "operator" && (onCreateProcess ? <button type="button" className="workspace-nav-create" onClick={() => { onCreateProcess(); setOpen(false); }}><span aria-hidden="true">+</span><span className="workspace-nav-link-copy"><strong>Novo processo</strong><small>Iniciar atendimento</small></span></button> : <Link href="/operator/start" className="workspace-nav-create" onClick={() => setOpen(false)}><span aria-hidden="true">+</span><span className="workspace-nav-link-copy"><strong>Novo processo</strong><small>Iniciar atendimento</small></span></Link>)}
        <div className="workspace-nav-footer">
          <div className="workspace-nav-user"><span className="workspace-nav-avatar" aria-hidden="true">OP</span><span className="workspace-nav-link-copy"><strong>Operador</strong><small>Acesso interno</small></span></div>
          <button type="button" className="workspace-nav-logout" onClick={() => void handleLogout()}><FiLogOut aria-hidden="true" /><span>Sair</span></button>
          <button type="button" className="workspace-nav-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expandir navegação" : "Recolher navegação"}>{collapsed ? <FiChevronRight aria-hidden="true" /> : <><FiChevronLeft aria-hidden="true" /><span>Recolher menu</span></>}</button>
        </div>
      </aside>
    </>
  );
}
