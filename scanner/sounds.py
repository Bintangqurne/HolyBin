"""
Modul audio feedback untuk scanner.
Generate tone secara programmatic — tidak butuh file WAV terpisah.
Fallback silent jika simpleaudio/numpy tidak tersedia.
"""
import os

ENABLED = os.getenv("SOUND_ENABLED", "true").lower() == "true"

_audio_ok = False
_buffers: dict = {}

if ENABLED:
    try:
        import numpy as np
        import simpleaudio as sa

        def _make_tone(freq: float, duration_ms: int, volume: float = 0.5) -> sa.WaveObject:
            sample_rate = 44100
            t = np.linspace(0, duration_ms / 1000, int(sample_rate * duration_ms / 1000), False)
            wave = np.sin(2 * np.pi * freq * t) * volume
            # Fade in/out 10ms untuk hindari klik
            fade = int(sample_rate * 0.01)
            wave[:fade] *= np.linspace(0, 1, fade)
            wave[-fade:] *= np.linspace(1, 0, fade)
            audio = (wave * 32767).astype(np.int16)
            return sa.WaveObject(audio.tobytes(), 1, 2, sample_rate)

        _buffers = {
            "ok":    _make_tone(1000, 150),   # ding tinggi singkat — sukses
            "info":  _make_tone(600,  200),   # beep medium — sudah absen
            "error": _make_tone(300,  350),   # buzz rendah panjang — gagal
        }
        _audio_ok = True
    except Exception:
        pass   # jalan tanpa suara


def play(status: str) -> None:
    if not _audio_ok or not ENABLED:
        return
    obj = _buffers.get(status)
    if obj:
        try:
            obj.play()
        except Exception:
            pass
