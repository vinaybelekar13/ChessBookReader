# Optional OCR model

The reader's position-recognition endpoint uses `yolo26m-finetuned.onnx` from
[AndrewSpano/2d-chess-ocr](https://huggingface.co/AndrewSpano/2d-chess-ocr).
The model repository declares the MIT License (copyright Andreas Spanopoulos,
2026). The model is downloaded separately rather than included in the source tree.

From `backend`, install `requirements-ocr.txt`, then run:

```powershell
py download_ocr_model.py
```

The download script verifies SHA-256
`a8e78afa8e00cd7ee39a941f888327bd85a12c3cf5c2140a4fa882ea3f7abff7`.
The model was trained for 2D chess screenshots; printed-book diagrams have not
been established as an in-distribution use case. Its scores are uncalibrated.
