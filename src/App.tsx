import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Activity, Radio, Database, Info, Terminal, Volume2, VolumeX } from 'lucide-react';

// --- Types ---
interface NarrativeItem {
  time_sec: number;
  text?: string;
  text_zh?: string;
  text_en?: string;
}

interface TargetTelemetry {
  name: string;
  estimated_distance: string;
  dominant_emission: string;
}

interface DirectorPlan {
  target_telemetry: TargetTelemetry;
  narrative_stream: NarrativeItem[];
}

interface MediaAssets {
  video_url: string;
  audio_url: string;
}

type UploadStatus = 'idle' | 'loading' | 'ready' | 'success' | 'error';

// --- Components ---



const TelemetryRadar = ({ onUpload, disabled }: { onUpload: (file: File) => void; disabled: boolean }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) onUpload(file);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = '';
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={`absolute inset-0 flex items-center justify-center transition-colors duration-300 cursor-pointer group/radar ${isDragging ? 'bg-cyan-500/10' : 'bg-slate-950/80'} ${disabled ? 'pointer-events-none' : ''}`}
    >
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

      <div className="relative w-64 h-64 md:w-96 md:h-96 pointer-events-none">
        <div className={`absolute inset-0 border rounded-full transition-colors duration-300 ${isDragging ? 'border-cyan-400' : 'border-cyan-500/20'}`} />
        <div className="absolute inset-[15%] border border-cyan-500/15 rounded-full" />
        <div className="absolute inset-[30%] border border-cyan-500/10 rounded-full" />
        <div className="absolute inset-[45%] border border-cyan-500/5 rounded-full" />
        <div className="absolute top-1/2 left-0 w-full h-px bg-cyan-500/10" />
        <div className="absolute top-0 left-1/2 w-px h-full bg-cyan-500/10" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 origin-center"
          style={{ background: 'conic-gradient(from 0deg, transparent 0deg, rgba(34, 211, 238, 0.2) 60deg, transparent 60deg)' }}
        />
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], x: Math.random() * 200 - 100, y: Math.random() * 200 - 100 }}
            transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 5 }}
            className="absolute top-1/2 left-1/2 w-2 h-2 bg-cyan-400 rounded-full blur-[1px]"
          />
        ))}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
      </div>

      <div className="absolute bottom-12 flex flex-col items-center gap-2 pointer-events-none">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }} className="flex items-center gap-2">
          <Radio className={`w-4 h-4 animate-pulse ${isDragging ? 'text-white' : 'text-cyan-400'}`} />
          <span className={`text-xs font-mono uppercase tracking-[0.3em] ${isDragging ? 'text-white' : 'text-cyan-400'}`}>
            {isDragging ? 'RELEASE TO UPLOAD' : 'UPLOAD TELEMETRY IMAGE'}
          </span>
        </motion.div>
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest group-hover/radar:text-cyan-500/60 transition-colors">
          Click or Drag Image to Analyze
        </div>
      </div>
    </div>
  );
};

// Pure-visual typewriter: renders narrative_stream items at time_sec offsets.
// No TTS — music is the only audio layer; text is the only narrative layer.
const NarrativeStream = ({ items }: { items: NarrativeItem[] }) => {
  const [lines, setLines] = useState<{ id: number; textZh: string; textEn: string; doneZh: boolean; doneEn: boolean }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      // Find the nearest scrollable parent and scroll it explicitly to avoid shifting the whole page
      const container = bottomRef.current.closest('.overflow-y-scroll');
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [lines]);

  useEffect(() => {
    let isActive = true;
    setLines([]);

    const typeSequence = async () => {
      const startTimestamp = Date.now();

      for (let i = 0; i < items.length; i++) {
        if (!isActive) return;

        const item = items[i];

        // Wait until target time or start immediately if we are lagging behind
        const targetStartTime = startTimestamp + item.time_sec * 1000;
        const now = Date.now();
        if (now < targetStartTime) {
          await new Promise(r => setTimeout(r, targetStartTime - now));
        }
        if (!isActive) return;

        // Ensure we handle whatever keys the backend / LLM uses
        const fullZh = item.text_zh || item.text || '...';
        const fullEn = item.text_en || 'Translating quantum signatures...';
        const totalLen = Math.max(fullZh.length, fullEn.length);

        // 🎙️⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐
        // 🗣️ [PROD-READY: Google Cloud Text-to-Speech API] 🗣️
        // 🎙️⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐
        // const ttsResponse = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        //   method: 'POST',
        //   headers: {
        //     'Authorization': `Bearer ${GCP_OAUTH_TOKEN}`,
        //     'Content-Type': 'application/json'
        //   },
        //   body: JSON.stringify({
        //     input: { text: fullEn },
        //     voice: { languageCode: 'en-US', name: 'en-US-Journey-D' },
        //     audioConfig: { audioEncoding: 'MP3', speakingRate: 0.85, pitch: -2.0 }
        //   })
        // });
        // const ttsData = await ttsResponse.json();
        // const audio = new Audio(`data:audio/mp3;base64,${ttsData.audioContent}`);
        // audio.play();
        // 🎙️⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐

        // [DEMO] Local Graceful Degradation: Web Speech API
        // if ('speechSynthesis' in window) {
        //   window.speechSynthesis.cancel(); // Cancel any ongoing speech
        //   const utterance = new SpeechSynthesisUtterance(fullEn);
        //   utterance.lang = 'en-US';
        //   utterance.rate = 0.9;
        //   utterance.pitch = 0.6; // Deep, documentary style
        //   window.speechSynthesis.speak(utterance);
        // }

        setLines(prev => [...prev, { id: i, textZh: '', textEn: '', doneZh: false, doneEn: false }]);

        await new Promise<void>(resolve => {
          let charIdx = 0;

          const typeChar = () => {
            if (!isActive) {
              resolve();
              return;
            }
            charIdx++;

            const zhDone = charIdx >= fullZh.length;
            const enDone = charIdx >= fullEn.length;

            setLines(prev => prev.map(l => l.id === i ? {
              ...l,
              textZh: '> ' + fullZh.slice(0, charIdx),
              textEn: '> ' + fullEn.slice(0, charIdx),
              doneZh: zhDone,
              doneEn: enDone
            } : l));

            if (charIdx < totalLen) {
              setTimeout(typeChar, 30);
            } else {
              resolve();
            }
          };

          setTimeout(typeChar, 30);
        });
      }
    };

    typeSequence();

    return () => { isActive = false; };
  }, [items]);

  return (
    <div className="flex flex-col gap-3 pb-4">
      {lines.map(line => (
        <div key={line.id} className="flex flex-col gap-1.5 mb-2">
          <span className="font-mono text-sm leading-relaxed text-cyan-400 block break-words whitespace-pre-wrap">
            {line.textZh}
            {!line.doneZh && (
              <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block w-2 h-4 ml-1 bg-cyan-400 align-middle" />
            )}
          </span>
          <span className="font-mono text-xs leading-relaxed text-fuchsia-400/90 block pl-3 relative break-words whitespace-pre-wrap">
            <div className="absolute left-0 top-1 bottom-1 w-px bg-gradient-to-b from-fuchsia-500/80 to-transparent" />
            {line.textEn}
            {!line.doneEn && (
              <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block w-1.5 h-3 ml-1 bg-fuchsia-400/90 align-middle" />
            )}
          </span>
        </div>
      ))}
      <div ref={bottomRef} className="h-1 text-transparent">-</div>
    </div>
  );
};

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [userMedia, setUserMedia] = useState<{ url: string; isVideo?: boolean } | null>(null);
  const [telemetry, setTelemetry] = useState({ temp: 3.2, velocity: 1500 });
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [targetTelemetry, setTargetTelemetry] = useState<TargetTelemetry | null>(null);
  const [narrativeItems, setNarrativeItems] = useState<NarrativeItem[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioNodeRefs = useRef<{
    audioCtx: AudioContext;
    analyser: AnalyserNode;
    dataArray: Uint8Array;
    sourceNode: MediaElementAudioSourceNode;
  } | null>(null);
  const spectrumContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);
  const fakeDataRef = useRef<{ lastUpdate: number }>({ lastUpdate: 0 });
  // Pending narrative items waiting for user to press play
  const pendingNarrativeRef = useRef<NarrativeItem[] | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    // Show preview immediately
    const url = URL.createObjectURL(file);
    setUserMedia({ url });
    setUploadStatus('loading');
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('https://echoes-backend-173365969419.us-central1.run.app/api/analyze-cosmos', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (data.status === 'error') throw new Error(data.message);

      const plan: DirectorPlan = data.director_plan;
      const media: MediaAssets | undefined = data.media;

      setTargetTelemetry(plan.target_telemetry);
      setUploadStatus('success');

      if (media?.video_url) {
        setUserMedia({ url: media.video_url, isVideo: true });
      }

      if (media?.audio_url) {
        if (!audioRef.current) {
          audioRef.current = new Audio();
          audioRef.current.crossOrigin = 'anonymous';
        } else {
          audioRef.current.pause();
          audioRef.current.onplay = null;
        }
        audioRef.current.src = media.audio_url;
        audioRef.current.volume = volume;

        // Auto-pause when playback ends
        audioRef.current.onended = () => {
          setIsPlaying(false);
          const nebulaVideo = userVideoRef.current;
          // Note: we don't clearUserMedia here, we leave it in a finished state.
          if (nebulaVideo) nebulaVideo.pause();
        };

        // Store narrative — will fire when user presses play
        pendingNarrativeRef.current = plan.narrative_stream;
        setUploadStatus('ready');
      } else {
        setNarrativeItems(plan.narrative_stream);
        setUploadStatus('success');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setUploadStatus('error');
    }
  }, []);

  const clearUserMedia = () => {
    if (userMedia && !userMedia.isVideo) URL.revokeObjectURL(userMedia.url);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onplay = null;
      audioRef.current.onended = null;
      // Do not destroy audioRef here to reuse it and its AudioContext source node
    }
    pendingNarrativeRef.current = null;
    setUserMedia(null);
    setUploadStatus('idle');
    setErrorMsg('');
    setTargetTelemetry(null);
    setNarrativeItems([]);
    setIsPlaying(false);
  };

  // Simulate real-time data
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry({
        temp: +(3.2 + (Math.random() * 0.2 - 0.1)).toFixed(2),
        velocity: +(1500 + (Math.random() * 50 - 25)).toFixed(0),
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const renderFrame = useCallback(() => {
    if (!spectrumContainerRef.current) return;
    const bars = spectrumContainerRef.current.children;

    if (audioNodeRefs.current && audioRef.current && !audioRef.current.paused) {
      const { analyser, dataArray } = audioNodeRefs.current;
      analyser.getByteFrequencyData(dataArray);

      for (let i = 0; i < bars.length && i < dataArray.length; i++) {
        const bar = bars[i] as HTMLElement;
        const val = dataArray[i] / 255;
        // height from 8px to max 80px
        const height = Math.max(8, val * 80);
        bar.style.height = `${height}px`;
      }
    } else if (isPlaying) {
      // Fake animation for default state without audio
      const now = Date.now();
      if (now - fakeDataRef.current.lastUpdate > 100) {
        for (let i = 0; i < bars.length; i++) {
          const bar = bars[i] as HTMLElement;
          const height = 8 + Math.random() * 40;
          bar.style.height = `${height}px`;
        }
        fakeDataRef.current.lastUpdate = now;
      }
    } else {
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i] as HTMLElement;
        bar.style.height = '8px';
      }
    }

    animationFrameRef.current = requestAnimationFrame(renderFrame);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (spectrumContainerRef.current) {
        const bars = spectrumContainerRef.current.children;
        for (let i = 0; i < bars.length; i++) {
          const bar = bars[i] as HTMLElement;
          bar.style.height = '8px';
        }
      }
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, renderFrame]);

  const togglePlay = () => {
    const audio = audioRef.current;
    const nebulaVideo = userVideoRef.current;
    const bgVideo = videoRef.current;

    // Defensive: if audio exists, use it as truth source; otherwise fall back to isPlaying state
    if (audio) {
      if (!nebulaVideo && userMedia?.isVideo) return; // video element not yet mounted

      // Initialize AudioContext on first play interaction
      if (!audioNodeRefs.current) {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 128; // 64 frequency bins, enough for 48 bars
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const sourceNode = audioCtx.createMediaElementSource(audio);
            sourceNode.connect(analyser);
            analyser.connect(audioCtx.destination);
            audioNodeRefs.current = { audioCtx, analyser, dataArray, sourceNode };
          }
        } catch (e) {
          console.error("Web Audio API error:", e);
        }
      } else {
        if (audioNodeRefs.current.audioCtx.state === 'suspended') {
          audioNodeRefs.current.audioCtx.resume();
        }
      }

      if (audio.paused) {
        audio.play().then(() => {
          if (pendingNarrativeRef.current) {
            setNarrativeItems(pendingNarrativeRef.current);
            pendingNarrativeRef.current = null;
            setUploadStatus('success');
          }
        }).catch(() => { });
        nebulaVideo?.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        nebulaVideo?.pause();
        setIsPlaying(false);
      }
      return;
    }

    // No audio loaded — play button disabled if no media
    if (!userMedia) return;

    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    if (bgVideo) {
      nextPlaying ? bgVideo.play() : bgVideo.pause();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) audioRef.current.volume = val;
  };

  const telemetryRows = [
    { label: 'Target', value: targetTelemetry?.name ?? 'Crab Nebula (M1, NGC 1952)', color: 'text-white' },
    { label: 'Distance', value: targetTelemetry?.estimated_distance ?? '~6,500 Light Years', color: 'text-slate-400' },
    { label: 'Event', value: targetTelemetry?.dominant_emission ?? 'Supernova SN 1054', color: 'text-fuchsia-400' },
  ];

  const defaultNarrative = "分析完成。中心脉冲星正在释放强大的同步辐射，外围富含硫的恒星碎片正猛烈撞击星际介质。观测到极高能伽马射线爆发，能谱分布符合SN 1054超新星遗迹特征。系统正在解码引力波扰动信号...";
  const defaultNarrativeEn = "Analysis complete. The central pulsar is emitting intense synchrotron radiation, while peripheral sulfur-rich stellar debris violently impacts the interstellar medium. High-energy gamma-ray bursts observed, spectral distribution matches SN 1054 supernova remnant features. System is decoding gravitational wave perturbations...";

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden flex flex-col p-2 sm:p-4 gap-2 sm:gap-4">
      <div className="scanline pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 pb-2 px-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 sm:p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
            <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tighter text-white uppercase leading-none">Echoes of the Cosmos</h1>
            <p className="text-[8px] sm:text-[10px] font-mono text-cyan-500/60 uppercase tracking-widest">Deep Space Sonification Dashboard v4.2.0</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 lg:gap-6 font-mono text-[10px] text-slate-500">
          <div className="flex flex-col items-end"><span className="text-slate-400">LATENCY</span><span className="text-cyan-400">14.2ms</span></div>
          <div className="flex flex-col items-end"><span className="text-slate-400">UPTIME</span><span className="text-cyan-400">124:12:05</span></div>
          <div className="flex flex-col items-end"><span className="text-slate-400">STATUS</span><span className="text-emerald-400">NOMINAL</span></div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row gap-2 sm:gap-4 min-h-0 min-w-0">
        {/* Left Column: Visualizer & Radar */}
        <div className="flex-[2] flex flex-col gap-2 sm:gap-4 min-w-0 min-h-0">
          <section className="flex-1 glass-panel rounded-2xl relative overflow-hidden group min-h-0">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000" />
            <div className="relative h-full glass-panel rounded-2xl overflow-hidden border-cyan-500/20">
              <AnimatePresence mode="wait">
                {userMedia ? (
                  <motion.div key="user-media" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="w-full h-full relative">
                    {userMedia.isVideo ? (
                      <video ref={userVideoRef} loop muted playsInline src={userMedia.url} className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <img src={userMedia.url} alt="Telemetry" className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
                    )}

                    {/* Invisible upload overlay that appears when paused to allow clicking the video to upload a new one */}
                    {!isPlaying && uploadStatus !== 'loading' && (
                      <label
                        className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors z-10"
                      >
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(f);
                            e.target.value = '';
                          }}
                        />
                        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="flex flex-col items-center gap-2">
                          <Radio className="w-8 h-8 text-cyan-400" />
                          <span className="text-xs font-mono uppercase tracking-[0.2em] text-white">CLICK TO UPLOAD NEW TELEMETRY</span>
                        </motion.div>
                      </label>
                    )}

                    {/* Loading overlay */}
                    {uploadStatus === 'loading' && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 z-10">
                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} className="flex items-center gap-3">
                          <Radio className="w-6 h-6 text-cyan-400 animate-spin" />
                          <span className="font-mono text-sm text-cyan-400 uppercase tracking-widest">📡 TRANSMITTING DATA TO AGENT NETWORK...</span>
                        </motion.div>
                        <motion.div
                          animate={{ scaleX: [0, 1, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          className="w-48 h-0.5 bg-cyan-400 origin-left"
                        />
                      </div>
                    )}

                    {/* Error overlay */}
                    {uploadStatus === 'error' && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 z-10">
                        <span className="font-mono text-sm text-red-400 uppercase tracking-widest">⚠ TRANSMISSION FAILED</span>
                        <span className="font-mono text-xs text-red-500/80">{errorMsg}</span>
                      </div>
                    )}

                    <button onClick={clearUserMedia} className="absolute top-4 right-4 glass-panel px-3 py-1 rounded-md text-[10px] font-mono text-fuchsia-400 hover:bg-fuchsia-500/20 transition-colors border-fuchsia-500/30 z-20">
                      CLEAR DATA
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="radar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="w-full h-full relative">
                    <TelemetryRadar onUpload={handleUpload} disabled={false} />
                    {/* Keep video in background conceptually for later or remove it if strictly pure radar before upload.
                      We will just show the radar explicitly. */}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Overlay Telemetry */}
              <div className="absolute top-4 sm:top-6 left-4 sm:left-6 flex flex-col gap-2 z-10">
                <div className="glass-panel px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border-cyan-500/30 flex items-center gap-2">
                  <div className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${(isPlaying || userMedia) ? 'bg-cyan-500 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="text-[8px] sm:text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                    {userMedia ? (uploadStatus === 'loading' ? 'Analyzing...' : uploadStatus === 'error' ? 'Error' : 'Analysis Complete') : isPlaying ? 'Live Stream: Sector 7G' : 'Signal Lost / Reacquiring...'}
                  </span>
                </div>
                {(isPlaying || userMedia) && uploadStatus !== 'loading' && (
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-panel p-2 sm:p-3 rounded-lg border-white/5 backdrop-blur-xl">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between gap-4 sm:gap-8 text-[8px] sm:text-[10px] font-mono text-slate-400">
                        <span>TEMPERATURE</span>
                        <span className="text-fuchsia-400">T: {telemetry.temp}×10^6 K</span>
                      </div>
                      <div className="flex justify-between gap-4 sm:gap-8 text-[8px] sm:text-[10px] font-mono text-slate-400">
                        <span>VELOCITY</span>
                        <span className="text-cyan-400">V: {telemetry.velocity} km/s</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Upload trigger when media is showing */}
              {(isPlaying || userMedia) && uploadStatus === 'idle' && (
                <label className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 cursor-pointer glass-panel px-4 py-2 rounded-full border-cyan-500/30 flex items-center gap-2 hover:bg-cyan-500/10 transition-colors">
                  <input id="hidden-upload" type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">UPLOAD TELEMETRY IMAGE</span>
                </label>
              )}

              {/* Viewport Corners */}
              <div className="absolute top-0 left-0 w-6 sm:w-8 h-6 sm:h-8 border-t-2 border-l-2 border-cyan-500/40 rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-6 sm:w-8 h-6 sm:h-8 border-t-2 border-r-2 border-cyan-500/40 rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-6 sm:w-8 h-6 sm:h-8 border-b-2 border-l-2 border-cyan-500/40 rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-6 sm:w-8 h-6 sm:h-8 border-b-2 border-r-2 border-cyan-500/40 rounded-br-2xl" />
            </div>
          </section>
        </div>

        {/* Right Column: Telemetry & Narrative */}
        <aside className="flex-1 flex flex-col gap-2 sm:gap-4 min-w-0 min-h-0">

          {/* Target Telemetry Panel */}
          <section className="glass-panel rounded-2xl p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 border-white/5 shrink-0 h-fit">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-fuchsia-400" />
              <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white">Target Telemetry</h2>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {telemetryRows.map((item, i) => (
                <div key={i} className="flex flex-col gap-0.5 sm:gap-1">
                  <span className="text-[8px] sm:text-[9px] font-mono text-slate-500 uppercase tracking-tighter">{item.label}</span>
                  <span className={`text-xs sm:text-sm font-medium ${item.color}`}>{item.value}</span>
                </div>
              ))}

              <div className="pt-1 sm:pt-2">
                <span className="text-[8px] sm:text-[9px] font-mono text-slate-500 uppercase tracking-tighter mb-1 sm:mb-2 block">Multi-band Synthesis</span>
                <div className="space-y-2 sm:space-y-3">
                  {[
                    { band: 'X-Ray', color: 'bg-cyan-500', width: '85%' },
                    { band: 'Optical', color: 'bg-emerald-500', width: '60%' },
                    { band: 'Infrared', color: 'bg-fuchsia-500', width: '45%' },
                  ].map((band, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-[8px] sm:text-[10px] font-mono">
                        <span className="text-slate-300">{band.band}</span>
                        <span className="text-slate-500">{band.width}</span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: band.width }} transition={{ duration: 1.5, delay: i * 0.2 }} className={`h-full ${band.color}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Agent Narrative */}
          <section className="h-64 sm:h-72 lg:h-80 glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-2 sm:gap-3 border-white/5 relative overflow-hidden shrink-0">
            <div className="flex items-center gap-2 border-b border-white/10 pb-1.5 sm:pb-2 shrink-0">
              <Terminal className="w-3.5 h-3.5 sm:w-4 h-4 text-cyan-400" />
              <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white">Agent Narrative</h2>
            </div>
            <div className="flex-1 overflow-y-scroll overflow-x-hidden custom-scrollbar pr-2 relative">
              {narrativeItems.length > 0 ? (
                <NarrativeStream items={narrativeItems} />
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-sm leading-relaxed text-cyan-400/90 block break-words whitespace-pre-wrap">
                    {defaultNarrative}
                  </span>
                  <span className="font-mono text-xs leading-relaxed text-fuchsia-400/80 block pl-4 border-l border-white/10 break-words whitespace-pre-wrap">
                    {defaultNarrativeEn}
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block w-1.5 h-3 ml-1 bg-fuchsia-400/80 align-middle" />
                  </span>
                </div>
              )}
            </div>
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]" />
          </section>
        </aside>
      </main>

      {/* Footer */}
      <footer className="glass-panel rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-center gap-3 sm:gap-6 border-cyan-500/10 shrink-0">
        <div className="flex items-center gap-4 md:border-r border-white/10 md:pr-6 shrink-0">
          <button
            onClick={togglePlay}
            disabled={!userMedia || uploadStatus === 'loading'}
            className={`p-2 sm:p-3 rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${isPlaying ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'}`}
          >
            {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />}
          </button>
          <div className="flex flex-col w-20">
            <span className="text-[8px] sm:text-[10px] font-mono text-slate-500 uppercase">Audio Engine</span>
            <span className={`text-[10px] sm:text-xs font-bold ${isPlaying ? 'text-fuchsia-400' : uploadStatus === 'ready' ? 'text-emerald-400' : 'text-slate-500'}`}>
              {!userMedia ? 'OFFLINE' : isPlaying ? 'SONIFYING...' : uploadStatus === 'ready' ? 'READY' : 'STANDBY'}
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-1 sm:gap-2 w-full min-w-0">
          {/* Fixed height and flex items-end ensures bars only grow upwards locally */}
          <div ref={spectrumContainerRef} className="h-20 sm:h-24 flex items-end justify-between gap-0.5 sm:gap-1 px-1 sm:px-2 shrink-0 overflow-hidden">
            {Array.from({ length: 48 }).map((_, i) => (
              <div
                key={i}
                className={`w-1 rounded-full sm:w-1.5 transition-all duration-75 spectrum-bar shrink-0 ${i < 10 ? 'bg-fuchsia-500' : i < 25 ? 'bg-cyan-400' : 'bg-emerald-400'}`}
                style={{ height: '8px' }}
              />
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-[7px] sm:text-[9px] font-mono text-slate-500 uppercase tracking-tighter pt-1 border-t border-white/5">
            <div className="flex items-center gap-1"><div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-fuchsia-500" /><span>[脉冲星同步辐射 (Pulsar Synchrotron)]</span></div>
            <div className="flex items-center gap-1"><div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-cyan-400" /><span>[激波阵面能量交换 (Shockwave Energy)]</span></div>
            <div className="flex items-center gap-1"><div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-400" /><span>[外围气体膨胀 (Gas Expansion)]</span></div>
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-3 pl-6 border-l border-white/10">
          {volume === 0 ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-slate-500" />}
          <input
            id="volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-24 h-1 accent-cyan-400 cursor-pointer"
          />
          <Info className="w-4 h-4 text-slate-500 cursor-help hover:text-cyan-400 transition-colors" />
        </div>
      </footer>
    </div>
  );
}
