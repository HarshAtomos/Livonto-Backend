import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("root", 10);
  await prisma.admin.create({
    data: {
      username: "root",
      password: hashedPassword,
      role: "root",
    },
  });
  console.log("Root admin created successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
