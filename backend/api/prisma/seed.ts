import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_MASTER_PASSWORD?.trim();
  if (!password || password.length < 16) {
    throw new Error("SEED_MASTER_PASSWORD must be set and contain at least 16 characters.");
  }
  const email = process.env.SEED_MASTER_EMAIL?.trim() || "master@fundarmf.com.br";
  const passwordHash = await bcrypt.hash(password, 12);

  const master = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Master Admin",
      whatsapp: "+55 71 98888-0000",
      passwordHash,
      role: "MASTER"
    },
    create: {
      email,
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
