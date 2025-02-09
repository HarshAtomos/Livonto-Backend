import express from "express";
import cors from "cors";
import passport from "./src/config/passport.js";
import authRoutes from "./src/routes/authRoutes.js";
import profileRoutes from "./src/routes/profileRoutes.js";
import propertyRoutes from "./src/routes/propertyRoutes.js";
import bookingRoutes from "./src/routes/bookingRoutes.js";
import complaintRoutes from "./src/routes/complaintRoutes.js";
import visitRoutes from "./src/routes/visitRoutes.js";
import reviewRoutes from "./src/routes/reviewRoutes.js";
import favoriteRoutes from "./src/routes/favoriteRoutes.js";

const app = express();
app.use(cors());
app.set("trust proxy", true);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(passport.initialize());

app.get("/", function (req, res) {
  res.send("I am working fine! Don't worry.");
});

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/property", propertyRoutes);
app.use("/api/v1/booking", bookingRoutes);
app.use("/api/v1/complaint", complaintRoutes);
app.use("/api/v1/visit", visitRoutes);
app.use("/api/v1/review", reviewRoutes);
app.use("/api/v1/favorite", favoriteRoutes);

export { app };
