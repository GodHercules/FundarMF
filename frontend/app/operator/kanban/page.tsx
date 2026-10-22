"use client";

import Link from "next/link";
import { OperatorKanbanBoard } from "@/components/OperatorKanbanBoard";
import { WorkspaceNav } from "@/components/WorkspaceNav";

export default function OperatorKanbanPage() {
  return <main className="app-container flex min-h-screen flex-col gap-8 py-12">
    <WorkspaceNav role="operator" />
    <header className="operator-page-header">
      <div><p className="operator-breadcrumb"><Link href="/operator/processos">Portal operador</Link> / Kanban</p><h1>Kanban operacional</h1><p>Use o quadro para acompanhar as etapas e mover processos após a validação.</p></div>
      <Link href="/operator/processos" className="operator-secondary-action">Voltar aos processos</Link>
    </header>
    <OperatorKanbanBoard />
  </main>;
}
