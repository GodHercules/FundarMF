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
    const master = await prisma.user.upsert({
        where: { email: "master@fundarmf.local" },
        update: {},
        create: {
            email: "master@fundarmf.local",
            name: "Master Admin",
            whatsapp: "+55 71 98888-0000",
            passwordHash,
            role: "MASTER"
        }
    });
    console.log("Seeded master", master.email);
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
