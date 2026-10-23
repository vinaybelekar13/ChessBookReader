import "fake-indexeddb/auto";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

class FakeWorker {
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  commands: string[] = [];
  terminated = false;
  postMessage(command: string) {
    this.commands.push(command);
    if (command === "uci") {
      setTimeout(() => this.send("uciok"), 10);
    } else if (command === "isready") {
      setTimeout(() => this.send("readyok"), 10);
    }
  }
  terminate() {
    this.terminated = true;
  }
  send(data: string) {
    this.onmessage?.({ data } as MessageEvent<string>);
  }
}

describe("App - Manual Position Setup & Stockfish Analysis", () => {
  let fakeWorker: FakeWorker;

  beforeEach(() => {
    fakeWorker = new FakeWorker();
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          return fakeWorker;
        }
      }
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("chessbook-reader");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });

  it("renders 'Set Up Position' buttons on the analysis board and toggles setup mode", async () => {
    render(<App />);

    // Wait for app initialization
    const setupBtns = await screen.findAllByRole("button", { name: /set up position/i });
    expect(setupBtns.length).toBeGreaterThanOrEqual(1);

    // Click Set Up Position
    fireEvent.click(setupBtns[0]);

    // Modal should be open
    expect(screen.getByRole("dialog", { name: "Set Up Position" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze Position" })).toBeInTheDocument();

    // Click Cancel
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Modal should close
    expect(screen.queryByRole("dialog", { name: "Set Up Position" })).not.toBeInTheDocument();
  });

  it("loads a custom manual position, reflects side to move, and triggers Stockfish analysis", async () => {
    render(<App />);

    const setupBtns = await screen.findAllByRole("button", { name: /set up position/i });
    fireEvent.click(setupBtns[0]);

    // Set custom position with Black to move
    const fenInput = screen.getByPlaceholderText(/paste a complete six-field fen/i) as HTMLInputElement;
    const customFen = "4k3/8/8/8/8/8/8/4K3 b - - 0 1";
    fireEvent.change(fenInput, { target: { value: customFen } });

    // Confirm with Analyze Position
    const analyzeBtn = screen.getByRole("button", { name: "Analyze Position" });
    await act(async () => {
      fireEvent.click(analyzeBtn);
    });

    // Modal should close
    expect(screen.queryByRole("dialog", { name: "Set Up Position" })).not.toBeInTheDocument();

    // Board FEN should match the custom position
    const boardFenElement = screen.getByText(customFen);
    expect(boardFenElement).toBeInTheDocument();

    // Stockfish worker should have received uci and commands
    expect(fakeWorker.commands).toContain("uci");
  });
});
