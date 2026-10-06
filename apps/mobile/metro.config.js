import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDefaultConfig } from "expo/metro-config.js";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...new Set([...config.watchFolders, monorepoRoot])];
config.resolver.nodeModulesPaths = [
  ...new Set([
    path.resolve(projectRoot, "node_modules"),
    path.resolve(monorepoRoot, "node_modules"),
    ...config.resolver.nodeModulesPaths,
  ]),
];

export default config;
