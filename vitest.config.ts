// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        globals: true,
        fileParallelism: false,
        environment: "node",
        globalSetup: "./src/tests/setup/global.ts",
        setupFiles: ["./src/tests/setup/each.ts"],
        env: {
            DB_PORT: "5434",
            DB_NAME: "concert_test_db",
            NODE_ENV: "test",
        },
        testTimeout: 15000,
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            include: ["src/**/*.ts"],
            exclude: [
                "src/infrastructure/db/migrations/**",
                "src/infrastructure/db/seed.ts",
                "src/**/*.schema.ts",
                "src/docs/**",
            ],
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
});