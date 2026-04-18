process.env.DISABLE_GEMINI_ASSISTANT =
  process.env.DISABLE_GEMINI_ASSISTANT ?? "true";
process.env.PORT = process.env.PORT ?? "8080";

await import("../dist/index.js");
