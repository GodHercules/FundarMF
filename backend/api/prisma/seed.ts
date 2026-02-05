import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Fundar0502MF", 10);

  const master = await prisma.user.upsert({
    where: { email: "master@fundarmf.com.br" },
    update: {
      name: "Master Admin",
      whatsapp: "+55 71 98888-0000",
      passwordHash,
      role: "MASTER"
    },
    create: {
      email: "master@fundarmf.com.br",
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
