# AI Runtime Decision

The implementation target is ONNX Runtime Web with the WebGPU execution provider, with WebAssembly fallback. Official ONNX Runtime documentation states that WebGPU is intended for compute-intensive browser workloads and is available in current Chrome/Edge on supported platforms; the runtime is imported from `onnxruntime-web/webgpu` and sessions explicitly request `executionProviders: ['webgpu']`. WebAssembly remains the broadest compatibility fallback. WebGL is in maintenance mode and is not the preferred new path.

References:

1. [ONNX Runtime WebGPU Execution Provider](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)
2. [ONNX Runtime Web JavaScript getting started and browser support](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)
3. [web-realesrgan browser implementation](https://github.com/xororz/web-realesrgan)

Decision: add runtime capability detection and an AI-ready processing path only if a verified ONNX model can be loaded from a stable public asset. Preserve current Canvas scaling as the guaranteed fallback. Do not claim AI enhancement when the model is unavailable or not actually executed.
