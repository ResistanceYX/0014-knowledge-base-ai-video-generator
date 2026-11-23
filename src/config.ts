import {fileURLToPath} from "node:url";

export const PACKAGE_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const FORMAT_VERSION = "idea-tree-node-format-v1.9";
export const SCHEMA_VERSION = "0.1.0";
export const PARSER_VERSION = "0.1.0-m1";
export const MEDIA_VERSION = "0.3.0-m3";
export const FULL_COMPOSITION_ID = "IdeaTreeFull";
export const MAX_INPUT_BYTES = 1_048_576;
export const MAX_JSON_BYTES = 5_242_880;
export const INPUT_TIMEOUT_MS = 10_000;
