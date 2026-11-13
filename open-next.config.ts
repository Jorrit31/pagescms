import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();
// Run migrations separately (npm run db:migrate), not during the Cloudflare build.
config.buildCommand = "npx next build";

export default config;
