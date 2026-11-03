import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GameReviewWorkspace from "./GameReviewWorkspace";

vi.mock("./queries/useStockfish", () => ({
  default: () => ({
    data: null,
    isLoading: false,
    isFetching: false,
    error: null,
  }),
}));

describe("GameReviewWorkspace", () => {
  it("renders the board and controls with original structure and workspace navigation", () => {
    const handleExit = vi.fn();
    render(<GameReviewWorkspace onExit={handleExit} />);

    // Workspace navigation bar
    const backBtn = screen.getByText("Back to Book Reader");
    expect(backBtn).toBeTruthy();

    const breadcrumbLinks = screen.getAllByText("ChessBook Reader");
    expect(breadcrumbLinks.length).toBeGreaterThan(0);

    // Board container
    const board = document.getElementById("Board");
    expect(board).toBeTruthy();

    // Controls container
    const controls = document.getElementById("Controls");
    expect(controls).toBeTruthy();

    // Title
    expect(screen.getAllByText("Game Review").length).toBeGreaterThan(0);

    // Accordion options
    expect(screen.getByText("chess.com")).toBeTruthy();
    expect(screen.getByText("lichess")).toBeTruthy();
    expect(screen.getByText("PGN")).toBeTruthy();

    // Click Back to Book Reader
    fireEvent.click(backBtn);
    expect(handleExit).toHaveBeenCalledTimes(1);
  });
});
