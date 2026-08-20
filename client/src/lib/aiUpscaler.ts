/* Precision Atelier AI layer: local-only ONNX inference, WebGPU first, WASM fallback. Keep model status explicit; never imply AI when the model is not running. */
import * as ort from "onnxruntime-web/webgpu";

const MODEL_URL = "https://huggingface.co/SceneWorks/real-esrgan-onnx/resolve/main/real_esrgan_x2.onnx?download=true";

export type AiRuntime = "webgpu" | "wasm";
export type AiSession = { session: ort.InferenceSession; runtime: AiRuntime; modelUrl: string };

export async function loadAiSession(onProgress?: (message: string) => void): Promise<AiSession> {
  onProgress?.("Downloading Real-ESRGAN x2 model…");
  try {
    const session = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["webgpu"],
      graphOptimizationLevel: "all",
    });
    return { session, runtime: "webgpu", modelUrl: MODEL_URL };
  } catch {
    onProgress?.("WebGPU unavailable; trying local WASM runtime…");
    const wasmOrt = await import("onnxruntime-web");
    const session = await wasmOrt.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    return { session, runtime: "wasm", modelUrl: MODEL_URL };
  }
}

export async function aiUpscaleImage(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  outputCanvas: HTMLCanvasElement,
  ai: AiSession,
  maxInputDimension = 512,
) {
  const ratio = Math.min(1, maxInputDimension / Math.max(sourceWidth, sourceHeight));
  const inputWidth = Math.max(32, Math.round(sourceWidth * ratio));
  const inputHeight = Math.max(32, Math.round(sourceHeight * ratio));
  const inputCanvas = document.createElement("canvas");
  inputCanvas.width = inputWidth;
  inputCanvas.height = inputHeight;
  const inputContext = inputCanvas.getContext("2d", { willReadFrequently: true });
  if (!inputContext) throw new Error("Canvas is unavailable in this browser.");
  inputContext.drawImage(source, 0, 0, inputWidth, inputHeight);
  const pixels = inputContext.getImageData(0, 0, inputWidth, inputHeight).data;
  const tensorData = new Float32Array(3 * inputWidth * inputHeight);
  const plane = inputWidth * inputHeight;
  for (let i = 0; i < plane; i++) {
    tensorData[i] = pixels[i * 4] / 255;
    tensorData[plane + i] = pixels[i * 4 + 1] / 255;
    tensorData[plane * 2 + i] = pixels[i * 4 + 2] / 255;
  }
  const input = new ort.Tensor("float32", tensorData, [1, 3, inputHeight, inputWidth]);
  const result = await ai.session.run({ [ai.session.inputNames[0]]: input });
  const output = result[ai.session.outputNames[0]];
  const [, , outputHeight, outputWidth] = output.dims;
  const values = output.data as Float32Array;
  const outputData = new ImageData(outputWidth, outputHeight);
  for (let i = 0; i < outputWidth * outputHeight; i++) {
    outputData.data[i * 4] = Math.max(0, Math.min(255, Math.round(values[i] * 255)));
    outputData.data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(values[outputWidth * outputHeight + i] * 255)));
    outputData.data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(values[2 * outputWidth * outputHeight + i] * 255)));
    outputData.data[i * 4 + 3] = 255;
  }
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  outputCanvas.getContext("2d")?.putImageData(outputData, 0, 0);
  input.dispose();
  output.dispose();
  return { width: outputWidth, height: outputHeight };
}

export function localEnhanceImage(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  outputCanvas: HTMLCanvasElement,
  scale = 2,
) {
  const width = Math.min(sourceWidth * scale, 4096);
  const height = Math.round((width / sourceWidth) * sourceHeight);
  outputCanvas.width = width;
  outputCanvas.height = height;
  const context = outputCanvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = "contrast(1.06) saturate(1.08) brightness(1.02)";
  context.drawImage(source, 0, 0, width, height);
  context.filter = "none";
  return { width, height };
}

export async function aiUpscaleFrame(
  source: HTMLVideoElement,
  outputCanvas: HTMLCanvasElement,
  ai: AiSession,
  maxInputDimension = 320,
) {
  const ratio = Math.min(1, maxInputDimension / Math.max(source.videoWidth, source.videoHeight));
  const inputWidth = Math.max(32, Math.round(source.videoWidth * ratio));
  const inputHeight = Math.max(32, Math.round(source.videoHeight * ratio));
  const inputCanvas = document.createElement("canvas");
  inputCanvas.width = inputWidth;
  inputCanvas.height = inputHeight;
  const inputContext = inputCanvas.getContext("2d", { willReadFrequently: true });
  if (!inputContext) throw new Error("Canvas is unavailable in this browser.");
  inputContext.drawImage(source, 0, 0, inputWidth, inputHeight);
  const pixels = inputContext.getImageData(0, 0, inputWidth, inputHeight).data;
  const tensorData = new Float32Array(1 * 3 * inputWidth * inputHeight);
  for (let i = 0; i < inputWidth * inputHeight; i++) {
    tensorData[i] = pixels[i * 4] / 255;
    tensorData[inputWidth * inputHeight + i] = pixels[i * 4 + 1] / 255;
    tensorData[2 * inputWidth * inputHeight + i] = pixels[i * 4 + 2] / 255;
  }
  const inputName = ai.session.inputNames[0];
  const outputName = ai.session.outputNames[0];
  const input = new ort.Tensor("float32", tensorData, [1, 3, inputHeight, inputWidth]);
  const result = await ai.session.run({ [inputName]: input });
  const output = result[outputName];
  const [, , outputHeight, outputWidth] = output.dims;
  const values = output.data as Float32Array;
  const outputData = new ImageData(outputWidth, outputHeight);
  const plane = outputWidth * outputHeight;
  for (let i = 0; i < plane; i++) {
    outputData.data[i * 4] = Math.max(0, Math.min(255, Math.round(values[i] * 255)));
    outputData.data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(values[plane + i] * 255)));
    outputData.data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(values[plane * 2 + i] * 255)));
    outputData.data[i * 4 + 3] = 255;
  }
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  outputCanvas.getContext("2d")?.putImageData(outputData, 0, 0);
  input.dispose();
  output.dispose();
  return { width: outputWidth, height: outputHeight };
}
