import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Master@123", 10);

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
