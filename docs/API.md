# API

## Optional local CV service

Base URL defaults to `http://127.0.0.1:8000` in `.env.example`.

### `GET /health`

Returns `{"status":"ok","detector":"opencv-grid-heuristic"}`. This indicates API liveness, not recognition quality.

### `POST /detect`

Request: multipart form field `image`, a PNG/JPEG rendering of one PDF page. Maximum request size is 12 MiB; only supported image content types are accepted.

Response:

```json
{
  "status": "detected",
  "candidates": [
    { "id": "page-candidate-1", "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.3, "confidence": 0.5 }
  ]
}
```

Rectangles are normalized to the submitted image dimensions. Candidate confidence is a heuristic score, not a calibrated probability. Empty candidates means no qualifying grid was found. The endpoint does not return FEN or piece predictions.

Errors use non-2xx status codes and JSON `detail`; no success-shaped defaults are returned.
