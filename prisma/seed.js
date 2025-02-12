import { PrismaClient, user_role } from "@prisma/client";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();

async function main() {
  // Create root admin
  const hashedPassword = await bcrypt.hash("root", 10);
  const existingRootAdmin = await prisma.user.findFirst({
    where: { username: "root" },
  });
  if (!existingRootAdmin) {
    await prisma.user.create({
      data: {
        username: "root",
        password: hashedPassword,
        role: user_role.ADMIN,
        email: "root@admin.com",
      },
    });
    console.log("Root admin created successfully");
  } else {
    console.log("Root admin already exists");
  }
  // Create amenities
  const amenitiesData = [
    { name: "WiFi", svgIcon: "wifi.svg" },
    { name: "AC", svgIcon: "ac.svg" },
    { name: "Geyser", svgIcon: "geyser.svg" },
    { name: "TV", svgIcon: "tv.svg" },
    { name: "Washing Machine", svgIcon: "washing-machine.svg" },
    { name: "Power Backup", svgIcon: "power-backup.svg" },
    { name: "CCTV", svgIcon: "cctv.svg" },
    { name: "Warden", svgIcon: "security.svg" },
    { name: "Car Parking", svgIcon: "parking.svg" },
    { name: "Kitchen", svgIcon: "kitchen.svg" },
    { name: "Refrigerator", svgIcon: "refrigerator.svg" },
    { name: "Study Table", svgIcon: "study-table.svg" },
    { name: "Cupboard", svgIcon: "cupboard.svg" },
    { name: "Room Cleaning", svgIcon: "room-cleaning.svg" },
    { name: "Laundry", svgIcon: "laundry.svg" },
    { name: "Water Cooler", svgIcon: "water-cooler.svg" },
    { name: "Microwave", svgIcon: "microwave.svg" },
    { name: "Lift", svgIcon: "lift.svg" },
    { name: "Swimming Pool", svgIcon: "swimming-pool.svg" },
    { name: "Gym", svgIcon: "gym.svg" },
    { name: "Balcony", svgIcon: "balcony.svg" },
    { name: "2-Wheeler Parking", svgIcon: "2-wheeler-parking.svg" },
    { name: "Attached Washroom", svgIcon: "attached-washroom.svg" },
  ];
  for (const amenityData of amenitiesData) {
    const existingAmenity = await prisma.amenity.findFirst({
      where: { name: amenityData.name },
    });

    if (!existingAmenity) {
      await prisma.amenity.create({
        data: amenityData,
      });
    }
  }
  console.log("Amenities created successfully");
  // Create house rules
  const houseRulesData = [
    { rule: "Smoking", svgIcon: "no-smoking.svg" },
    { rule: "Drinking", svgIcon: "no-alcohol.svg" },
    { rule: "Pets", svgIcon: "no-pets.svg" },
    { rule: "Parties", svgIcon: "no-parties.svg" },
    { rule: "Loud Music", svgIcon: "no-loud-music.svg" },
    { rule: "Visitor Entry", svgIcon: "visitor-entry.svg" },
    { rule: "Opposite Gender", svgIcon: "opposite-gender.svg" },
    { rule: "Non Veg Food", svgIcon: "non-veg-food.svg" },
  ];

  // Check existing rules and insert only new ones
  for (const ruleData of houseRulesData) {
    const existingRule = await prisma.houseRule.findFirst({
      where: { rule: ruleData.rule },
    });

    if (!existingRule) {
      await prisma.houseRule.create({
        data: ruleData,
      });
    }
  }
  console.log("House rules created successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
