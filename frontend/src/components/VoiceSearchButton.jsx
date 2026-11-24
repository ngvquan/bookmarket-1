import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

const voiceUrl = import.meta.env.VITE_VOICE_URL || "/api/voice";

export default function VoiceSearchButton({ onTranscript }) {
  const recorder = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => () => {
    clearTimeout(timer.current);
    if (recorder.current?.state === "recording") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function stop() {
    clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    setListening(false);
  }

  async function toggle() {
    if (listening) return stop();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMessage("Trình duyệt không hỗ trợ ghi âm. Hãy dùng Chrome hoặc Edge.");
      return;
    }
    try {
      const status = await fetch(`${voiceUrl}/status`);
      if (!status.ok || !(await status.json()).local)
        throw new Error("Bộ nhận diện giọng nói local chưa chạy ở cổng 4001.");
      const media = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      } });
      stream.current = media;
      const current = new MediaRecorder(media);
      recorder.current = current;
      const chunks = [];
      current.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      current.onstop = async () => {
        media.getTracks().forEach((track) => track.stop());
        stream.current = null;
        recorder.current = null;
        setMessage("Đang nhận diện giọng nói…");
        try {
          const audio = new Blob(chunks, { type: current.mimeType || "audio/webm" });
          const response = await fetch(`${voiceUrl}/transcribe`, {
            method: "POST", headers: { "Content-Type": audio.type }, body: audio,
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message);
          setMessage("");
          onTranscript(String(result.text || "").trim());
        } catch (error) {
          setMessage(error.message || "Không nhận diện được giọng nói. Hãy thử lại.");
        }
      };
      current.start();
      setListening(true);
      setMessage("Đang nghe...");
      timer.current = setTimeout(stop, 10_000);
    } catch (error) {
      setMessage(error.name === "NotAllowedError"
        ? "Hãy cho phép trang dùng micro rồi thử lại."
        : error.message || "Không mở được micro.");
    }
  }

  return (
    <span className="voice-search-control">
      <button type="button" className={`voice-search-button${listening ? " is-listening" : ""}`}
        onClick={toggle} aria-label={listening ? "Dừng tìm kiếm bằng giọng nói" : "Tìm kiếm bằng giọng nói"}
        aria-pressed={listening} title="Tìm sách bằng giọng nói">
        {listening ? <MicOff size={18} /> : <Mic size={18} />}
      </button>
      {message && <span className="voice-search-message" role="status">{message}</span>}
    </span>
  );
}
