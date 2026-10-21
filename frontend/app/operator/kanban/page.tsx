"use client";

import Link from "next/link";
import { OperatorKanbanBoard } from "@/components/OperatorKanbanBoard";
import { WorkspaceNav } from "@/components/WorkspaceNav";

export default function OperatorKanbanPage() {
  return <main className="app-container flex min-h-screen flex-col gap-8 py-12">
    <WorkspaceNav role="operator" />
    <header className="operator-page-header">
      <div><p className="operator-breadcrumb"><Link href="/operator/dashboard">Portal operador</Link> / Processos</p><h1>Processos por etapa</h1><p>Arraste os cards entre colunas para atualizar a etapa e notificar automaticamente o cliente.</p></div>
      <Link href="/operator/dashboard" className="operator-secondary-action">Voltar ao painel</Link>
    </header>
    <OperatorKanbanBoard />
  </main>;
}
