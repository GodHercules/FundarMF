"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { OperatorKanbanBoard } from "@/components/OperatorKanbanBoard";

export default function OperatorKanbanPage() {
  return (
    <main className="app-container flex min-h-screen flex-col gap-8 py-12">
      <Link href="/operator/dashboard" className="text-sm font-semibold text-slate">
        Voltar para dashboard
      </Link>

      <header className="flex flex-col gap-2">
        <Logo withText />
        <span className="badge bg-emerald/15 text-ink">Kanban do operador</span>
        <h1 className="text-3xl font-semibold">Processos por etapa</h1>
        <p className="text-slate">Arraste os cards entre colunas para atualizar a etapa e notificar automaticamente o cliente.</p>
      </header>

      <OperatorKanbanBoard />
    </main>
  );
}
