import { describe, expect, it } from "vitest";
import { cropToPixels, editCrop, pointOnCanvas } from "./crop-geometry";

describe("page-image crop geometry", () => {
  it("maps displayed canvas coordinates to normalized source-image coordinates", () => {
    expect(pointOnCanvas(260, 140, { left: 60, top: 40, width: 400, height: 200 }))
      .toEqual({ x: 0.5, y: 0.5 });
    expect(pointOnCanvas(900, 900, { left: 60, top: 40, width: 400, height: 200 }))
      .toEqual({ x: 1, y: 1 });
  });

  it("moves and resizes crops without crossing page bounds or minimum size", () => {
    const initial = { x: 0.2, y: 0.25, width: 0.4, height: 0.35 };
    expect(editCrop(initial, "move", 0.8, -0.5))
      .toEqual({ x: 0.6, y: 0, width: 0.4, height: 0.35 });
    const enlarged = editCrop(initial, "se", 0.2, 0.2);
    expect(enlarged.x).toBeCloseTo(0.2);
    expect(enlarged.y).toBeCloseTo(0.25);
    expect(enlarged.width).toBeCloseTo(0.6);
    expect(enlarged.height).toBeCloseTo(0.55);
    const shrunk = editCrop(initial, "nw", 0.9, 0.9);
    expect(shrunk.x).toBeCloseTo(0.56);
    expect(shrunk.y).toBeCloseTo(0.56);
    expect(shrunk.width).toBeCloseTo(0.04);
    expect(shrunk.height).toBeCloseTo(0.04);
  });

  it("maps the confirmed crop to intrinsic canvas pixels", () => {
    expect(cropToPixels({ x: 0.1, y: 0.2, width: 0.5, height: 0.4 }, 1200, 800))
      .toEqual({ x: 120, y: 160, width: 600, height: 320 });
  });
});
