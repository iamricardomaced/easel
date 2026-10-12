import { useEffect, useRef, useState } from 'react';
import { Camera, Mic, Monitor, Pause, Play, Square, X } from 'lucide-react';
import { useUi } from '../store/ui';
import { uploadFile } from '../lib/upload';
import { placeUpload } from '../lib/place';
import { useEditor } from '../store/editor';
import { toast } from '../lib/toast';

// "Record yourself": camera, screen, or screen with a camera bubble, plus microphone.
// Modelled on the recording window in Canva's desktop app (countdown, pause/resume,
// a time limit, cancel confirmation, save and upload).

type Source = 'camera' | 'screen' | 'both';
type Phase = 'setup' | 'countdown' | 'recording' | 'paused' | 'review' | 'saving';

const LIMIT_MIN = 15;

export function Recorder() {
  const open = useUi((s) => s.recorder);
  if (!open) return null;
  return <RecorderDialog onClose={() => useUi.getState().setRecorder(false)} />;
}

function RecorderDialog({ onClose }: { onClose: () => void }) {
  const [source, setSource] = useState<Source>('camera');
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cam, setCam] = useState('');
  const [mic, setMic] = useState('');
  const [phase, setPhase] = useState<Phase>('setup');
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; url: string } | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const camStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const raf = useRef(0);
  const clock = useRef({ started: 0, banked: 0 });

  const stopStreams = () => {
    cancelAnimationFrame(raf.current);
    camStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current?.getTracks().forEach((t) => t.stop());
    camStream.current = null;
    screenStream.current = null;
  };
  useEffect(() => stopStreams, []);
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  // Camera/mic preview while setting up.
  useEffect(() => {
    if (phase !== 'setup') return;
    let live = true;
    (async () => {
      try {
        camStream.current?.getTracks().forEach((t) => t.stop());
        const wantCam = source !== 'screen';
        const s = await navigator.mediaDevices.getUserMedia({
          video: wantCam ? (cam ? { deviceId: { exact: cam } } : { width: 1280, height: 720 }) : false,
          audio: mic ? { deviceId: { exact: mic } } : true,
        });
        if (!live) return s.getTracks().forEach((t) => t.stop());
        camStream.current = s;
        if (previewRef.current) previewRef.current.srcObject = wantCam ? s : null;
        const devs = await navigator.mediaDevices.enumerateDevices();
        setCams(devs.filter((d) => d.kind === 'videoinput'));
        setMics(devs.filter((d) => d.kind === 'audioinput'));
        setError(null);
      } catch {
        setError(source === 'screen' ? 'Allow microphone access to record your voice over the screen.' : 'Allow camera and microphone access in your browser to record yourself.');
      }
    })();
    return () => {
      live = false;
    };
  }, [source, cam, mic, phase]);

  // Elapsed time and the recording limit.
  useEffect(() => {
    if (phase !== 'recording') return;
    const t = setInterval(() => {
      const e = clock.current.banked + (performance.now() - clock.current.started) / 1000;
      setElapsed(e);
      if (e >= LIMIT_MIN * 60) {
        toast(`You’ve reached the ${LIMIT_MIN}-minute limit`);
        finish();
      }
    }, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const begin = async () => {
    try {
      let stream: MediaStream;
      const audio = camStream.current?.getAudioTracks() ?? [];
      if (source === 'camera') stream = camStream.current!;
      else {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
        screenStream.current = screen;
        if (source === 'screen') stream = new MediaStream([...screen.getVideoTracks(), ...audio]);
        else stream = composite(screen, camStream.current!, audio);
        screen.getVideoTracks()[0].addEventListener('ended', () => recorder.current?.state !== 'inactive' && finish());
      }
      setPhase('countdown');
      for (let i = 3; i > 0; i--) {
        setCount(i);
        await new Promise((r) => setTimeout(r, 1000));
      }
      chunks.current = [];
      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'video/webm' });
        setResult({ blob, url: URL.createObjectURL(blob) });
        setPhase('review');
        stopStreams();
      };
      rec.start(1000);
      recorder.current = rec;
      clock.current = { started: performance.now(), banked: 0 };
      setElapsed(0);
      setPhase('recording');
    } catch {
      setPhase('setup');
      setError('We couldn’t start your recording. Try again to continue.');
    }
  };

  // Screen with a round camera bubble in the corner, drawn onto a canvas.
  const composite = (screen: MediaStream, camera: MediaStream, audio: MediaStreamTrack[]) => {
    const sv = document.createElement('video');
    sv.srcObject = screen;
    sv.muted = true;
    sv.play();
    const cv = document.createElement('video');
    cv.srcObject = camera;
    cv.muted = true;
    cv.play();
    const canvas = document.createElement('canvas');
    const settings = screen.getVideoTracks()[0].getSettings();
    canvas.width = settings.width ?? 1920;
    canvas.height = settings.height ?? 1080;
    const g = canvas.getContext('2d')!;
    const draw = () => {
      g.drawImage(sv, 0, 0, canvas.width, canvas.height);
      const r = Math.min(canvas.width, canvas.height) * 0.14;
      const cx = r + 32;
      const cy = canvas.height - r - 32;
      g.save();
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.clip();
      const k = Math.max((2 * r) / (cv.videoWidth || 1), (2 * r) / (cv.videoHeight || 1));
      g.drawImage(cv, cx - (cv.videoWidth * k) / 2, cy - (cv.videoHeight * k) / 2, cv.videoWidth * k, cv.videoHeight * k);
      g.restore();
      raf.current = requestAnimationFrame(draw);
    };
    draw();
    return new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...audio]);
  };

  const pause = () => {
    recorder.current?.pause();
    clock.current.banked += (performance.now() - clock.current.started) / 1000;
    setPhase('paused');
  };
  const resume = () => {
    recorder.current?.resume();
    clock.current.started = performance.now();
    setPhase('recording');
  };
  const finish = () => {
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
  };
  const discard = () => {
    if (recorder.current && recorder.current.state !== 'inactive') {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    recorder.current = null;
    setResult(null);
    setConfirmCancel(false);
    setPhase('setup');
  };
  const save = async () => {
    if (!result) return;
    setPhase('saving');
    const ext = result.blob.type.includes('mp4') ? 'mp4' : 'webm';
    const name = `Recording ${new Date().toLocaleString()}.${ext}`.replace(/[/:]/g, '-');
    const up = await uploadFile(new File([result.blob], name, { type: result.blob.type.split(';')[0] }));
    if (!up) return setPhase('review');
    if (!up.duration || !Number.isFinite(up.duration)) up.duration = Math.max(1, elapsed);
    placeUpload(up);
    // Camera recordings sit in a round bubble, as in Canva.
    if (source === 'camera')
      useEditor.getState().updateSelected((el) => {
        const d = Math.min(el.w, el.h);
        return { frame: 'circle', w: d, h: d, x: el.x + (el.w - d) / 2, y: el.y + (el.h - d) / 2 } as never;
      });
    toast('Recording added to your design');
    onClose();
  };

  const recordingNow = phase === 'recording' || phase === 'paused';
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60" data-testid="recorder">
      <div className="w-[640px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">Record yourself</h2>
          <button className="rounded p-1 hover:bg-gray-100" onClick={() => (recordingNow ? setConfirmCancel(true) : (stopStreams(), onClose()))} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="relative aspect-video bg-ink">
          {phase === 'review' || phase === 'saving' ? (
            <video src={result?.url} controls className="h-full w-full" />
          ) : (
            <video ref={previewRef} autoPlay muted playsInline className={`h-full w-full object-cover ${source === 'screen' ? 'hidden' : ''}`} style={{ transform: 'scaleX(-1)' }} />
          )}
          {source === 'screen' && phase === 'setup' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
              <Monitor size={40} />
              <span className="text-sm">You’ll choose a display or window when you start</span>
            </div>
          )}
          {phase === 'countdown' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
              <span className="text-sm">Starts in</span>
              <span className="text-7xl font-bold">{count}</span>
            </div>
          )}
          {recordingNow && (
            <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
              <span className={`h-2 w-2 rounded-full ${phase === 'recording' ? 'animate-pulse bg-red-500' : 'bg-gray-400'}`} />
              {mmss(elapsed)} / {LIMIT_MIN}:00
            </span>
          )}
          {error && <div className="absolute inset-x-0 bottom-0 bg-red-600 px-4 py-2 text-sm text-white">{error}</div>}
        </div>
        <div className="space-y-3 p-5 text-sm">
          {phase === 'setup' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['camera', 'Camera', <Camera key="c" size={18} />],
                    ['screen', 'Screen', <Monitor key="s" size={18} />],
                    ['both', 'Screen + camera', <Monitor key="b" size={18} />],
                  ] as const
                ).map(([id, label, icon]) => (
                  <button key={id} className={`flex items-center justify-center gap-2 rounded-lg border py-2 ${source === id ? 'border-brand bg-brand/5 font-semibold text-brand' : 'hover:bg-gray-50'}`} onClick={() => setSource(id)}>
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {source !== 'screen' && (
                  <label className="flex items-center gap-2">
                    <Camera size={16} className="text-gray-500" />
                    <select className="flex-1 rounded border px-2 py-1.5" value={cam} onChange={(e) => setCam(e.target.value)}>
                      {!cams.length && <option value="">No camera</option>}
                      {cams.map((d, i) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-2">
                  <Mic size={16} className="text-gray-500" />
                  <select className="flex-1 rounded border px-2 py-1.5" value={mic} onChange={(e) => setMic(e.target.value)}>
                    {!mics.length && <option value="">No microphone</option>}
                    {mics.map((d, i) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Microphone ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white hover:bg-brand-strong" onClick={begin}>
                Record
              </button>
            </>
          )}
          {recordingNow && (
            <div className="flex gap-2">
              {phase === 'recording' ? (
                <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5" onClick={pause}>
                  <Pause size={16} /> Pause
                </button>
              ) : (
                <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5" onClick={resume}>
                  <Play size={16} /> Resume
                </button>
              )}
              <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand py-2.5 font-semibold text-white" onClick={finish}>
                <Square size={14} /> Finish
              </button>
            </div>
          )}
          {(phase === 'review' || phase === 'saving') && (
            <div className="flex gap-2">
              <button className="flex-1 rounded-lg border py-2.5" disabled={phase === 'saving'} onClick={discard}>
                Discard recording
              </button>
              <button className="flex-1 rounded-lg bg-brand py-2.5 font-semibold text-white disabled:opacity-60" disabled={phase === 'saving'} onClick={save}>
                {phase === 'saving' ? 'Uploading…' : 'Save and upload'}
              </button>
            </div>
          )}
        </div>
      </div>
      {confirmCancel && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-2 font-semibold">Cancel your recording?</h3>
            <p className="mb-4 text-sm text-gray-600">Are you sure you want to cancel your recording? You won’t be able to access canceled recordings.</p>
            <div className="flex justify-end gap-2 text-sm">
              <button className="rounded-lg border px-4 py-2" onClick={() => setConfirmCancel(false)}>
                Continue recording
              </button>
              <button
                className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white"
                onClick={() => {
                  discard();
                  stopStreams();
                  onClose();
                }}
              >
                Cancel recording
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
