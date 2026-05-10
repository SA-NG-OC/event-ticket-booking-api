import path from "path";
import yaml from "js-yaml";
import fs from "fs";

const docsDir = path.join(__dirname, "../../docs");

function loadYaml(filePath: string): Record<string, unknown> {
    return yaml.load(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
}

export function loadOpenApiDocument(): Record<string, unknown> {
    const base = loadYaml(path.join(docsDir, "swagger.yml"));

    const pathsFiles = [
        "paths/auth.yml",
        "paths/concerts.yml",
        "paths/bookings.yml",
        "paths/vouchers.yml",
    ];

    const mergedPaths: Record<string, unknown> = {};
    for (const file of pathsFiles) {
        const paths = loadYaml(path.join(docsDir, file));
        Object.assign(mergedPaths, paths);
    }

    base.paths = mergedPaths;
    return base;
}