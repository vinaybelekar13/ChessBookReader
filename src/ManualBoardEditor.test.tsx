import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManualBoardEditor } from "./ManualBoardEditor";
import { START_PLACEMENT } from "./position-editor";

describe("ManualBoardEditor Component", () => {
  it("renders with initial position and labels", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ManualBoardEditor
        initialFen={`${START_PLACEMENT} w KQkq - 0 1`}
        title="Review recognized position"
        confirmLabel="Use on Board"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole("heading", { name: /review recognized position/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use on Board" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/valid chess position/i);
  });

  it("places a piece on an empty square", () => {
    const onConfirm = vi.fn();
    render(
      <ManualBoardEditor
        initialFen="8/8/8/8/8/8/8/8 w - - 0 1"
        title="Set Up Position"
        confirmLabel="Analyze Position"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    // Select White Queen 'Q' from palette
    const queenBtn = screen.getByRole("button", { name: "White queen" });
    fireEvent.click(queenBtn);

    // Click square e4
    const e4Square = screen.getByRole("button", { name: /e4/i });
    fireEvent.click(e4Square);

    // FEN input should now include Q at e4
    const fenInput = screen.getByPlaceholderText(/paste a complete six-field fen/i) as HTMLInputElement;
    expect(fenInput.value).toContain("4Q3");
  });

  it("replaces a white piece with a black piece", () => {
    render(
      <ManualBoardEditor
        initialFen="8/8/8/8/4Q3/8/8/8 w - - 0 1"
        title="Set Up Position"
        confirmLabel="Analyze Position"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Select Black Knight 'n' from palette
    const blackKnightBtn = screen.getByRole("button", { name: "Black knight" });
    fireEvent.click(blackKnightBtn);

    // Click square e4 (which currently has White Queen)
    const e4Square = screen.getByRole("button", { name: /e4/i });
    fireEvent.click(e4Square);

    const fenInput = screen.getByPlaceholderText(/paste a complete six-field fen/i) as HTMLInputElement;
    expect(fenInput.value).toContain("4n3");
    expect(fenInput.value).not.toContain("4Q3");
  });

  it("removes a piece using the erase tool", () => {
    render(
      <ManualBoardEditor
        initialFen="8/8/8/8/4Q3/8/8/8 w - - 0 1"
        title="Set Up Position"
        confirmLabel="Analyze Position"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Click Erase Piece tool
    const eraseBtn = screen.getByRole("button", { name: /erase piece/i });
    fireEvent.click(eraseBtn);

    // Click square e4
    const e4Square = screen.getByRole("button", { name: /e4/i });
    fireEvent.click(e4Square);

    const fenInput = screen.getByPlaceholderText(/paste a complete six-field fen/i) as HTMLInputElement;
    expect(fenInput.value.startsWith("8/8/8/8/8/8/8/8")).toBe(true);
  });

  it("supports undo and redo for manual edits", () => {
    render(
      <ManualBoardEditor
        initialFen="8/8/8/8/8/8/8/8 w - - 0 1"
        title="Set Up Position"
        confirmLabel="Analyze Position"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const fenInput = screen.getByPlaceholderText(/paste a complete six-field fen/i) as HTMLInputElement;
    const initialFen = fenInput.value;

    // Place White King on e1
    const whiteKingBtn = screen.getByRole("button", { name: "White king" });
    fireEvent.click(whiteKingBtn);
    const e1Square = screen.getByRole("button", { name: /e1/i });
    fireEvent.click(e1Square);
    expect(fenInput.value).not.toBe(initialFen);

    // Undo
    const undoBtn = screen.getByRole("button", { name: /undo/i });
    fireEvent.click(undoBtn);
    expect(fenInput.value).toBe(initialFen);

    // Redo
    const redoBtn = screen.getByRole("button", { name: /redo/i });
    fireEvent.click(redoBtn);
    expect(fenInput.value).toContain("4K3");
  });

  it("updates the board when valid FEN text is entered", () => {
    render(
      <ManualBoardEditor
        initialFen="8/8/8/8/8/8/8/8 w - - 0 1"
        title="Set Up Position"
        confirmLabel="Analyze Position"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const fenInput = screen.getByPlaceholderText(/paste a complete six-field fen/i) as HTMLInputElement;
    fireEvent.change(fenInput, { target: { value: "4k3/8/8/8/8/8/8/4K3 w - - 0 1" } });

    // Both kings should be recognized
    expect(screen.getByText(/kings: white ✓ 1, black ✓ 1/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze Position" })).not.toBeDisabled();
  });

  it("displays an error on invalid FEN without crashing or losing editable state", () => {
    render(
      <ManualBoardEditor
        initialFen="4k3/8/8/8/8/8/8/4K3 w - - 0 1"
        title="Set Up Position"
        confirmLabel="Analyze Position"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const fenInput = screen.getByPlaceholderText(/paste a complete six-field fen/i) as HTMLInputElement;
    fireEvent.change(fenInput, { target: { value: "invalid-fen-string" } });

    // Shows warning badge
    expect(screen.getByRole("status")).toHaveTextContent(/must contain exactly 6 space-separated fields|invalid/i);
    // Button is disabled when invalid
    expect(screen.getByRole("button", { name: "Analyze Position" })).toBeDisabled();
  });

  it("prevents confirmation when kings are missing and displays clear error", () => {
    const onConfirm = vi.fn();
    render(
      <ManualBoardEditor
        initialFen="8/8/8/8/8/8/8/8 w - - 0 1"
        title="Set Up Position"
        confirmLabel="Analyze Position"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    // Status shows missing king
    expect(screen.getByRole("status")).toHaveTextContent(/missing a white king/i);

    // Confirm button is disabled
    const confirmBtn = screen.getByRole("button", { name: "Analyze Position" });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("reflects side to move toggle in FEN", () => {
    render(
      <ManualBoardEditor
        initialFen="4k3/8/8/8/8/8/8/4K3 w - - 0 1"
        title="Set Up Position"
        confirmLabel="Analyze Position"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const fenInput = screen.getByPlaceholderText(/paste a complete six-field fen/i) as HTMLInputElement;
    expect(fenInput.value).toContain(" w ");

    // Click Black to move
    const blackTurnBtn = screen.getByRole("button", { name: /black to move/i });
    fireEvent.click(blackTurnBtn);

    expect(fenInput.value).toContain(" b ");

    // Click White to move
    const whiteTurnBtn = screen.getByRole("button", { name: /white to move/i });
    fireEvent.click(whiteTurnBtn);

    expect(fenInput.value).toContain(" w ");
  });

  it("submits valid FEN on confirmation", () => {
    const onConfirm = vi.fn();
    const validFen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";

    render(
      <ManualBoardEditor
        initialFen={validFen}
        title="Set Up Position"
        confirmLabel="Analyze Position"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    const confirmBtn = screen.getByRole("button", { name: "Analyze Position" });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(validFen);
  });

  it("cancels without confirming", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ManualBoardEditor
        initialFen="4k3/8/8/8/8/8/8/4K3 w - - 0 1"
        title="Set Up Position"
        confirmLabel="Analyze Position"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
