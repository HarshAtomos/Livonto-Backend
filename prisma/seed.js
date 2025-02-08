import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();

async function main() {
  await prisma.role.createMany({
    data: [
      { id: 0, role_name: "root" },
      { id: 1, role_name: "user" },
      { id: 2, role_name: "property_owner" },
      { id: 3, role_name: "property_manager" },
      { id: 4, role_name: "employee" },
    ],
  });
  console.log("Roles created successfully");
  const hashedPassword = await bcrypt.hash("root", 10);
  await prisma.user.create({
    data: {
      username: "root",
      password: hashedPassword,
      role_id: 0,
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
