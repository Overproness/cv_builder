const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load env
const envPath = path.resolve(process.cwd(), ".env.local");
try {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
} catch (e) {
  console.error("Could not read .env.local");
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is missing");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

(async () => {
  try {
    console.log("Trying gemini-pro...");
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent("Hello");
    console.log("Response from gemini-pro:", result.response.text());
  } catch (e) {
    console.error("Error with gemini-pro:", e.message);
  }

  try {
    console.log("Trying gemini-3.1-flash-lite-preview...");
    const model3 = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
    });
    const result3 = await model3.generateContent("Hello");
    console.log(
      "Response from gemini-3.1-flash-lite-preview:",
      result3.response.text(),
    );
  } catch (e3) {
    console.error("Error with gemini-3.1-flash-lite-preview:", e3.message);
  }

  try {
    console.log("Trying gemini-flash-latest...");
    const model4 = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result4 = await model4.generateContent("Hello");
    console.log("Response from gemini-flash-latest:", result4.response.text());
  } catch (e4) {
    console.error("Error with gemini-flash-latest:", e4.message);
  }
})();
