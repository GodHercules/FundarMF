"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiArchive,
  FiBriefcase,
  FiClipboard,
  FiFileText,
  FiGrid,
  FiLock,
  FiLogOut,
  FiMenu,
  FiUnlock,
  FiUsers,
  FiX
} from "react-icons/fi";
import clsx from "clsx";
import { api } from "@/lib/api";

type WorkspaceRole = "operator" | "master";
type NavItem = { href: string; label: string; description: string; icon: typeof FiGrid };
type SessionActor = { name?: string; email?: string; role?: string };

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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "OP";
}

export function WorkspaceNav({ role, onCreateProcess }: { role: WorkspaceRole; onCreateProcess?: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [actor, setActor] = useState<SessionActor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const brandHref = role === "master"
    ? "/master/dashboard"
    : pathname === "/operator/start" || pathname === "/operator/request-link"
      ? "/operator/start"
      : "/operator/dashboard";

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("fundarmf:workspace-nav-collapsed") === "true");
    } catch {
      setCollapsed(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void api<{ actor?: SessionActor }>("/auth/me")
      .then((response) => {
        if (active) setActor(response.actor ?? null);
      })
      .catch(() => {
        if (active) setActor(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("fundarmf:workspace-nav-collapsed", String(collapsed));
    } catch {
      // A blocked storage context should not prevent navigation.
    }
  }, [collapsed]);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const displayName = actor?.name?.trim() || actor?.email?.split("@")[0] || (role === "master" ? "Master" : "Operador");
  const roleLabel = actor?.role === "MASTER" || role === "master" ? "Acesso master" : "Acesso interno";
  const menuPinned = !collapsed;
  const displayInitials = useMemo(() => initials(displayName), [displayName]);

  async function handleLogout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  }

  function closeDrawer() {
    setOpen(false);
    if (open) triggerRef.current?.focus();
  }

  function toggleCollapsed() {
    setCollapsed((value) => !value);
    setHoverExpanded(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="workspace-mobile-trigger"
        aria-label="Abrir navegação"
        aria-expanded={open}
        aria-controls="workspace-navigation"
        onClick={() => setOpen(true)}
      >
        <FiMenu aria-hidden="true" />
        <span>FundarMF</span>
      </button>

      {open && <button type="button" className="workspace-nav-overlay" aria-label="Fechar navegação" onClick={closeDrawer} />}

      <aside
        id="workspace-navigation"
        className={clsx("workspace-nav", open && "is-open", collapsed && !hoverExpanded && "is-collapsed", hoverExpanded && "is-hover-expanded")}
        aria-label="Navegação principal"
        onMouseEnter={() => collapsed && setHoverExpanded(true)}
        onMouseLeave={() => setHoverExpanded(false)}
      >
        <div className="workspace-nav-topline">
          <Link href={brandHref} className="workspace-nav-brand" onClick={closeDrawer} aria-label="FundarMF, ir para o painel">
            <span className="workspace-nav-logo">
              <Image src="/logomarca.svg" alt="FundarMF" width={132} height={88} priority />
            </span>
            <span className="workspace-nav-brand-copy">
              <strong>FundarMF</strong>
              <small>{role === "operator" ? "Portal operador" : "Portal master"}</small>
            </span>
          </Link>

          <div className="workspace-nav-top-actions">
            <button
              type="button"
              className={clsx("workspace-nav-toggle", menuPinned && "is-on")}
              onClick={toggleCollapsed}
              role="switch"
              aria-checked={menuPinned}
              aria-label={menuPinned ? "Desfixar e recolher menu" : "Fixar e expandir menu"}
              title={menuPinned ? "Desfixar e recolher menu" : "Fixar e expandir menu"}
            >
              <span className="workspace-nav-toggle-track" aria-hidden="true">
                <span className="workspace-nav-toggle-thumb">
                  {menuPinned ? <FiLock /> : <FiUnlock />}
                </span>
              </span>
            </button>
            <button ref={closeButtonRef} type="button" className="workspace-nav-close" onClick={closeDrawer} aria-label="Fechar navegação">
              <FiX aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="workspace-nav-context">
          <span className="workspace-nav-context-mark" aria-hidden="true"><FiClipboard /></span>
          <span><strong>Operação diária</strong><small>Ambiente interno</small></span>
        </div>

        <nav className="workspace-nav-links">
          {links[role].map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} className={clsx("workspace-nav-link", active && "is-active")} aria-current={active ? "page" : undefined} onClick={closeDrawer}>
                <Icon aria-hidden="true" />
                <span className="workspace-nav-link-copy"><strong>{link.label}</strong><small>{link.description}</small></span>
              </Link>
            );
          })}
        </nav>

        {role === "operator" && (onCreateProcess ? (
          <button type="button" className="workspace-nav-create" onClick={() => { onCreateProcess(); closeDrawer(); }}>
            <span aria-hidden="true">+</span>
            <span className="workspace-nav-link-copy"><strong>Novo processo</strong><small>Iniciar atendimento</small></span>
          </button>
        ) : (
          <Link href="/operator/start" className="workspace-nav-create" onClick={closeDrawer}>
            <span aria-hidden="true">+</span>
            <span className="workspace-nav-link-copy"><strong>Novo processo</strong><small>Iniciar atendimento</small></span>
          </Link>
        ))}

        <div className="workspace-nav-footer">
          <div className="workspace-nav-account">
            <div className="workspace-nav-user" title={`${displayName} — ${roleLabel}`}>
              <span className="workspace-nav-avatar" aria-hidden="true">{displayInitials}</span>
              <span className="workspace-nav-link-copy"><strong>{displayName}</strong><small>{roleLabel}</small></span>
            </div>
            <button type="button" className="workspace-nav-logout" onClick={() => void handleLogout()} aria-label={`Sair da conta de ${displayName}`} title="Sair">
              <FiLogOut aria-hidden="true" /><span>Sair</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
