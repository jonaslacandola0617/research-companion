import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCase } from "../types";
import {
  liveTabs,
  logSearch,
  tabAction,
  track,
} from "../background/tabManager";
let session: Record<string, unknown>;
let tabs: Map<number, { id: number; windowId: number; groupId: number }>;
let group: ReturnType<typeof vi.fn>;
let remove: ReturnType<typeof vi.fn>;
let ungroup: ReturnType<typeof vi.fn>;
let updateGroup: ReturnType<typeof vi.fn>;
beforeEach(() => {
  session = {};
  tabs = new Map([
    [1, { id: 1, windowId: 1, groupId: -1 }],
    [2, { id: 2, windowId: 1, groupId: -1 }],
    [3, { id: 3, windowId: 1, groupId: -1 }],
  ]);
  let nextGroup = 10;
  group = vi.fn(async (options: { tabIds: number[]; groupId?: number }) => {
    const id = options.groupId ?? nextGroup++;
    for (const t of options.tabIds) tabs.get(t)!.groupId = id;
    return id;
  });
  remove = vi.fn(async (id: number) => {
    tabs.delete(id);
  });
  ungroup = vi.fn(async (ids: number[]) => {
    ids.forEach((id) => (tabs.get(id)!.groupId = -1));
  });
  updateGroup = vi.fn(async () => {});
  vi.stubGlobal("chrome", {
    storage: {
      session: {
        get: vi.fn(async (key: string) => ({
          [key]: structuredClone(session[key]),
        })),
        set: vi.fn(async (values: Record<string, unknown>) =>
          Object.assign(session, structuredClone(values)),
        ),
      },
    },
    tabs: {
      get: vi.fn(async (id: number) => {
        const t = tabs.get(id);
        if (!t) throw Error("Closed");
        return { ...t };
      }),
      query: vi.fn(async (options: { groupId?: number }) =>
        options.groupId === undefined
          ? [...tabs.values()]
          : [...tabs.values()].filter((t) => t.groupId === options.groupId),
      ),
      group,
      remove,
      ungroup,
      update: vi.fn(),
    },
    tabGroups: { TAB_GROUP_ID_NONE: -1, update: updateGroup },
    windows: { update: vi.fn() },
  });
});
describe("case tab ownership", () => {
  it("closes only tracked tabs and leaves unrelated tabs alone", async () => {
    const c = createCase("Test");
    await track(c, tabs.get(1)! as chrome.tabs.Tab);
    await tabAction(c, "close");
    expect(remove).toHaveBeenCalledExactlyOnceWith(1);
    expect(tabs.has(2)).toBe(true);
    expect(tabs.has(3)).toBe(true);
  });
  it("does not close tabs belonging to another case", async () => {
    const a = createCase("A"),
      b = createCase("B");
    await track(a, tabs.get(1)! as chrome.tabs.Tab);
    await track(b, tabs.get(2)! as chrome.tabs.Tab);
    await tabAction(a, "close");
    expect(tabs.has(2)).toBe(true);
  });
  it("reuses a clean case group", async () => {
    const c = createCase("A");
    await track(c, tabs.get(1)! as chrome.tabs.Tab);
    await track(c, tabs.get(2)! as chrome.tabs.Tab);
    expect(tabs.get(1)!.groupId).toBe(tabs.get(2)!.groupId);
  });
  it("never renames a group that includes unrelated tabs", async () => {
    const c = createCase("A");
    await track(c, tabs.get(1)! as chrome.tabs.Tab);
    tabs.get(3)!.groupId = tabs.get(1)!.groupId;
    await track(c, tabs.get(2)! as chrome.tabs.Tab);
    expect(tabs.get(2)!.groupId).not.toBe(tabs.get(1)!.groupId);
  });
  it("drops manually closed tab IDs", async () => {
    const c = createCase("A");
    await track(c, tabs.get(1)! as chrome.tabs.Tab);
    tabs.delete(1);
    expect(await liveTabs(c.id)).toEqual([]);
    expect(session.ownedResearchTabs).toEqual([]);
  });
  it("ungroup releases ownership", async () => {
    const c = createCase("A");
    await track(c, tabs.get(1)! as chrome.tabs.Tab);
    await tabAction(c, "ungroup");
    expect(ungroup).toHaveBeenCalledWith([1]);
    await expect(tabAction(c, "close")).rejects.toThrow("No tracked");
    expect(remove).not.toHaveBeenCalled();
  });
  it("does not trust IDs across browser sessions", async () => {
    const c = createCase("A");
    await track(c, tabs.get(1)! as chrome.tabs.Tab);
    session = {};
    await expect(tabAction(c, "close")).rejects.toThrow("No tracked");
    expect(remove).not.toHaveBeenCalled();
  });
  it("marks searched without overwriting an analyst assessment", () => {
    const c = createCase("A");
    logSearch(c, "google", "Google", "test", "https://google.com");
    expect(c.checklist.google.status).toBe("searched");
    c.checklist.google.status = "no_relevant_result";
    logSearch(c, "google", "Google", "test again", "https://google.com");
    expect(c.checklist.google.status).toBe("no_relevant_result");
    expect(c.searches).toHaveLength(2);
  });
});
