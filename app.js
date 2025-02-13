import express from "express";
import cors from "cors";
import passport from "./src/config/passport.js";
import authRoutes from "./src/routes/authRoutes.js";
import profileRoutes from "./src/routes/profileRoutes.js";
import propertyRoutes from "./src/routes/propertyRoutes.js";
import visitRoutes from "./src/routes/visitRoutes.js";
const app = express();
app.use(cors());
app.set("trust proxy", true);

const allowedOrigins = process.env.CORS_ORIGIN?.split(",") || [
  "http://localhost:3000",
  "http://admin.localhost:3000",
  "http://dashboard.localhost:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        process.env.NODE_ENV === "development"
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
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
app.use("/api/v1/visit", visitRoutes);

export { app };
