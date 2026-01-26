import { PrismaClient, StepKey, StepSide, ProcessStatus, DocumentItemKey } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Master@123", 10);
  const employeeHash = await bcrypt.hash("Func@123", 10);

  const master = await prisma.user.upsert({
    where: { email: "master@fundarmf.local" },
    update: {},
    create: {
      email: "master@fundarmf.local",
      name: "Master Admin",
      passwordHash,
      role: "MASTER"
    }
  });

  const employee = await prisma.user.upsert({
    where: { email: "funcionario@fundarmf.local" },
    update: {},
    create: {
      email: "funcionario@fundarmf.local",
      name: "Funcionario Exemplo",
      passwordHash: employeeHash,
      role: "EMPLOYEE"
    }
  });

  const process = await prisma.process.create({
    data: {
      clientEmail: "cliente@fundarmf.local",
      clientName: "Cliente Demo",
      clientPhone: "+55 71 99999-0000",
      status: ProcessStatus.EM_ANDAMENTO,
      currentStep: StepKey.ETAPA_2,
      ownerId: employee.id,
      steps: {
        create: [
          {
            stepKey: StepKey.ETAPA_1,
            side: StepSide.CLIENTE,
            status: ProcessStatus.EM_ANDAMENTO,
            data: {
              nome: "Cliente Demo",
              email: "cliente@fundarmf.local",
              telefone: "+55 71 99999-0000"
            }
          },
          {
            stepKey: StepKey.ETAPA_2,
            side: StepSide.CLIENTE,
            status: ProcessStatus.AGUARDANDO_FUNCIONARIO,
            data: {
              razoesSociais: ["Razao 1", "Razao 2", "Razao 3"],
              municipio: "Salvador",
              cnae: "6201-5/01",
              emailCnpj: "cnpj@cliente.local",
              telefoneCnpj: "+55 71 98888-7777",
              tributacao: "Simples"
            }
          }
        ]
      },
      checklists: {
        create: [
          {
            stepKey: StepKey.ETAPA_2,
            status: "PENDENTE",
            items: {
              razoesSociais: false,
              municipio: true,
              contatoCnpj: true,
              tributacao: true,
              cnae: true
            }
          }
        ]
      },
      documents: {
        create: [
          { itemKey: DocumentItemKey.IDENTIFICACAO_SOCIOS },
          { itemKey: DocumentItemKey.COMPROVANTE_RESIDENCIA },
          { itemKey: DocumentItemKey.FOTO_FACHADA }
        ]
      },
      ownerHistory: {
        create: [{ ownerId: employee.id, assignedBy: master.id }]
      }
    }
  });

  const slaDefaults = [
    { stepKey: StepKey.ETAPA_1, side: StepSide.CLIENTE, durationHours: 24 },
    { stepKey: StepKey.ETAPA_2, side: StepSide.CLIENTE, durationHours: 48 },
    { stepKey: StepKey.ETAPA_2, side: StepSide.FUNCIONARIO, durationHours: 24 },
    { stepKey: StepKey.ETAPA_3, side: StepSide.FUNCIONARIO, durationHours: 24 },
    { stepKey: StepKey.ETAPA_4, side: StepSide.CLIENTE, durationHours: 48 },
    { stepKey: StepKey.ETAPA_4, side: StepSide.FUNCIONARIO, durationHours: 24 },
    { stepKey: StepKey.ETAPA_5, side: StepSide.CLIENTE, durationHours: 24 },
    { stepKey: StepKey.ETAPA_5, side: StepSide.FUNCIONARIO, durationHours: 24 },
    { stepKey: StepKey.ETAPA_6, side: StepSide.CLIENTE, durationHours: 48 },
    { stepKey: StepKey.ETAPA_6, side: StepSide.FUNCIONARIO, durationHours: 24 }
  ];

  for (const config of slaDefaults) {
    await prisma.slaConfigStep.upsert({
      where: {
        stepKey_side: {
          stepKey: config.stepKey,
          side: config.side
        }
      },
      update: {
        durationHours: config.durationHours,
        alertPercent: 80
      },
      create: {
        ...config,
        alertPercent: 80
      }
    });
  }

  await prisma.auditEvent.create({
    data: {
      actorRole: "SYSTEM",
      action: "seed",
      entity: "Process",
      entityId: process.id,
      metadata: { message: "Seeded initial process" }
    }
  });

  console.log("Seeded master", master.email, "employee", employee.email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
