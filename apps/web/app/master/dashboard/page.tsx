"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/Stepper";

export default function MasterDashboard() {
  const [processes, setProcesses] = useState<any[]>([]);
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  async function load() {
    const [p, u, un] = await Promise.all([
      api("/processes"),
      api("/admin/users"),
      api("/admin/processes/unassigned")
    ]);
    setProcesses(p as any[]);
    setUsers(u as any[]);
    setUnassigned(un as any[]);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-16">
      <Link href="/master" className="text-sm font-semibold text-slate">
        ← Sair
      </Link>
      <header className="flex flex-col gap-2">
        <span className="badge bg-brass/15 text-ink">Governança</span>
        <h1 className="text-3xl font-semibold">Visão global</h1>
        <p className="text-slate">Gestão completa, auditoria e SLAs.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Casos sem dono</h2>
          <div className="mt-4 space-y-3">
            {unassigned.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-sm text-slate">{item.id}</span>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Usuários</h2>
          <div className="mt-4 space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between">
                <span className="text-sm text-slate">{user.name}</span>
                <span className="text-xs text-slate">{user.role}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {processes.map((process) => (
          <Card key={process.id} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{process.clientName ?? "Processo"}</h3>
                <p className="text-sm text-slate">Etapa atual: {process.currentStep}</p>
              </div>
              <StatusBadge status={process.status} />
            </div>
          </Card>
        ))}
      </section>
    </main>
  );
}
