/* Precision Atelier: a warm editorial post-production workbench. Use asymmetry, tactile paper surfaces, coral action states, mineral-green privacy cues, and monospace technical readouts. */
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Download,
  FileVideo,
  Film,
  Info,
  LockKeyhole,
  Play,
  RotateCcw,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { aiUpscaleFrame, aiUpscaleImage, loadAiSession, localEnhanceImage, type AiSession } from "@/lib/aiUpscaler";

const logoUrl = "/manus-storage/signal-frame-logo_e57c72af.png";
const emptyArt = "/manus-storage/calibration-empty-state_2ddaaed8.png";
const privacyArt = "/manus-storage/local-processing-privacy_f5f54573.png";
const comparisonArt = "/manus-storage/comparison-preview_b1701143.png";
const exportArt = "/manus-storage/export-complete_16c66d34.png";
const targetOptions = [{ id: "1080p", label: "1080p", width: 1920 }, { id: "1440p", label: "1440p", width: 2560 }, { id: "2k", label: "2K", width: 2048 }, { id: "4k", label: "4K", width: 3840 }] as const;

type TargetId = (typeof targetOptions)[number]["id"];
function resolutionLabel(width: number, height: number) {
  if (height >= 2160) return "4K";
  if (width >= 2000 && height >= 1000 && height < 1440) return "2K";
  if (height >= 1440) return "1440p";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  return "SD";
}

function targetDimensions(sourceWidth: number, sourceHeight: number, target: TargetId) {
  const requested = targetOptions.find((item) => item.id === target)?.width ?? 1920;
  const width = Math.min(requested, 3840);
  return { width, height: Math.round((width / sourceWidth) * sourceHeight) };
}

type Stage = "idle" | "ready" | "processing" | "done";

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageOutputUrl, setImageOutputUrl] = useState("");
  const [imageStatus, setImageStatus] = useState("AI READY ON DEMAND");
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [sourceUrl, setSourceUrl] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const [target, setTarget] = useState<TargetId>("1080p");
  const [mode, setMode] = useState<"video" | "image">("video");
  const [enhance, setEnhance] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [outputSize, setOutputSize] = useState({ width: 0, height: 0 });
  const [dragActive, setDragActive] = useState(false);
  const [aiSession, setAiSession] = useState<AiSession | null>(null);
  const [aiStatus, setAiStatus] = useState("AI READY ON DEMAND");

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
  }, [sourceUrl, outputUrl]);

  const loadFile = (nextFile?: File) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("video/")) {
      toast.error("Choose a video file to continue.");
      return;
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    const nextUrl = URL.createObjectURL(nextFile);
    setFile(nextFile);
    setSourceUrl(nextUrl);
    setOutputUrl("");
    setStage("ready");
    setProgress(0);
  };

  const loadImage = (nextFile?: File) => {
    if (!nextFile || !nextFile.type.startsWith("image/")) { toast.error("Choose an image file to continue."); return; }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    if (imageOutputUrl) URL.revokeObjectURL(imageOutputUrl);
    setImageFile(nextFile); setImageUrl(URL.createObjectURL(nextFile)); setImageOutputUrl(""); setImageStatus("AI READY ON DEMAND");
    const probe = new Image(); probe.src = URL.createObjectURL(nextFile); probe.onload = () => { setImageDimensions({ width: probe.naturalWidth, height: probe.naturalHeight }); URL.revokeObjectURL(probe.src); };
  };

  const upscaleImage = async () => {
    if (!imageUrl || !imageFile) return;
    setImageStatus("LOADING REAL-ESRGAN");
    const image = new Image();
    image.src = imageUrl;
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Image could not load")); });
    const canvas = document.createElement("canvas");
    try {
      const activeAi = aiSession || await loadAiSession(setImageStatus);
      setAiSession(activeAi);
      const rendered = await aiUpscaleImage(image, image.naturalWidth, image.naturalHeight, canvas, activeAi);
      canvas.toBlob((blob) => { if (blob) setImageOutputUrl(URL.createObjectURL(blob)); }, "image/png");
      setImageStatus(`REAL-ESRGAN / ${activeAi.runtime.toUpperCase()} · ${rendered.width}×${rendered.height}`);
      toast.success("AI image upscale complete. Your image stayed in this browser.");
    } catch {
      const rendered = localEnhanceImage(image, image.naturalWidth, image.naturalHeight, canvas, 2);
      canvas.toBlob((blob) => { if (blob) setImageOutputUrl(URL.createObjectURL(blob)); }, "image/png");
      setImageStatus(`LOCAL FALLBACK / CANVAS · ${rendered.width}×${rendered.height}`);
      toast("AI model unavailable; a high-quality local image enhancement was created instead.");
    }
  };

  const downloadImage = () => {
    if (!imageOutputUrl) return;
    const anchor = document.createElement("a"); anchor.href = imageOutputUrl; anchor.download = `${imageFile?.name.replace(/\.[^/.]+$/, "") || "image"}-enhanced.png`; anchor.click();
  };

  const reset = () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setFile(null); setSourceUrl(""); setOutputUrl(""); setStage("idle"); setProgress(0); setDuration(0); setVideoDimensions({ width: 0, height: 0 }); setImageFile(null); setImageUrl(""); setImageOutputUrl(""); setImageDimensions({ width: 0, height: 0 });
  };

  const upscale = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !file) return;
    if (!video.videoWidth || !video.duration) {
      toast.error("The video is still loading. Try again in a moment.");
      return;
    }
    setStage("processing"); setProgress(1);
    const useAiForVideo = enhance && video.duration <= 8 && video.videoWidth <= 1920;
    let activeAi = useAiForVideo ? aiSession : null;
    if (enhance && !useAiForVideo) {
      setAiStatus("LONG VIDEO — USING FAST CANVAS FALLBACK");
      toast("For videos longer than 8 seconds, fast local Canvas mode is used so processing does not stall.");
    }
    if (useAiForVideo && !activeAi) {
      try {
        setAiStatus("LOADING REAL-ESRGAN");
        activeAi = await loadAiSession(setAiStatus);
        setAiSession(activeAi);
      } catch {
        setAiStatus("AI UNAVAILABLE — USING CANVAS");
        toast("AI model could not load; continuing with the free browser fallback.");
      }
    }
    if (activeAi) setAiStatus(`REAL-ESRGAN / ${activeAi.runtime.toUpperCase()}`);
    video.currentTime = 0;
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) resolve(); else video.addEventListener("loadeddata", () => resolve(), { once: true });
    });
    const dimensions = targetDimensions(video.videoWidth, video.videoHeight, target);
    const width = dimensions.width;
    const height = dimensions.height;
    canvas.width = width; canvas.height = height;
    setOutputSize({ width, height });
    const stream = canvas.captureStream(30);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.min(18_000_000, Math.max(4_000_000, width * height * 3)) });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    const completed = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
    recorder.start(250);
    let stopped = false;
    const aiFrameCanvas = document.createElement("canvas");
    const draw = async () => {
      if (stopped || video.ended || video.paused) {
        if (recorder.state !== "inactive") recorder.stop();
        return;
      }
      try {
        if (activeAi && useAiForVideo) {
          const rendered = await aiUpscaleFrame(video, aiFrameCanvas, activeAi);
          canvas.getContext("2d")?.drawImage(aiFrameCanvas, 0, 0, width, height);
          setOutputSize({ width, height });
        } else {
          const context = canvas.getContext("2d");
          if (context) {
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";
            context.filter = enhance ? "contrast(1.04) saturate(1.04)" : "none";
            context.drawImage(video, 0, 0, width, height);
            context.filter = "none";
          }
        }
      } catch {
        activeAi = null;
        setAiStatus("AI FRAME ERROR — USING CANVAS");
      }
      setProgress(Math.min(99, (video.currentTime / video.duration) * 100));
      requestAnimationFrame(() => void draw());
    };
    video.onended = () => { stopped = true; if (recorder.state !== "inactive") recorder.stop(); };
    await video.play();
    void draw();
    await completed;
    const blob = new Blob(chunks, { type: "video/webm" });
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(URL.createObjectURL(blob)); setProgress(100); setStage("done");
    toast.success(activeAi && useAiForVideo ? "AI upscale complete. Your file stayed in this browser." : "Upscale complete. Your file stayed in this browser.");
  };

  const download = () => {
    if (!outputUrl) return;
    const anchor = document.createElement("a");
    anchor.href = outputUrl; anchor.download = `${file?.name.replace(/\.[^/.]+$/, "") || "video"}-${target}.webm`; anchor.click();
  };

  return (
    <main className="atelier-shell">
      <header className="topbar">
        <div className="brand-lockup"><img src={logoUrl} alt="Enhance Pilot mark" /><span className="wordmark">enhance <i>·</i> pilot</span></div>
        <div className="topbar-note"><span className="live-dot" /> LOCAL PROCESSING <span className="topbar-divider" /> NO UPLOADS</div>
        <a className="github-link" href="https://github.com" target="_blank" rel="noreferrer">SOURCE ON GITHUB <ArrowUpRight size={15} /></a>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <video className="hero-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true"><source src="/manus-storage/enhance-pilot-cosmic-background_2a39f3d8.mp4" type="video/mp4" /></video><div className="hero-video-scrim" aria-hidden="true" />
        <div className="hero-grid" aria-hidden="true" /><div className="ambient-orbit orbit-one" aria-hidden="true" /><div className="ambient-orbit orbit-two" aria-hidden="true" />
        <div className="hero-copy"><span className="eyebrow hero-kicker"><span className="live-dot" /> BROWSER-BASED SUPER RESOLUTION</span><h2 id="landing-title">Make every<br /><em>frame matter.</em></h2><p>Enhance Pilot turns everyday footage and stills into a cleaner, larger signal — privately, locally, and without a subscription.</p><div className="hero-actions"><a className="coral-button" href="#workbench"><Play size={16} fill="currentColor" /> Enter the workbench</a><span className="hero-note">NO UPLOADS · REAL-ESRGAN READY</span></div></div>
        <div className="hero-instrument" aria-hidden="true"><div className="instrument-topline"><span>EP / 001</span><span>LIVE SIGNAL MAP</span></div><div className="signal-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="instrument-readout"><strong>LOCAL</strong><span>WEBGPU / WASM</span><b>1080 → 4K</b></div></div>
      </section>

      <section className="workbench" id="workbench">
        <aside className="editorial-rail">
          <div className="rail-index">01 — VIDEO ENHANCEMENT</div>
          <h1>Pilot<br /><em>the detail.</em></h1>
          <p className="dek">A free, private AI workbench for turning ordinary footage into a cleaner signal.</p>
          <div className="rail-art"><img src={privacyArt} alt="Illustration of local video processing" /></div>
          <div className="rail-foot"><LockKeyhole size={15} /><span>Your footage never leaves this tab.</span></div>
        </aside>

        <section className="workspace">
          <div className="workspace-heading"><div><span className="eyebrow">WORKSPACE / {mode === "image" ? "IMAGE AI" : stage === "processing" ? "PROCESSING" : stage === "done" ? "EXPORT READY" : "STANDING BY"}</span><h2>{mode === "image" ? "Upscale an image" : "Upscale a video"}</h2></div><div className="heading-readouts"><button className={mode === "video" ? "mode-tab active" : "mode-tab"} onClick={() => setMode("video")}>VIDEO</button><button className={mode === "image" ? "mode-tab active" : "mode-tab"} onClick={() => setMode("image")}>IMAGE</button><span className="session-code">LOCAL / PRIVATE</span></div></div>

          {mode === "video" && stage === "idle" && <div className="upload-panel" onDragOver={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={(e) => { e.preventDefault(); setDragActive(false); loadFile(e.dataTransfer.files[0]); }} data-active={dragActive}>
            <input ref={inputRef} type="file" accept="video/*" hidden onChange={(e) => loadFile(e.target.files?.[0])} />
            <div className="upload-copy"><div className="upload-symbol"><Upload size={22} strokeWidth={1.7} /></div><span className="eyebrow">DROP YOUR SOURCE HERE</span><h3>Bring in a video<br /><em>to begin.</em></h3><p>MP4, MOV, WebM · up to 2 GB recommended</p><button className="coral-button" onClick={() => inputRef.current?.click()}>Choose video <ArrowUpRight size={17} /></button></div>
            <img src={emptyArt} alt="Calibration frame illustration" className="upload-art" />
          </div>}

          {mode === "video" && stage !== "idle" && <div className="loaded-panel">
            <div className="preview-header"><div className="file-meta"><div className="file-icon"><FileVideo size={20} /></div><div><strong>{file?.name}</strong><span>{formatBytes(file?.size || 0)} · {videoRef.current?.videoWidth || "—"} × {videoRef.current?.videoHeight || "—"} · {formatTime(duration)}</span></div></div><button className="icon-button" onClick={reset} aria-label="Remove video"><X size={18} /></button></div>
            <div className="video-stage"><video ref={videoRef} src={sourceUrl} controls={stage !== "processing"} onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setVideoDimensions({ width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight }); }} className={outputUrl ? "has-output" : ""} /><canvas ref={canvasRef} className="render-canvas" />{videoDimensions.width > 0 && <div className="resolution-badge"><b>{resolutionLabel(videoDimensions.width, videoDimensions.height)}</b><span>{videoDimensions.width} × {videoDimensions.height}</span></div>}{stage === "processing" && <div className="processing-overlay"><Sparkles size={22} /><span>Rendering locally</span><strong>{Math.round(progress)}%</strong></div>}</div>
            <div className="preview-caption"><span>INPUT / {videoRef.current?.videoWidth || "—"} × {videoRef.current?.videoHeight || "—"}</span><span className="caption-rule" /><span>OUTPUT / {outputSize.width || "—"} × {outputSize.height || "—"}</span></div>
          </div>}

          {mode === "video" && <div className="controls-panel"><div className="instrument-strip"><span><b>MODE</b> {enhance ? "AI ENHANCE" : "NEUTRAL"}</span><span><b>MODEL</b> {enhance ? aiStatus : "OFF"}</span><span><b>OUTPUT</b> {target.toUpperCase()} WEBM</span><span><b>STORAGE</b> THIS DEVICE</span></div>
            <div className="control-group"><span className="eyebrow">TARGET RESOLUTION</span><div className="scale-options">{targetOptions.map((option) => <button key={option.id} className={target === option.id ? "scale-option selected" : "scale-option"} onClick={() => setTarget(option.id)} disabled={stage === "processing"}><b>{option.label}</b><small>{option.id === "1080p" ? "Full HD" : option.id === "1440p" ? "QHD" : option.id === "2k" ? "Cinema" : "Ultra HD"}</small></button>)}</div></div>
            <div className="control-group enhancement"><span className="eyebrow">ENHANCEMENT</span><button className={enhance ? "toggle-row enabled" : "toggle-row"} onClick={() => setEnhance(!enhance)}><span className="toggle"><span /></span><span><b>AI detail recovery</b><small>Real-ESRGAN when supported · Canvas fallback</small></span><WandSparkles size={17} /></button></div>
                        <div className="action-row"><div className="format-note"><Info size={15} /><span>Exports as WebM · processed in real time</span></div>{stage === "done" ? <button className="coral-button" onClick={download}><Download size={17} /> Download result</button> : <button className="coral-button" onClick={upscale} disabled={stage === "idle" || stage === "processing"}>{stage === "processing" ? "Rendering…" : <><Play size={16} fill="currentColor" /> Upscale locally</>}</button>}</div>
          </div>}
          {mode === "image" && <div className="image-workspace"><input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(e) => loadImage(e.target.files?.[0])} />{!imageUrl ? <div className="image-drop"><div className="upload-symbol"><Upload size={22} /></div><span className="eyebrow">AI IMAGE UPSCALER</span><h3>Give a still frame<br /><em>more signal.</em></h3><p>PNG, JPG, WebP · processed locally</p><button className="coral-button" onClick={() => imageInputRef.current?.click()}>Choose image <ArrowUpRight size={17} /></button></div> : <><div className="image-preview-grid"><div><span className="eyebrow">SOURCE</span><div className="image-frame"><img src={imageUrl} alt="Selected source" />{imageDimensions.width > 0 && <div className="resolution-badge"><b>{resolutionLabel(imageDimensions.width, imageDimensions.height)}</b><span>{imageDimensions.width} × {imageDimensions.height}</span></div>}</div></div><div><span className="eyebrow">AI OUTPUT</span>{imageOutputUrl ? <div className="image-frame"><img src={imageOutputUrl} alt="AI upscaled result" /><div className="resolution-badge"><b>AI 2×</b><span>{imageDimensions.width * 2} × {imageDimensions.height * 2}</span></div></div> : <div className="image-empty"><Sparkles size={22} /><span>{imageStatus}</span></div>}</div></div><div className="image-actions"><span className="format-note"><Info size={15} /> {imageStatus.includes("LOCAL FALLBACK") ? "Local enhancement x2" : "Real-ESRGAN x2"} · {imageStatus}</span>{imageOutputUrl ? <button className="coral-button" onClick={downloadImage}><Download size={17} /> Download PNG</button> : <button className="coral-button" onClick={upscaleImage}><WandSparkles size={17} /> Upscale image</button>}</div></>}</div>}
          {stage === "done" && <div className="done-banner"><div className="done-icon"><Check size={18} /></div><div><strong>Your enlarged file is ready.</strong><span>Nothing was sent to a server. Download it now, or reset to work on another clip.</span></div><button className="text-button" onClick={reset}><RotateCcw size={15} /> New video</button></div>}
        </section>
      </section>

      <footer className="footer"><div><Film size={15} /> <span className="footer-wordmark">enhance pilot</span> <span>— free browser AI enhancement</span></div><div className="footer-specs"><span>NO ACCOUNT</span><span>NO CLOUD</span><span>OPEN SOURCE READY</span></div></footer>
      <div className="sr-only"><img src={comparisonArt} alt="" /><img src={exportArt} alt="" /></div>
    </main>
  );
}
