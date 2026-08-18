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
import { aiUpscaleFrame, loadAiSession, type AiSession } from "@/lib/aiUpscaler";

const logoUrl = "/manus-storage/signal-frame-logo_e57c72af.png";
const emptyArt = "/manus-storage/calibration-empty-state_2ddaaed8.png";
const privacyArt = "/manus-storage/local-processing-privacy_f5f54573.png";
const comparisonArt = "/manus-storage/comparison-preview_b1701143.png";
const exportArt = "/manus-storage/export-complete_16c66d34.png";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const [scale, setScale] = useState(2);
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

  const reset = () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setFile(null); setSourceUrl(""); setOutputUrl(""); setStage("idle"); setProgress(0); setDuration(0);
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
    let activeAi = aiSession;
    if (enhance && !activeAi) {
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
    const width = Math.min(video.videoWidth * scale, 3840);
    const height = Math.round((width / video.videoWidth) * video.videoHeight);
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
    const draw = async () => {
      if (stopped || video.ended || video.paused) {
        if (recorder.state !== "inactive") recorder.stop();
        return;
      }
      try {
        if (activeAi && enhance) {
          const rendered = await aiUpscaleFrame(video, canvas, activeAi);
          setOutputSize({ width: rendered.width, height: rendered.height });
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
    toast.success(activeAi ? "AI upscale complete. Your file stayed in this browser." : "Upscale complete. Your file stayed in this browser.");
  };

  const download = () => {
    if (!outputUrl) return;
    const anchor = document.createElement("a");
    anchor.href = outputUrl; anchor.download = `${file?.name.replace(/\.[^/.]+$/, "") || "video"}-${scale}x-upscaled.webm`; anchor.click();
  };

  return (
    <main className="atelier-shell">
      <header className="topbar">
        <div className="brand-lockup"><img src={logoUrl} alt="Frame Lift mark" /><span className="wordmark">frame <i>/</i> lift</span></div>
        <div className="topbar-note"><span className="live-dot" /> LOCAL PROCESSING <span className="topbar-divider" /> NO UPLOADS</div>
        <a className="github-link" href="https://github.com" target="_blank" rel="noreferrer">SOURCE ON GITHUB <ArrowUpRight size={15} /></a>
      </header>

      <section className="workbench">
        <aside className="editorial-rail">
          <div className="rail-index">01 — VIDEO ENHANCEMENT</div>
          <h1>Sharpen<br /><em>the signal.</em></h1>
          <p className="dek">A free, private browser workbench for making small footage feel ready for the big screen.</p>
          <div className="rail-art"><img src={privacyArt} alt="Illustration of local video processing" /></div>
          <div className="rail-foot"><LockKeyhole size={15} /><span>Your footage never leaves this tab.</span></div>
        </aside>

        <section className="workspace">
          <div className="workspace-heading"><div><span className="eyebrow">WORKSPACE / {stage === "processing" ? "PROCESSING" : stage === "done" ? "EXPORT READY" : "STANDING BY"}</span><h2>Upscale a video</h2></div><div className="heading-readouts"><span>ENGINE / CANVAS</span><span>PRIVACY / LOCAL</span><span className="session-code">SESSION 001</span></div></div>

          {stage === "idle" && <div className="upload-panel" onDragOver={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={(e) => { e.preventDefault(); setDragActive(false); loadFile(e.dataTransfer.files[0]); }} data-active={dragActive}>
            <input ref={inputRef} type="file" accept="video/*" hidden onChange={(e) => loadFile(e.target.files?.[0])} />
            <div className="upload-copy"><div className="upload-symbol"><Upload size={22} strokeWidth={1.7} /></div><span className="eyebrow">DROP YOUR SOURCE HERE</span><h3>Bring in a video<br /><em>to begin.</em></h3><p>MP4, MOV, WebM · up to 2 GB recommended</p><button className="coral-button" onClick={() => inputRef.current?.click()}>Choose video <ArrowUpRight size={17} /></button></div>
            <img src={emptyArt} alt="Calibration frame illustration" className="upload-art" />
          </div>}

          {stage !== "idle" && <div className="loaded-panel">
            <div className="preview-header"><div className="file-meta"><div className="file-icon"><FileVideo size={20} /></div><div><strong>{file?.name}</strong><span>{formatBytes(file?.size || 0)} · {videoRef.current?.videoWidth || "—"} × {videoRef.current?.videoHeight || "—"} · {formatTime(duration)}</span></div></div><button className="icon-button" onClick={reset} aria-label="Remove video"><X size={18} /></button></div>
            <div className="video-stage"><video ref={videoRef} src={sourceUrl} controls={stage !== "processing"} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} className={outputUrl ? "has-output" : ""} /><canvas ref={canvasRef} className="render-canvas" />{stage === "processing" && <div className="processing-overlay"><Sparkles size={22} /><span>Rendering locally</span><strong>{Math.round(progress)}%</strong></div>}</div>
            <div className="preview-caption"><span>INPUT / {videoRef.current?.videoWidth || "—"} × {videoRef.current?.videoHeight || "—"}</span><span className="caption-rule" /><span>OUTPUT / {outputSize.width || "—"} × {outputSize.height || "—"}</span></div>
          </div>}

          <div className="controls-panel"><div className="instrument-strip"><span><b>MODE</b> {enhance ? "AI ENHANCE" : "NEUTRAL"}</span><span><b>MODEL</b> {enhance ? aiStatus : "OFF"}</span><span><b>OUTPUT</b> {scale}× WEBM</span><span><b>STORAGE</b> THIS DEVICE</span></div>
            <div className="control-group"><span className="eyebrow">SCALE</span><div className="scale-options">{[2, 3, 4].map((value) => <button key={value} className={scale === value ? "scale-option selected" : "scale-option"} onClick={() => setScale(value)} disabled={stage === "processing"}><b>{value}×</b><small>{value === 2 ? "Balanced" : value === 3 ? "Detailed" : "Maximum"}</small></button>)}</div></div>
            <div className="control-group enhancement"><span className="eyebrow">ENHANCEMENT</span><button className={enhance ? "toggle-row enabled" : "toggle-row"} onClick={() => setEnhance(!enhance)}><span className="toggle"><span /></span><span><b>AI detail recovery</b><small>Real-ESRGAN when supported · Canvas fallback</small></span><WandSparkles size={17} /></button></div>
            <div className="action-row"><div className="format-note"><Info size={15} /><span>Exports as WebM · processed in real time</span></div>{stage === "done" ? <button className="coral-button" onClick={download}><Download size={17} /> Download result</button> : <button className="coral-button" onClick={upscale} disabled={stage === "idle" || stage === "processing"}>{stage === "processing" ? "Rendering…" : <><Play size={16} fill="currentColor" /> Upscale locally</>}</button>}</div>
          </div>

          {stage === "done" && <div className="done-banner"><div className="done-icon"><Check size={18} /></div><div><strong>Your enlarged file is ready.</strong><span>Nothing was sent to a server. Download it now, or reset to work on another clip.</span></div><button className="text-button" onClick={reset}><RotateCcw size={15} /> New video</button></div>}
        </section>
      </section>

      <footer className="footer"><div><Film size={15} /> <span className="footer-wordmark">frame / lift</span> <span>— free browser video enhancement</span></div><div className="footer-specs"><span>NO ACCOUNT</span><span>NO CLOUD</span><span>OPEN SOURCE READY</span></div></footer>
      <div className="sr-only"><img src={comparisonArt} alt="" /><img src={exportArt} alt="" /></div>
    </main>
  );
}
