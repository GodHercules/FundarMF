import type { ReactNode } from "react";
import clsx from "clsx";

export type ClientSectionKey = "company" | "partners" | "address" | "documents" | "review";

type ClientAccordionProps = {
  id: ClientSectionKey;
  index: number;
  title: string;
  description: string;
  summary?: string;
  active: boolean;
  complete?: boolean;
  locked?: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function ClientAccordion({
  id,
  index,
  title,
  description,
  summary,
  active,
  complete,
  locked,
  onToggle,
  children
}: ClientAccordionProps) {
  const panelId = `client-section-panel-${id}`;
  const buttonId = `client-section-trigger-${id}`;

  return (
    <section className={clsx("client-accordion", active && "is-open", complete && "is-complete")}>
      <button
        id={buttonId}
        type="button"
        className="client-accordion-trigger"
        aria-expanded={active}
        aria-controls={panelId}
        onClick={onToggle}
        disabled={locked}
      >
        <span className="client-accordion-index" aria-hidden="true">
          {complete ? "✓" : String(index).padStart(2, "0")}
        </span>
        <span className="client-accordion-heading">
          <span className="client-accordion-title">{title}</span>
          <span className="client-accordion-description">{active ? description : summary ?? description}</span>
        </span>
        <span className="client-accordion-chevron" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m5 7.5 5 5 5-5" />
          </svg>
        </span>
      </button>
      <div id={panelId} className="client-accordion-panel" role="region" aria-labelledby={buttonId} hidden={!active}>
        <div className="client-accordion-content">{children}</div>
      </div>
    </section>
  );
}

type ClientProgressProps = {
  completed: number;
  total: number;
};

export function ClientProgress({ completed, total }: ClientProgressProps) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="client-progress" aria-label={`Progresso visual: ${completed} de ${total} etapas revisadas`}>
      <div className="client-progress-meta">
        <span>Seu caminho até aqui</span>
        <strong>{completed} de {total} etapas revisadas</strong>
      </div>
      <div className="client-progress-track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function ClientSkeleton() {
  return (
    <main className="client-portal client-loading-shell">
      <div className="client-skeleton client-skeleton-brand" />
      <div className="client-skeleton client-skeleton-title" />
      <div className="client-skeleton client-skeleton-panel" />
      <p className="sr-only" role="status">Carregando seu processo</p>
    </main>
  );
}

export function ClientCompletion({ internalMode, onClose }: { internalMode?: boolean; onClose?: () => void }) {
  return (
    <main className="client-portal client-completion-shell">
      <div className="client-completion-orb" aria-hidden="true" />
      <div className="client-completion-card" role="status" aria-live="polite">
        <div className="client-success-mark" aria-hidden="true">
          <svg viewBox="0 0 72 72" fill="none">
            <circle cx="36" cy="36" r="31" />
            <path d="m21 37 10 10 21-23" />
          </svg>
        </div>
        <span className="client-eyebrow client-eyebrow-success">Envio confirmado</span>
        <h1>Tudo certo!<br /><span>Recebemos suas informações.</span></h1>
        <p className="client-completion-lead">Obrigado por confiar na MF Contabilidade para dar esse passo importante.</p>
        <div className="client-completion-callout">
          <span className="client-callout-dot" aria-hidden="true" />
          <strong>Agora é com a gente!</strong>
          <p>Nossa equipe dará continuidade ao processo de abertura da sua empresa. Aguarde as próximas orientações nos canais de acompanhamento disponíveis.</p>
        </div>
        <div className="client-next-steps" aria-label="Próximos passos">
          <div className="client-next-step is-done">
            <span>01</span>
            <div><strong>Informações recebidas</strong><small>Seus dados foram enviados com sucesso.</small></div>
          </div>
          <div className="client-next-step">
            <span>02</span>
            <div><strong>Análise pela MF Contabilidade</strong><small>Nossa equipe dará continuidade ao atendimento.</small></div>
          </div>
          <div className="client-next-step">
            <span>03</span>
            <div><strong>Atualizações do processo</strong><small>Acompanhe as orientações pelos canais disponíveis.</small></div>
          </div>
        </div>
        {internalMode && onClose && <button type="button" className="client-secondary-button" onClick={onClose}>Fechar e voltar ao painel</button>}
      </div>
    </main>
  );
}
