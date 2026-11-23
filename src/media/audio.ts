import path from "node:path";
import {spawn} from "node:child_process";
import {lstat, mkdir, writeFile} from "node:fs/promises";
import {AppError} from "../errors.js";

export interface AudioMetadata {
  durationMs: number;
  codec: string;
  sampleRate: number | null;
  channels: number | null;
}

export function safeProjectPath(project: string, relative: string): string {
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).includes("..")) throw new AppError("E_AUDIO", "音频路径越界", relative);
  const root = path.resolve(project);
  const output = path.resolve(root, relative);
  if (!output.startsWith(`${root}${path.sep}`)) throw new AppError("E_AUDIO", "音频路径越界", relative);
  return output;
}

export async function assertRegularFile(filename: string): Promise<void> {
  const info = await lstat(filename);
  if (!info.isFile() || info.isSymbolicLink()) throw new AppError("E_AUDIO", "音频必须是普通文件，不能是符号链接", filename);
}

export async function runProcess(options: {
  command: string;
  args: string[];
  timeoutMs: number;
  errorCode: "E_AUDIO" | "E_AUDIO_PROBE" | "E_SPEECH_MODE";
  env?: NodeJS.ProcessEnv;
}): Promise<{stdout: string; stderr: string}> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      shell: false,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new AppError(options.errorCode, `${options.command} 执行超过 ${options.timeoutMs}ms`, options.command)));
    }, options.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (stdout.length > 2_000_000) child.kill("SIGKILL");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 2_000_000) stderr = stderr.slice(-2_000_000);
    });
    child.on("error", (error) => finish(() => reject(new AppError(options.errorCode, `无法启动 ${options.command}：${error.message}`, options.command))));
    child.on("close", (code, signal) => finish(() => {
      if (code !== 0) {
        reject(new AppError(options.errorCode, `${options.command} 失败（code=${code ?? "null"}, signal=${signal ?? "null"}）：${stderr.slice(-1600) || stdout.slice(-1600)}`, options.command));
        return;
      }
      resolve({stdout, stderr});
    }));
  });
}

export async function probeAudio(filename: string, timeoutMs = 15_000): Promise<AudioMetadata> {
  await assertRegularFile(filename);
  const {stdout} = await runProcess({
    command: "ffprobe",
    args: ["-v", "error", "-show_entries", "format=duration:stream=codec_name,sample_rate,channels", "-of", "json", filename],
    timeoutMs,
    errorCode: "E_AUDIO_PROBE",
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout) as unknown;
  } catch {
    throw new AppError("E_AUDIO_PROBE", "ffprobe 未返回有效 JSON", filename);
  }
  const root = parsed as {format?: {duration?: string}; streams?: Array<{codec_name?: string; sample_rate?: string; channels?: number}>};
  const durationSeconds = Number(root.format?.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 600) throw new AppError("E_AUDIO_PROBE", "音频时长无效或超过单段 600 秒上限", filename);
  const stream = root.streams?.[0];
  if (!stream?.codec_name) throw new AppError("E_AUDIO_PROBE", "音频缺少可识别编码", filename);
  const sampleRate = Number(stream.sample_rate);
  return {
    durationMs: Math.round(durationSeconds * 1000),
    codec: stream.codec_name,
    sampleRate: Number.isInteger(sampleRate) && sampleRate > 0 ? sampleRate : null,
    channels: Number.isInteger(stream.channels) ? stream.channels! : null,
  };
}

function wavHeader(dataLength: number, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

export async function writeToneWav(filename: string, durationMs: number, seed: number): Promise<void> {
  if (!Number.isInteger(durationMs) || durationMs < 40 || durationMs > 2000) throw new AppError("E_AUDIO", "fixture 时长必须位于 40—2000ms", filename);
  const sampleRate = 24_000;
  const sampleCount = Math.round(sampleRate * durationMs / 1000);
  const samples = Buffer.alloc(sampleCount * 2);
  const frequency = 330 + Math.abs(seed % 7) * 45;
  for (let index = 0; index < sampleCount; index += 1) {
    const fade = Math.min(1, index / 120, (sampleCount - index - 1) / 120);
    const value = Math.round(Math.sin(2 * Math.PI * frequency * index / sampleRate) * 7000 * Math.max(0, fade));
    samples.writeInt16LE(value, index * 2);
  }
  await mkdir(path.dirname(filename), {recursive: true});
  await writeFile(filename, Buffer.concat([wavHeader(samples.length, sampleRate), samples]));
}
