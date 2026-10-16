export type CropBounds = { x: number; y: number; width: number; height: number };
export type CropHandle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function pointOnCanvas(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
  };
}

export function editCrop(
  start: CropBounds,
  handle: CropHandle,
  deltaX: number,
  deltaY: number,
  minimum = 0.04,
): CropBounds {
  if (handle === "move") {
    const x = Math.max(0, Math.min(1 - start.width, start.x + deltaX));
    const y = Math.max(0, Math.min(1 - start.height, start.y + deltaY));
    return { ...start, x, y };
  }
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (handle.includes("w")) left = Math.max(0, Math.min(right - minimum, left + deltaX));
  if (handle.includes("e")) right = Math.min(1, Math.max(left + minimum, right + deltaX));
  if (handle.includes("n")) top = Math.max(0, Math.min(bottom - minimum, top + deltaY));
  if (handle.includes("s")) bottom = Math.min(1, Math.max(top + minimum, bottom + deltaY));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function cropToPixels(bounds: CropBounds, sourceWidth: number, sourceHeight: number) {
  const x = Math.max(0, Math.min(sourceWidth - 1, Math.floor(bounds.x * sourceWidth)));
  const y = Math.max(0, Math.min(sourceHeight - 1, Math.floor(bounds.y * sourceHeight)));
  const right = Math.max(x + 1, Math.min(sourceWidth, Math.ceil((bounds.x + bounds.width) * sourceWidth - 1e-7)));
  const bottom = Math.max(y + 1, Math.min(sourceHeight, Math.ceil((bounds.y + bounds.height) * sourceHeight - 1e-7)));
  return { x, y, width: right - x, height: bottom - y };
}
