import {describe, expect, it} from "vitest";
import {validateUpstreamValidationRecord} from "../../src/provenance/upstream-validation.js";
import {sha256} from "../../src/provenance/pointer.js";
import {expectCode, makeUpstreamValidation, UPSTREAM_TEST_COMMIT} from "../helpers.js";

describe("固定 commit 的上游校验证据", () => {
  it("接受字段、命令、日志行和哈希全部一致的证据", () => {
    const evidence = makeUpstreamValidation();
    const validated = validateUpstreamValidationRecord(evidence, UPSTREAM_TEST_COMMIT);
    expect(validated.commit).toBe(UPSTREAM_TEST_COMMIT);
    expect(validated.logSha256).toBe(evidence.logSha256);
    expect(validated).not.toBe(evidence);
  });

  it("commit 与节点快照不一致时拒绝", async () => {
    const evidence = makeUpstreamValidation();
    evidence.commit = "0".repeat(40);
    await expectCode(
      () => validateUpstreamValidationRecord(evidence, UPSTREAM_TEST_COMMIT),
      "E_NODE_SCOPE",
    );
  });

  it("日志或哈希被篡改，以及成功标记被删除时拒绝", async () => {
    const badHash = makeUpstreamValidation();
    badHash.logSha256 = "0".repeat(64);
    await expectCode(
      () => validateUpstreamValidationRecord(badHash, UPSTREAM_TEST_COMMIT),
      "E_NODE_SCOPE",
    );

    const badLog = makeUpstreamValidation();
    badLog.log = badLog.log.replace("UPSTREAM_VALIDATION_PASSED", "UPSTREAM_VALIDATION_FAILED");
    badLog.logSha256 = sha256(badLog.log);
    await expectCode(
      () => validateUpstreamValidationRecord(badLog, UPSTREAM_TEST_COMMIT),
      "E_NODE_SCOPE",
    );
  });
});
