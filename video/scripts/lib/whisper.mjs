/**
 * Local speech-to-text (whisper.cpp through @remotion/install-whisper-cpp).
 * Nothing leaves the machine. The binary and model install once into video/.whisper.
 */
import {
  downloadWhisperModel,
  installWhisperCpp,
  toCaptions,
  transcribe,
} from "@remotion/install-whisper-cpp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const WHISPER_DIR = path.join(root, ".whisper");
export const WHISPER_VERSION = "1.5.5";
export const DEFAULT_MODEL = "small.en";

export async function ensureWhisper(model = DEFAULT_MODEL) {
  await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION, printOutput: false });
  await downloadWhisperModel({ model, folder: WHISPER_DIR, printOutput: false });
}

/** 16 kHz mono WAV in -> word-level captions [{text, startMs, endMs}] out. */
export async function transcribeWords(wavPath, model = DEFAULT_MODEL) {
  await ensureWhisper(model);
  const json = await transcribe({
    inputPath: wavPath,
    whisperPath: WHISPER_DIR,
    whisperCppVersion: WHISPER_VERSION,
    model,
    modelFolder: WHISPER_DIR,
    tokenLevelTimestamps: true,
    splitOnWord: true,
    printOutput: false,
    language: "en",
  });
  const { captions } = toCaptions({ whisperCppOutput: json });
  return captions
    .map((c) => ({ text: c.text, startMs: c.startMs, endMs: c.endMs }))
    .filter((c) => c.text.trim());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const model = process.argv[2] || DEFAULT_MODEL;
  console.log(`Installing whisper.cpp ${WHISPER_VERSION} + ${model} into ${WHISPER_DIR} ...`);
  await ensureWhisper(model);
  console.log("ready");
}
