import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { PrismaClient } from "@prisma/client";
import { generateReferralCode } from "../utils/otherUtils.js";
const prisma = new PrismaClient();

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "/google/callback",
      scope: ["profile", "email"],
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      const { id, displayName, emails, photos } = profile;
      const email = emails[0].value;

      try {
        let user = await prisma.user.findUnique({ where: { googleId: id } });
        if (user && !user.referralCode) {
          const referralCode = generateReferralCode(id);
          user.referralCode = referralCode;
          await prisma.user.update({
            where: { id: user.id },
            data: { referralCode },
          });
        }
        if (user && !user.profileImage) {
          user.profileImage = photos[0].value;
          await prisma.user.update({
            where: { id: user.id },
            data: { profileImage: photos[0].value },
          });
        }
        if (!user) {
          const referralCode = generateReferralCode(id);
          user = await prisma.user.create({
            data: {
              googleId: id,
              email: email,
              username: displayName,
              name: displayName,
              referralCode,
              profileImage: photos[0].value,
            },
          });
        }

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// JWT Strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
      });

      if (user) {
        return done(null, user);
      }

      return done(null, false);
    } catch (err) {
      return done(err, false);
    }
  })
);

export default passport;
