import crypto from "crypto";

const generateReferralCode = (id) => {
  return crypto
    .createHash("sha256")
    .update(id)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
};

export { generateReferralCode };
