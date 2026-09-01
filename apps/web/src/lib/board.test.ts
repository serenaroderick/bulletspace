import { InMemoryAdapter } from "@bulletspace/core";
import { afterEach, describe, expect, it } from "vitest";
import { ensureDefaultBoard, resetDefaultBoardCache } from "./board";

describe("ensureDefaultBoard", () => {
  afterEach(() => {
    resetDefaultBoardCache();
  });

  it("creates a board when none exists", async () => {
    const adapter = new InMemoryAdapter();
    const board = await ensureDefaultBoard(adapter);
    expect(board.name).toBe("Dashboard");
    expect(await adapter.listBoards()).toHaveLength(1);
  });

  it("returns the existing board instead of creating a second one", async () => {
    const adapter = new InMemoryAdapter();
    const existing = {
      id: "b1",
      name: "Existing",
      canvasConfig: {
        width: 4000,
        height: 4000,
        zoom: 1,
        scrollX: 0,
        scrollY: 0,
        grid: { style: "dot" as const, spacing: 24, color: "#dddddd", opacity: 0.7 },
        canvasBackground: { type: "color" as const, value: "#ffffff" },
        parallax: { enabled: true, backgroundSpeed: 0.3, photoSpeed: 0.7 },
        snapToGrid: true,
        editMode: true,
      },
      createdAt: 1,
      updatedAt: 1,
    };
    await adapter.createBoard(existing);

    const board = await ensureDefaultBoard(adapter);
    expect(board).toEqual(existing);
    expect(await adapter.listBoards()).toHaveLength(1);
  });

  it("never creates duplicates under concurrent calls (the StrictMode double-invoke race)", async () => {
    const adapter = new InMemoryAdapter();

    const [first, second] = await Promise.all([ensureDefaultBoard(adapter), ensureDefaultBoard(adapter)]);

    expect(first).toEqual(second);
    expect(await adapter.listBoards()).toHaveLength(1);
  });
});
