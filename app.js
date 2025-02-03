import express from "express";
import cors from "cors";
import passport from "./src/config/passport.js";

// import profileRouter from "./routes/profile.routes.js";
// import authRouter from "./routes/auth.routes.js";
import authRoutes from "./src/routes/authRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";

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
app.use("/api/v1/admin", adminRoutes);
// app.use("/api/v1/auth", authRouter);
// app.use("/api/v1/profile", profileRouter);

export { app };
