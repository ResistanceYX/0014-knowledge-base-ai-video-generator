export const ERROR_CODES = [
  "E_INPUT_SCHEME",
  "E_INPUT_HOST",
  "E_INPUT_PATH",
  "E_INPUT_VERSION",
  "E_INPUT_REDIRECT",
  "E_INPUT_SIZE",
  "E_INPUT_TIMEOUT",
  "E_INPUT_NETWORK",
  "E_LICENSE_MISMATCH",
  "E_OUTPUT_EXISTS",
  "E_YAML_PARSE",
  "E_NODE_SCHEMA",
  "E_NODE_SCOPE",
  "E_NODE_LIMIT",
  "E_JSON_PARSE",
  "E_SCENE_SCHEMA",
  "E_SCENE_SEMANTICS",
  "E_SOURCE_SCHEMA",
  "E_SOURCE_ORPHAN",
  "E_SOURCE_COVERAGE",
  "E_SOURCE_POINTER",
  "E_SOURCE_EXCERPT",
  "E_SOURCE_SNAPSHOT",
  "E_LIMIT_DROPPED",
  "E_REVIEW_REQUIRED",
  "E_PAID_GATE",
  "E_DERIVED_STALE",
  "E_MEDIA_CONFIG",
  "E_SPEECH_MODE",
  "E_AUDIO",
  "E_AUDIO_PROBE",
  "E_COMPOSITION",
  "E_BROWSER",
  "E_RENDER",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ValidationIssue {
  code: ErrorCode;
  location: string;
  message: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly location: string;
  readonly issues: readonly ValidationIssue[];

  constructor(code: ErrorCode, message: string, location = "input", issues?: readonly ValidationIssue[]) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.location = location;
    this.issues = issues ?? [{code, location, message}];
  }
}

export function issue(code: ErrorCode, location: string, message: string): ValidationIssue {
  return {code, location, message};
}

export function throwIssues(code: ErrorCode, issues: readonly ValidationIssue[]): never {
  const first = issues[0];
  throw new AppError(code, first?.message ?? "校验失败", first?.location ?? "input", issues);
}
