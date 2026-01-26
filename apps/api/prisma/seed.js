"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    const passwordHash = await bcryptjs_1.default.hash("Master@123", 10);
    const employeeHash = await bcryptjs_1.default.hash("Func@123", 10);
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
            status: client_1.ProcessStatus.EM_ANDAMENTO,
            currentStep: client_1.StepKey.ETAPA_2,
            ownerId: employee.id,
            steps: {
                create: [
                    {
                        stepKey: client_1.StepKey.ETAPA_1,
                        side: client_1.StepSide.CLIENTE,
                        status: client_1.ProcessStatus.EM_ANDAMENTO,
                        data: {
                            nome: "Cliente Demo",
                            email: "cliente@fundarmf.local",
                            telefone: "+55 71 99999-0000"
                        }
                    },
                    {
                        stepKey: client_1.StepKey.ETAPA_2,
                        side: client_1.StepSide.CLIENTE,
                        status: client_1.ProcessStatus.AGUARDANDO_FUNCIONARIO,
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
                        stepKey: client_1.StepKey.ETAPA_2,
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
                    { itemKey: client_1.DocumentItemKey.IDENTIFICACAO_SOCIOS },
                    { itemKey: client_1.DocumentItemKey.COMPROVANTE_RESIDENCIA },
                    { itemKey: client_1.DocumentItemKey.FOTO_FACHADA }
                ]
            },
            ownerHistory: {
                create: [{ ownerId: employee.id, assignedBy: master.id }]
            }
        }
    });
    const slaDefaults = [
        { stepKey: client_1.StepKey.ETAPA_1, side: client_1.StepSide.CLIENTE, durationHours: 24 },
        { stepKey: client_1.StepKey.ETAPA_2, side: client_1.StepSide.CLIENTE, durationHours: 48 },
        { stepKey: client_1.StepKey.ETAPA_2, side: client_1.StepSide.FUNCIONARIO, durationHours: 24 },
        { stepKey: client_1.StepKey.ETAPA_3, side: client_1.StepSide.FUNCIONARIO, durationHours: 24 },
        { stepKey: client_1.StepKey.ETAPA_4, side: client_1.StepSide.CLIENTE, durationHours: 48 },
        { stepKey: client_1.StepKey.ETAPA_4, side: client_1.StepSide.FUNCIONARIO, durationHours: 24 },
        { stepKey: client_1.StepKey.ETAPA_5, side: client_1.StepSide.CLIENTE, durationHours: 24 },
        { stepKey: client_1.StepKey.ETAPA_5, side: client_1.StepSide.FUNCIONARIO, durationHours: 24 },
        { stepKey: client_1.StepKey.ETAPA_6, side: client_1.StepSide.CLIENTE, durationHours: 48 },
        { stepKey: client_1.StepKey.ETAPA_6, side: client_1.StepSide.FUNCIONARIO, durationHours: 24 }
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
//# sourceMappingURL=seed.js.map