import {readFileSync} from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import type {Ajv2020 as Ajv2020Instance, ValidateFunction} from "ajv/dist/2020.js";
import type {FormatsPlugin} from "ajv-formats";
import {PACKAGE_ROOT} from "../config.js";
import {AppError, issue, type ErrorCode} from "../errors.js";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js") as typeof import("ajv/dist/2020.js").Ajv2020;
const addFormats = require("ajv-formats") as FormatsPlugin;

let ajv: Ajv2020Instance | undefined;
const validators = new Map<string, ValidateFunction>();

function getAjv(): Ajv2020Instance {
  if (!ajv) {
    ajv = new Ajv2020({allErrors: true, strict: true});
    addFormats(ajv);
  }
  return ajv;
}

export function validateJsonSchema<T>(schemaFile: string, data: unknown, code: ErrorCode): T {
  let validate = validators.get(schemaFile);
  if (!validate) {
    const schema = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, "schemas", schemaFile), "utf8")) as object;
    validate = getAjv().compile(schema);
    validators.set(schemaFile, validate);
  }
  if (!validate(data)) {
    const issues = (validate.errors ?? []).map((error) => issue(
      code,
      error.instancePath || "/",
      `${error.message ?? "Schema 校验失败"}${error.params ? ` ${JSON.stringify(error.params)}` : ""}`,
    ));
    throw new AppError(code, `${schemaFile} 校验失败：${issues[0]?.message ?? "未知错误"}`, issues[0]?.location ?? "/", issues);
  }
  return data as T;
}
