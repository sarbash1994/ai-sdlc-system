const required = ["OPENAI_API_KEY", "REDIS_URL"];
const optional = ["TELEGRAM_BOT_TOKEN", "GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"];

for (const name of required) {
  if (!process.env[name]) {
    console.error(`${name} is required`);
    process.exitCode = 1;
  }
}

for (const name of optional) {
  if (!process.env[name]) {
    console.warn(`${name} is not set`);
  }
}
