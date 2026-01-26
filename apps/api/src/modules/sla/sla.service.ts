import dayjs from "dayjs";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { StepKey, StepSide } from "@prisma/client";

@Injectable()
export class SlaService {
  constructor(private readonly prisma: PrismaService) {}

  async startSla(processId: string, stepKey: StepKey, side: StepSide) {
    const config = await this.prisma.slaConfigStep.findUnique({
      where: { stepKey_side: { stepKey, side } }
    });
    if (!config) {
      return;
    }
    const startedAt = new Date();
    const dueAt = dayjs(startedAt).add(config.durationHours, "hour").toDate();
    await this.prisma.slaEvent.upsert({
      where: { processId_stepKey_side: { processId, stepKey, side } },
      update: {
        startedAt,
        dueAt,
        status: "ON_TRACK"
      },
      create: {
        processId,
        stepKey,
        side,
        startedAt,
        dueAt,
        status: "ON_TRACK"
      }
    });
  }

  async stopSla(processId: string, stepKey: StepKey, side: StepSide) {
    await this.prisma.slaEvent.updateMany({
      where: { processId, stepKey, side },
      data: { status: "STOPPED" }
    });
  }

  async stopAll(processId: string) {
    await this.prisma.slaEvent.updateMany({
      where: { processId },
      data: { status: "STOPPED" }
    });
  }

  async listConfig() {
    return this.prisma.slaConfigStep.findMany({ orderBy: [{ stepKey: "asc" }, { side: "asc" }] });
  }

  async updateConfig(stepKey: StepKey, side: StepSide, durationHours: number, alertPercent: number) {
    return this.prisma.slaConfigStep.upsert({
      where: { stepKey_side: { stepKey, side } },
      update: { durationHours, alertPercent },
      create: { stepKey, side, durationHours, alertPercent }
    });
  }
}
