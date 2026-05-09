import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const swaggerPath = path.join(__dirname, "../../docs/swagger.yml");

export const openApiDocument = yaml.load(
    fs.readFileSync(swaggerPath, "utf-8")
) as Record<string, unknown>;