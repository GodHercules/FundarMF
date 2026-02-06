import dayjs from "dayjs";
import { Injectable } from "@nestjs/common";
import { DocumentItemStatus, ProcessStatus, SlaStatus } from "@prisma/client";
import { PrismaService } from "../../shared/prisma.service";
import { timeAsync } from "../../shared/perf";

type MunicipalityCache = {
  value: string[];
  expiresAt: number;
};

let municipalitiesCache: MunicipalityCache | null = null;

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    const [slaConfigs, slaAlerts, auditedDocuments, completedProcesses] = await Promise.all([
      this.prisma.slaConfigStep.count(),
      this.prisma.slaEvent.count({ where: { status: { in: [SlaStatus.AT_RISK, SlaStatus.OVERDUE] } } }),
      this.prisma.documentItem.count({
        where: { status: { in: [DocumentItemStatus.APROVADO, DocumentItemStatus.REPROVADO] } }
      }),
      this.prisma.process.findMany({
        where: { status: ProcessStatus.CONCLUIDO },
        select: { createdAt: true, updatedAt: true }
      })
    ]);

    let avgCompletionDays = 0;
    if (completedProcesses.length > 0) {
      const totalDays = completedProcesses.reduce((sum, process) => {
        return sum + dayjs(process.updatedAt).diff(process.createdAt, "day", true);
      }, 0);
      avgCompletionDays = totalDays / completedProcesses.length;
    }

    return {
      criticalSteps: slaConfigs,
      avgCompletionDays,
      activeAlerts: slaAlerts,
      auditedDocuments
    };
  }

  async getMunicipalities() {
    const now = Date.now();
    if (municipalitiesCache && municipalitiesCache.expiresAt > now) {
      return { items: municipalitiesCache.value, cached: true };
    }

    try {
      const response = await timeAsync("externalMs", () =>
        fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios", {
          headers: { Accept: "application/json" }
        })
      );
      if (!response.ok) {
        throw new Error("IBGE unavailable");
      }
      const data = (await response.json()) as Array<Record<string, any>>;
      const list = data
        .map((municipio) => {
          const uf = municipio?.microrregiao?.mesorregiao?.UF?.sigla ?? municipio?.UF?.sigla ?? "";
          return uf ? `${municipio.nome} - ${uf}` : municipio.nome;
        })
        .filter(Boolean)
        .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));

      municipalitiesCache = {
        value: list,
        expiresAt: now + 24 * 60 * 60 * 1000
      };

      return { items: list, cached: false };
    } catch {
      return { items: municipalitiesCache?.value ?? [], cached: true };
    }
  }
}
