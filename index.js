import dotenv from "dotenv";
import { app } from "./app.js";
import prisma from "./src/utils/prisma.js";

dotenv.config({ path: "./.env" });

const checkDBConnection = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connection successful.");
  } catch (error) {
    console.error("❌ Database connection failed: ", error);
    throw error;
  }
};

const startServer = async () => {
  try {
    await checkDBConnection();

    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => {
      console.log(`⚙️ Server is running at http://localhost:${PORT}/`);
    });
  } catch (err) {
    console.error("❌ Server initialization failed.", err);
    process.exit(1);
  }
};

startServer();
