"""Small local speech server for BookMarket voice search."""
import io
import json
import math
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock
from urllib.parse import urlsplit

from faster_whisper import WhisperModel, decode_audio

MODEL_PATH = os.environ.get("VOICE_MODEL_PATH", r"E:\BookMarket\voice-models\small")
VI_MODEL_PATH = os.environ.get("VOICE_VI_MODEL_PATH", r"E:\BookMarket\voice-models\phowhisper-small")
model = WhisperModel(MODEL_PATH, device="cpu", compute_type="int8")
vi_model = WhisperModel(VI_MODEL_PATH, device="cpu", compute_type="int8")
model_lock = Lock()


def transcribe_with(recognizer, waveform, language):
    segments, _ = recognizer.transcribe(
        waveform, language=language, beam_size=5,
        vad_filter=True, condition_on_previous_text=False,
        temperature=0,
    )
    segments = list(segments)
    transcript = " ".join(segment.text.strip() for segment in segments).strip()
    transcript = re.sub(r"[.,!?;:]+", "", transcript).strip()
    token_count = sum(max(len(segment.tokens), 1) for segment in segments)
    quality = (
        sum(segment.avg_logprob * max(len(segment.tokens), 1) for segment in segments)
        / token_count if token_count else float("-inf")
    )
    return transcript, quality


def choose_ambiguous_language(waveform, probabilities):
    """Try both supported languages only when detection is uncertain."""
    candidates = {}
    for language in ("en", "vi"):
        transcript, quality = transcribe_with(model, waveform, language)
        prior = probabilities.get(language, 0)
        if transcript and prior >= 0.05 and quality >= -1.2:
            candidates[language] = (
                quality + 0.2 * math.log(prior), transcript
            )
    if not candidates:
        return None, ""
    language = max(candidates, key=lambda key: candidates[key][0])
    return language, candidates[language][1]


class Handler(BaseHTTPRequestHandler):
    def end_headers(self):
        origin = self.headers.get("Origin")
        if origin in ("https://localhost", "capacitor://localhost", "http://localhost:5173", "http://127.0.0.1:5173"):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def respond(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/voice/status":
            return self.respond(200, {"local": True})
        self.respond(404, {"message": "Không tìm thấy API."})

    def do_POST(self):
        request_url = urlsplit(self.path)
        if request_url.path != "/voice/transcribe":
            return self.respond(404, {"message": "Không tìm thấy API."})
        size = int(self.headers.get("Content-Length", "0"))
        if not 512 <= size <= 2_000_000:
            return self.respond(400, {"message": "Đoạn ghi âm không hợp lệ hoặc quá dài."})
        audio = self.rfile.read(size)
        try:
            with model_lock:
                waveform = decode_audio(io.BytesIO(audio))
                language, probability, all_probabilities = model.detect_language(
                    audio=waveform, vad_filter=True
                )
                print(
                    f"Voice detect: {len(waveform) / 16000:.2f}s, "
                    f"{size} bytes, language={language}, confidence={probability:.2f}",
                    flush=True,
                )
                if language not in ("vi", "en") or probability < 0.75:
                    language, transcript = choose_ambiguous_language(
                        waveform, dict(all_probabilities)
                    )
                    if language == "vi":
                        transcript, _ = transcribe_with(vi_model, waveform, "vi")
                else:
                    chosen_model = vi_model if language == "vi" else model
                    transcript, _ = transcribe_with(chosen_model, waveform, language)
            if not transcript:
                print("Voice detect: no speech transcript", flush=True)
                return self.respond(400, {"message": "Chưa nghe rõ giọng nói. Hãy thử lại gần micro hơn."})
            self.respond(200, {"text": transcript, "language": language})
        except Exception as exc:
            print("Voice recognition error:", exc, flush=True)
            self.respond(400, {"message": "Không đọc được âm thanh. Hãy thử lại."})


if __name__ == "__main__":
    host = os.environ.get("VOICE_HOST", "127.0.0.1")
    print(f"BookMarket voice server: http://{host}:4001", flush=True)
    ThreadingHTTPServer((host, 4001), Handler).serve_forever()
