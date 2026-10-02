import { defineConfig, devices } from "@playwright/test";
export default defineConfig({testDir:"./e2e",use:{baseURL:"http://127.0.0.1:8082",...devices["Desktop Chrome"]},
 webServer:{command:"npm run dev -- --port 8082 --strictPort",url:"http://127.0.0.1:8082",reuseExistingServer:false}});
