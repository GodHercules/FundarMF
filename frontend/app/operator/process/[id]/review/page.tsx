"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { DOCS_API_BASE, api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { StatusBadge } from "@/components/Stepper";
import { notifyError } from "@/lib/notify";
import { FiCheckCircle, FiFileText, FiXCircle } from "react-icons/fi";

function getStepData(process: any, stepKey: string) {
  return (process?.steps ?? []).find((step: any) => step.stepKey === stepKey)?.data ?? {};
}

function formatValue(value: any) {
  if (value === null || value === undefined) return "Não informado";
  const text = String(value).trim();
  return text.length > 0 ? text : "Não informado";
}

function getSocioTipoPessoa(socio: Record<string, unknown>) {
  return socio?.tipoPessoa === "CNPJ" ? "CNPJ" : "CPF";
}

export default function OperatorProcessReview() {
  const params = useParams();
  const router = useRouter();
  const processId = params?.id as string;

  const [process, setProcess] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<{ itemKey: string; file: any } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function load() {
    const [processData, documentsData] = await Promise.all([
      api<any>(`/processes/${processId}`),
      api<any[]>(`/documents/${processId}/items`)
    ]);
    setProcess(processData);
    setDocuments(documentsData ?? []);
  }

  useEffect(() => {
    if (processId) load();
  }, [processId]);

  useEffect(() => {
    let active = true;
    let objectUrlToRevoke: string | null = null;

    async function loadPreview() {
      if (!selectedFile) return;
      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewUrl(null);
      try {
        const endpoint = `${DOCS_API_BASE}/documents/${processId}/items/${selectedFile.itemKey}/preview/${selectedFile.file.id}`;
        const response = await fetch(endpoint, { credentials: "include" });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Erro ao carregar documento (${response.status}).`);
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        objectUrlToRevoke = objectUrl;
        if (!active) return;
        setPreviewUrl(objectUrl);
      } catch (err: any) {
        if (!active) return;
        const msg = err?.message || "Erro ao carregar documento.";
        setPreviewError(msg);
        notifyError(msg);
      } finally {
        if (active) setPreviewLoading(false);
      }
    }

    if (!selectedFile) {
      setPreviewLoading(false);
      setPreviewError(null);
      setPreviewUrl(null);
      return () => {};
    }

    void loadPreview();
    return () => {
      active = false;
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    };
  }, [DOCS_API_BASE, processId, selectedFile?.itemKey, selectedFile?.file?.id]);

  const step2 = useMemo(() => getStepData(process, "ETAPA_2"), [process]);
  const step3 = useMemo(() => getStepData(process, "ETAPA_3"), [process]);

  const sociosList = useMemo(() => {
    const raw = step2?.quadroSocietario;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object") return [raw];
    return [];
  }, [step2]);

  const docsApproved = useMemo(
    () => (documents ?? []).length > 0 && (documents ?? []).every((doc: any) => doc.status === "APROVADO"),
    [documents]
  );

  const step3Ok = useMemo(() => {
    const required = ["tipoAtividade", "naturezaJuridica", "capitalSocial", "cnae", "tributacao"];
    return required.every((key) => String(step3?.[key] ?? "").trim().length > 0);
  }, [step3]);

  const readyToSend = docsApproved && step3Ok;

  if (!process) return <div className="p-8">Carregando...</div>;

  return (
    <main className="app-container flex min-h-screen flex-col gap-6 py-10">
      <Link href={`/operator/process/${processId}`} className="text-sm font-semibold text-slate">
        Voltar para o processo
      </Link>

      <header className="flex flex-col gap-2">
        <Logo withText />
        <span
          className={clsx(
            "badge inline-flex w-fit items-center gap-2",
            readyToSend ? "bg-emerald/15 text-ink" : "bg-brass/15 text-ink"
          )}
        >
          {readyToSend ? (
            <>
              <FiCheckCircle /> Pronto para envio
            </>
          ) : (
            <>
              <FiXCircle /> Revisão pendente
            </>
          )}
        </span>
        <h1 className="text-3xl font-semibold">Revisão final · Processo {process.id}</h1>
        <div className="flex items-center gap-3">
          <StatusBadge status={process.status} />
          <span className="text-sm text-slate">Etapa atual: {process.currentStep}</span>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Dados empresariais</h2>
          <div className="mt-3 grid gap-3 text-sm text-slate sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Razão social 1</p>
              <p className="mt-1 text-ink">{formatValue(step2?.razaoSocial1)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Município</p>
              <p className="mt-1 text-ink">{formatValue(step2?.municipio)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">E-mail CNPJ</p>
              <p className="mt-1 text-ink">{formatValue(step2?.emailCnpj)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Telefone CNPJ</p>
              <p className="mt-1 text-ink">{formatValue(step2?.telefoneCnpj)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Estrutura jurídica e financeira (operador)</h2>
          <p className="mt-1 text-xs text-slate">Somente visualização. Ajustes devem ser feitos na tela do processo.</p>
          <div className="mt-3 grid gap-3 text-sm text-slate sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Tipo de atividade</p>
              <p className="mt-1 text-ink">{formatValue(step3?.tipoAtividade)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Natureza jurídica</p>
              <p className="mt-1 text-ink">{formatValue(step3?.naturezaJuridica)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Capital social</p>
              <p className="mt-1 text-ink">{formatValue(step3?.capitalSocial)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">CNAE</p>
              <p className="mt-1 text-ink">{formatValue(step3?.cnae)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Tributação</p>
              <p className="mt-1 text-ink">{formatValue(step3?.tributacao)}</p>
            </div>
          </div>
          {!step3Ok && (
            <p className="mt-3 text-xs text-clay">
              Campos obrigatórios do operador estão incompletos. Volte e salve a etapa antes de enviar.
            </p>
          )}
        </Card>
      </section>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Endereço</h2>
        <div className="mt-3 grid gap-3 text-sm text-slate sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">CEP</p>
            <p className="mt-1 text-ink">{formatValue(step2?.endereco?.cep)}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Logradouro</p>
            <p className="mt-1 text-ink">{formatValue(step2?.endereco?.endereco)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Número</p>
            <p className="mt-1 text-ink">{formatValue(step2?.endereco?.numero)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Bairro</p>
            <p className="mt-1 text-ink">{formatValue(step2?.endereco?.bairro)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Cidade/UF</p>
            <p className="mt-1 text-ink">
              {formatValue(step2?.endereco?.cidade)} / {formatValue(step2?.endereco?.uf)}
            </p>
          </div>
          <div className="sm:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">IPTU</p>
            <p className="mt-1 text-ink">{formatValue(step2?.endereco?.iptu)}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Quadro societário</h2>
        {sociosList.length === 0 && <p className="mt-2 text-sm text-slate">Nenhum sócio informado.</p>}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sociosList.map((socio: any, index: number) => (
            <div key={socio?.socioId ?? index} className="rounded-xl border border-ink/10 bg-white/80 p-4">
              <p className="text-sm font-semibold text-ink">
                {getSocioTipoPessoa(socio ?? {}) === "CNPJ" ? `Empresa sócia ${index + 1}` : `Sócio ${index + 1}`}
              </p>
              <div className="mt-2 grid gap-2 text-sm text-slate sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">
                    {getSocioTipoPessoa(socio ?? {}) === "CNPJ" ? "Razão social" : "Nome"}
                  </p>
                  <p className="mt-1 text-ink">
                    {formatValue(getSocioTipoPessoa(socio ?? {}) === "CNPJ" ? socio?.socioRazaoSocial : socio?.socioNome)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">
                    {getSocioTipoPessoa(socio ?? {}) === "CNPJ" ? "CNPJ" : "CPF"}
                  </p>
                  <p className="mt-1 text-ink">
                    {formatValue(getSocioTipoPessoa(socio ?? {}) === "CNPJ" ? socio?.socioCnpj : socio?.socioCpf)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">E-mail</p>
                  <p className="mt-1 text-ink">{formatValue(socio?.socioEmail)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Telefone</p>
                  <p className="mt-1 text-ink">{formatValue(socio?.socioTelefone)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Participação</p>
                  <p className="mt-1 text-ink">{formatValue(socio?.socioPercentual)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Administrador</p>
                  <p className="mt-1 text-ink">{formatValue(socio?.socioAdministrador)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Responsável CNPJ</p>
                  <p className="mt-1 text-ink">{formatValue(socio?.responsavelCnpj)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Documentos (somente visualização)</h2>
          <p className="mt-1 text-xs text-slate">Use o visualizador para confirmar anexos após o processo validado.</p>
        </div>
          <span
            className={clsx(
              "badge inline-flex items-center gap-2",
              docsApproved ? "bg-emerald/15 text-ink" : "bg-clay/10 text-ink"
            )}
          >
            {docsApproved ? (
              <>
                <FiCheckCircle /> Todos aprovados
              </>
            ) : (
              <>
                <FiXCircle /> Pendentes
              </>
            )}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {documents.map((doc: any) => (
            <div key={doc.id} className="rounded-xl border border-ink/10 bg-white/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{doc.itemKey}</p>
                  <p className="mt-1 text-xs text-slate">Status: {formatValue(doc.status)}</p>
                </div>
                <FiFileText className="h-5 w-5 text-slate" />
              </div>
              <div className="mt-3 space-y-2">
                {(doc.files ?? []).length === 0 && <p className="text-xs text-slate">Sem anexos</p>}
                {(doc.files ?? []).map((file: any) => (
                  <div key={file.id} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate">{file.fileName}</span>
                    <Button variant="primary" onClick={() => setSelectedFile({ itemKey: doc.itemKey, file })}>
                      Visualizar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button className="bg-ink" onClick={() => router.push(`/operator/process/${processId}`)}>
          Voltar ao processo
        </Button>
      </div>

      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6">
          <div className="w-full max-w-6xl rounded-2xl bg-white p-4 shadow-soft xl:max-w-[1100px] 2xl:max-w-[1280px]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Visualizador de documento</h2>
              <button
                type="button"
                className="rounded-full bg-slate/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate"
                onClick={() => setSelectedFile(null)}
              >
                Fechar
              </button>
            </div>
            <div className="mt-4 h-[72vh] w-full overflow-hidden rounded-xl border border-ink/10 bg-white xl:h-[78vh] 2xl:h-[82vh]">
              {previewLoading && <div className="grid h-full w-full place-items-center text-sm text-slate">Carregando...</div>}
              {!previewLoading && previewError && (
                <div className="grid h-full w-full place-items-center p-6 text-center">
                  <div>
                    <p className="text-sm font-semibold text-ink">Não foi possível abrir o documento.</p>
                    <p className="mt-1 text-xs text-slate">{previewError}</p>
                    <div className="mt-4 flex justify-center gap-3">
                      <Button variant="primary" onClick={() => setSelectedFile(null)}>
                        Fechar
                      </Button>
                      <a
                        className="inline-flex items-center justify-center rounded-xl border border-ink/15 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-ink shadow-lift transition hover:-translate-y-0.5 hover:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40"
                        href={`${DOCS_API_BASE}/documents/${processId}/items/${selectedFile.itemKey}/download/${selectedFile.file.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Baixar
                      </a>
                    </div>
                  </div>
                </div>
              )}
              {!previewLoading && !previewError && previewUrl && (
                <>
                  {selectedFile.file.mimeType === "application/pdf" ? (
                    <iframe className="h-full w-full" src={previewUrl} />
                  ) : (
                    <img alt={selectedFile.file.fileName} className="h-full w-full object-contain" src={previewUrl} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
