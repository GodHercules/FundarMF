import { ProcessStatus, StepKey } from "@prisma/client";

import { renderBaseEmail } from "./email.template";

export type EmailDraft = {
  subject: string;
  text: string;
  html: string;
};

export type ProcessEventKey =
  | "process_started"
  | "client_link_sent"
  | "client_submitted"
  | "correction_requested"
  | "process_marked_in_progress"
  | "step_approved"
  | "process_completed"
  | "process_cancelled";

export type ProcessWebhookContext = {
  id: string;
  clientName?: string | null;
  clientEmail: string;
  clientPhone?: string | null;
  status: ProcessStatus;
  currentStep: StepKey;
  ownerEmail?: string | null;
};

export type ProcessEventDetails = {
  stepKey?: StepKey;
  nextStep?: StepKey | null;
  correction?: { stepKey: StepKey; fields: string[]; reason: string };
  cancelReason?: string;
};

const stepLabels: Record<string, string> = {
  ETAPA_1: "In\u00edcio",
  ETAPA_2: "Preenchimento de dados e informa\u00e7\u00f5es",
  ETAPA_3: "Estrutura Jur\u00eddica",
  ETAPA_4: "Checklist",
  ETAPA_5: "Endere\u00e7o",
  ETAPA_6: "Documentos"
};

const statusLabels: Record<string, string> = {
  CONCLUIDO: "Conclu\u00eddo",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  AGUARDANDO_OPERADOR: "Aguardando operador",
  CORRECAO_SOLICITADA: "Corre\u00e7\u00e3o solicitada",
  CANCELADO: "Cancelado"
};

const stepsOrder: StepKey[] = ["ETAPA_1", "ETAPA_2", "ETAPA_3", "ETAPA_4", "ETAPA_5", "ETAPA_6"];

function computeProgressPercent(currentStep: StepKey, status: ProcessStatus) {
  if (status === "CONCLUIDO") return 100;
  const idx = stepsOrder.indexOf(currentStep);
  if (idx < 0) return 0;
  // Current step not completed yet, so progress is "steps already behind us".
  return Math.max(0, Math.min(99, Math.round((idx / stepsOrder.length) * 100)));
}

function buildUrls(processId: string) {
  const base = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return {
    client: `${base}/client/process/${processId}`,
    operator: `${base}/operator/process/${processId}`
  };
}

function hello(name?: string | null) {
  const clean = name?.trim();
  return clean && clean.length > 0 ? `Ol\u00e1, ${clean},` : "Ol\u00e1,";
}

function joinLines(lines: string[]) {
  return lines.filter((l) => typeof l === "string").join("\n");
}

function render(subject: string, lines: string[], cta?: { label: string; url: string }) {
  const { html, text } = renderBaseEmail({
    title: subject,
    body: joinLines(lines),
    ctaLabel: cta?.label,
    ctaUrl: cta?.url
  });
  return { subject, html, text };
}

export function buildProcessEmailDrafts(input: {
  event: ProcessEventKey;
  process: ProcessWebhookContext;
  details?: ProcessEventDetails;
}): { client?: EmailDraft; operator?: EmailDraft; both?: EmailDraft; meta: Record<string, unknown> } {
  const { event, process, details } = input;
  const urls = buildUrls(process.id);
  const progress = computeProgressPercent(process.currentStep, process.status);
  const stepLabel = stepLabels[process.currentStep] ?? process.currentStep;
  const statusLabel = statusLabels[process.status] ?? process.status;

  const meta = {
    progressPercent: progress,
    statusLabel,
    stepLabel
  };

  const clientName = process.clientName?.trim() || "Cliente";
  const ownerEmail = process.ownerEmail?.trim() || undefined;

  if (event === "process_started") {
    const operatorSubject = `Processo iniciado: ${clientName} (${process.id})`;
    const operatorLines = [
      "Novo processo iniciado.",
      "",
      `Processo: ${process.id}`,
      `Cliente: ${clientName}`,
      `Email do cliente: ${process.clientEmail}`,
      process.clientPhone ? `Telefone: ${process.clientPhone}` : "",
      `Status: ${statusLabel}`,
      `Etapa atual: ${process.currentStep} (${stepLabel})`,
      `Progresso: ${progress}%`
    ].filter(Boolean) as string[];

    return {
      operator: render(operatorSubject, operatorLines, { label: "Abrir processo", url: urls.operator }),
      meta
    };
  }

  if (event === "client_link_sent") {
    // O link/OTP \u00e9 exclusivo do cliente. O operador n\u00e3o deve receber notifica\u00e7\u00e3o sobre isso.
    return { meta };
  }

  if (event === "client_submitted") {
    const stepKey = details?.stepKey ?? process.currentStep;
    const submittedLabel = stepLabels[stepKey] ?? stepKey;

    const operatorSubject = `Cliente enviou etapa: ${submittedLabel} (${process.id})`;
    const operatorLines = [
      "O cliente enviou a etapa para revis\u00e3o do operador.",
      "",
      `Processo: ${process.id}`,
      `Cliente: ${clientName}`,
      `Email do cliente: ${process.clientEmail}`,
      `Etapa enviada: ${stepKey} (${submittedLabel})`,
      `Status atual: ${statusLabel}`
    ];

    const bothSubject = `Atualiza\u00e7\u00e3o do processo ${process.id}`;
    const bothLines = [
      `Processo: ${process.id}`,
      `Cliente: ${clientName}`,
      `Status: ${statusLabel}`,
      `Etapa atual: ${process.currentStep} (${stepLabel})`,
      `Progresso: ${progress}%`
    ];

    return {
      operator: render(operatorSubject, operatorLines, { label: "Abrir processo", url: urls.operator }),
      both: render(bothSubject, bothLines),
      meta
    };
  }

  if (event === "correction_requested") {
    const correction = details?.correction;
    const correctionStep = correction?.stepKey ?? process.currentStep;
    const correctionLabel = stepLabels[correctionStep] ?? correctionStep;
    const fields = correction?.fields ?? [];

    const clientSubject = `Corre\u00e7\u00e3o solicitada no processo ${process.id}`;
    const clientLines = [
      hello(clientName),
      "",
      "Encontramos alguns pontos que precisam de corre\u00e7\u00e3o para continuar seu processo.",
      "",
      `Etapa: ${correctionStep} (${correctionLabel})`,
      correction?.reason ? `Motivo: ${correction.reason}` : "",
      fields.length > 0 ? "" : "",
      ...(fields.length > 0 ? ["Campos para revisar:", ...fields.map((f) => `- ${f}`)] : []),
      "",
      "Acesse o portal para ajustar os dados e reenviar."
    ].filter(Boolean) as string[];

    const operatorSubject = `Corre\u00e7\u00e3o solicitada: ${clientName} (${process.id})`;
    const operatorLines = [
      "Corre\u00e7\u00e3o solicitada ao cliente.",
      "",
      `Processo: ${process.id}`,
      `Cliente: ${clientName}`,
      `Email do cliente: ${process.clientEmail}`,
      `Etapa: ${correctionStep} (${correctionLabel})`,
      correction?.reason ? `Motivo: ${correction.reason}` : "",
      fields.length > 0 ? "" : "",
      ...(fields.length > 0 ? ["Campos liberados para corre\u00e7\u00e3o:", ...fields.map((f) => `- ${f}`)] : [])
    ].filter(Boolean) as string[];

    const bothSubject = `Status do processo ${process.id}: corre\u00e7\u00e3o solicitada`;
    const bothLines = [
      `Processo: ${process.id}`,
      `Cliente: ${clientName}`,
      `Status: ${statusLabel}`,
      `Etapa: ${process.currentStep} (${stepLabel})`,
      `Progresso: ${progress}%`
    ];

    return {
      client: render(clientSubject, clientLines, { label: "Abrir portal", url: urls.client }),
      operator: render(operatorSubject, operatorLines, { label: "Ver processo", url: urls.operator }),
      both: render(bothSubject, bothLines),
      meta
    };
  }

  if (event === "process_marked_in_progress") {
    const bothSubject = `Processo ${process.id} em andamento`;
    const bothLines = [
      `Processo: ${process.id}`,
      `Cliente: ${clientName}`,
      `Status: ${statusLabel}`,
      `Etapa atual: ${process.currentStep} (${stepLabel})`,
      `Progresso: ${progress}%`
    ];
    return {
      both: render(bothSubject, bothLines),
      meta
    };
  }

  if (event === "step_approved") {
    const next = details?.nextStep ?? null;
    const nextLabel = next ? stepLabels[next] ?? next : undefined;

    const operatorSubject = `Etapa aprovada: ${clientName} (${process.id})`;
    const operatorLines = [
      "Uma etapa do processo foi aprovada.",
      "",
      `Processo: ${process.id}`,
      `Cliente: ${clientName}`,
      `Status: ${statusLabel}`,
      `Etapa atual: ${process.currentStep} (${stepLabel})`,
      next ? `Pr\u00f3xima etapa: ${next} (${nextLabel})` : "",
      `Progresso: ${progress}%`
    ].filter(Boolean) as string[];

    const clientSubject = `Atualiza\u00e7\u00e3o do seu processo ${process.id}`;
    const clientLines = [
      hello(clientName),
      "",
      "Temos uma atualiza\u00e7\u00e3o no seu processo.",
      "",
      `Status: ${statusLabel}`,
      `Etapa atual: ${process.currentStep} (${stepLabel})`,
      next ? `Pr\u00f3xima etapa: ${next} (${nextLabel})` : "",
      "",
      "Acompanhe pelo portal do cliente."
    ].filter(Boolean) as string[];

    const bothSubject = `Atualiza\u00e7\u00e3o do processo ${process.id}`;
    const bothLines = [
      `Processo: ${process.id}`,
      `Cliente: ${clientName}`,
      `Status: ${statusLabel}`,
      `Etapa atual: ${process.currentStep} (${stepLabel})`,
      `Progresso: ${progress}%`
    ];

    return {
      client: render(clientSubject, clientLines, { label: "Abrir portal", url: urls.client }),
      operator: ownerEmail ? render(operatorSubject, operatorLines, { label: "Ver processo", url: urls.operator }) : undefined,
      both: render(bothSubject, bothLines),
      meta
    };
  }

  if (event === "process_completed") {
    const clientSubject = `Processo conclu\u00eddo: ${process.id}`;
    const clientLines = [
      hello(clientName),
      "",
      "Seu processo foi conclu\u00eddo com sucesso.",
      "",
      `Processo: ${process.id}`,
      "Se precisar de suporte, responda este e-mail."
    ];

    const operatorSubject = `Processo conclu\u00eddo: ${clientName} (${process.id})`;
    const operatorLines = [
      "Processo conclu\u00eddo.",
      "",
      `Processo: ${process.id}`,
      `Cliente: ${clientName}`,
      `Email do cliente: ${process.clientEmail}`,
      process.clientPhone ? `Telefone: ${process.clientPhone}` : ""
    ].filter(Boolean) as string[];

    const bothSubject = `Status do processo ${process.id}: conclu\u00eddo`;
    const bothLines = [`Processo: ${process.id}`, `Cliente: ${clientName}`, "Status: Conclu\u00eddo", "Progresso: 100%"];

    return {
      client: render(clientSubject, clientLines, { label: "Abrir portal", url: urls.client }),
      operator: render(operatorSubject, operatorLines, { label: "Ver processo", url: urls.operator }),
      both: render(bothSubject, bothLines),
      meta
    };
  }

  if (event === "process_cancelled") {
    const reason = details?.cancelReason?.trim();

    const clientSubject = `Processo cancelado: ${process.id}`;
    const clientLines = [
      hello(clientName),
      "",
      "Seu processo foi cancelado.",
      reason ? `Motivo: ${reason}` : "",
      "",
      `Processo: ${process.id}`,
      "Se voc\u00ea acredita que isso \u00e9 um engano, responda este e-mail."
    ].filter(Boolean) as string[];

    const operatorSubject = `Processo cancelado: ${clientName} (${process.id})`;
    const operatorLines = [
      "Processo cancelado.",
      "",
      `Processo: ${process.id}`,
      `Cliente: ${clientName}`,
      `Email do cliente: ${process.clientEmail}`,
      reason ? `Motivo: ${reason}` : ""
    ].filter(Boolean) as string[];

    const bothSubject = `Status do processo ${process.id}: cancelado`;
    const bothLines = [
      `Processo: ${process.id}`,
      `Cliente: ${clientName}`,
      "Status: Cancelado",
      reason ? `Motivo: ${reason}` : ""
    ].filter(Boolean) as string[];

    return {
      client: render(clientSubject, clientLines, { label: "Abrir portal", url: urls.client }),
      operator: render(operatorSubject, operatorLines, { label: "Ver processo", url: urls.operator }),
      both: render(bothSubject, bothLines),
      meta
    };
  }

  // Default fallback: only include a minimal "both" update.
  const bothSubject = `Atualiza\u00e7\u00e3o do processo ${process.id}`;
  const bothLines = [
    `Processo: ${process.id}`,
    `Cliente: ${clientName}`,
    `Status: ${statusLabel}`,
    `Etapa atual: ${process.currentStep} (${stepLabel})`,
    `Progresso: ${progress}%`
  ];

  return { both: render(bothSubject, bothLines), meta };
}
