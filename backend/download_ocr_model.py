from __future__ import annotations

import hashlib
from pathlib import Path
from urllib.request import urlopen


MODEL_URL = (
    "https://huggingface.co/AndrewSpano/2d-chess-ocr/resolve/main/"
    "yolo26m-finetuned.onnx"
)
MODEL_SHA256 = "a8e78afa8e00cd7ee39a941f888327bd85a12c3cf5c2140a4fa882ea3f7abff7"
MODEL_PATH = Path(__file__).parent / "models" / "yolo26m-finetuned.onnx"


def main() -> None:
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = MODEL_PATH.with_suffix(".onnx.download")
    digest = hashlib.sha256()
    try:
        with urlopen(MODEL_URL, timeout=60) as response, temporary_path.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                digest.update(chunk)
                output.write(chunk)
        if digest.hexdigest() != MODEL_SHA256:
            raise RuntimeError("Downloaded OCR model checksum does not match the pinned SHA-256.")
        temporary_path.replace(MODEL_PATH)
    finally:
        temporary_path.unlink(missing_ok=True)
    print(f"Verified OCR model saved to {MODEL_PATH}")


if __name__ == "__main__":
    main()
