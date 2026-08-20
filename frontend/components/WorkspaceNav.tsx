"use client";

import Link from "next/link";
import clsx from "clsx";

type WorkspaceRole = "operator" | "master";

const links: Record<WorkspaceRole, Array<{ href: string; label: string }>> = {
  operator: [
    { href: "/operator/dashboard", label: "Meu painel" },
    { href: "/operator/kanban", label: "Kanban" },
    { href: "/operator/alteracoes-contratuais", label: "Alterações" },
    { href: "/operator/processos-finalizados", label: "Finalizados" },
    { href: "/operator/clientes-sem-processo", label: "Clientes" }
  ],
  master: [{ href: "/master/dashboard", label: "Visão global" }]
};

export function WorkspaceNav({ role }: { role: WorkspaceRole }) {
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;
  return (
    <nav className="workspace-nav" aria-label="Navegação principal">
      <div className="workspace-nav-brand"><span className="workspace-nav-mark">FM</span><span>FundarMF</span></div>
      <div className="workspace-nav-links">
        {links[role].map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return <Link key={link.href} href={link.href} className={clsx("workspace-nav-link", active && "is-active")} aria-current={active ? "page" : undefined}>{link.label}</Link>;
        })}
      </div>
    </nav>
  );
}
