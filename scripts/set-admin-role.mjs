// One-off script to bootstrap the first admin account — there's no UI that
// can do this before an admin exists.
//
// Usage: npm run set-admin -- <email>
//    or: node scripts/set-admin-role.mjs <email>

// import { loadEnvConfig } from "@next/env";
import nextEnv from "@next/env";
import mongoose from "mongoose";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run set-admin -- <email>");
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set (check .env.local)");
  process.exit(1);
}

const UserSchema = new mongoose.Schema(
  { email: String, role: String },
  { strict: false },
);
const User = mongoose.models.User || mongoose.model("User", UserSchema);

await mongoose.connect(MONGODB_URI);

const result = await User.updateOne({ email }, { $set: { role: "admin" } });

if (result.matchedCount === 0) {
  console.error(`No user found with email: ${email}`);
  process.exitCode = 1;
} else {
  console.log(
    `${email} is now an admin. Log out and back in for it to take effect.`,
  );
}

await mongoose.disconnect();
