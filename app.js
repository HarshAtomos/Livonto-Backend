import express from "express";
import cors from "cors";
import passport from "./src/config/passport.js";
import authRoutes from "./src/routes/authRoutes.js";

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

export { app };
