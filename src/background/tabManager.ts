import { activity, now, uuid, type ResearchCase } from "../types";
type Tabs = { caseId: string; tabId: number; windowId: number };
const key = "ownedResearchTabs";
async function owned(): Promise<Tabs[]> {
  return (await chrome.storage.session.get(key))[key] || [];
}
async function save(tabs: Tabs[]) {
  await chrome.storage.session.set({ [key]: tabs });
}
export async function track(c: ResearchCase, tab: chrome.tabs.Tab) {
  if (tab.id == null) throw Error("Unable to identify the research tab.");
  const records = (await owned()).filter((r) => r.tabId !== tab.id);
  records.push({ caseId: c.id, tabId: tab.id, windowId: tab.windowId });
  await save(records);
  const peers = await liveTabs(c.id);
  const sameWindow = peers.filter((t) => t.windowId === tab.windowId);
  const existing = sameWindow.find(
    (t) => t.id !== tab.id && t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE,
  );
  let groupId: number | undefined;
  // Reuse a group only when it contains no unrelated tabs.
  if (existing) {
    const members = await chrome.tabs.query({ groupId: existing.groupId });
    if (members.every((m) => sameWindow.some((t) => t.id === m.id)))
      groupId = existing.groupId;
  }
  const group = await chrome.tabs.group(
    groupId === undefined
      ? { tabIds: [tab.id] }
      : { tabIds: [tab.id], groupId },
  );
  await chrome.tabGroups.update(group, {
    title: `CASE — ${c.subjectName}`.slice(0, 100),
    color: "cyan",
  });
}
export async function liveTabs(caseId: string) {
  const records = await owned();
  const valid: Tabs[] = [];
  const tabs: chrome.tabs.Tab[] = [];
  for (const r of records) {
    try {
      const tab = await chrome.tabs.get(r.tabId);
      if (tab.windowId !== r.windowId) r.windowId = tab.windowId;
      valid.push(r);
      if (r.caseId === caseId) tabs.push(tab);
    } catch {
      /* Manually closed tabs are discarded. */
    }
  }
  await save(valid);
  return tabs;
}
export async function forgetTab(tabId: number) {
  await save((await owned()).filter((t) => t.tabId !== tabId));
}
export async function forgetCase(caseId: string) {
  await save((await owned()).filter((t) => t.caseId !== caseId));
}
export async function tabAction(
  c: ResearchCase,
  action: string,
  windowId?: number,
) {
  if (action === "group") {
    const [tab] = await chrome.tabs.query({
      active: true,
      ...(windowId ? { windowId } : { lastFocusedWindow: true }),
    });
    if (!tab?.id)
      throw Error("The original browser tab is no longer available.");
    await track(c, tab);
    return;
  }
  const tabs = await liveTabs(c.id);
  const ids = tabs.flatMap((t) => (t.id == null ? [] : [t.id]));
  if (!ids.length)
    throw Error("No tracked research tabs in this browser session.");
  if (action === "close") {
    const failed: number[] = [];
    for (const id of ids) {
      try {
        await chrome.tabs.remove(id);
        await forgetTab(id);
      } catch {
        // A manually closed tab is harmless. A live tab that could not be
        // closed keeps its ownership so the analyst can retry.
        try {
          await chrome.tabs.get(id);
          failed.push(id);
        } catch {
          await forgetTab(id);
        }
      }
    }
    if (failed.length)
      throw Error(
        `Unable to close ${failed.length} research tab(s). Please retry.`,
      );
  }
  if (action === "ungroup") {
    await chrome.tabs.ungroup(ids);
    await forgetCase(c.id);
  }
  if (action === "focus") {
    const first = tabs[0];
    if (first.id != null) {
      await chrome.windows.update(first.windowId, { focused: true });
      await chrome.tabs.update(first.id, { active: true });
      if (first.groupId !== -1)
        await chrome.tabGroups.update(first.groupId, { collapsed: false });
    }
  }
}
export function logSearch(
  c: ResearchCase,
  sourceId: string,
  name: string,
  query: string,
  url: string,
) {
  c.searches.push({ id: uuid(), sourceId, query, url, at: now() });
  if (!c.checklist[sourceId] || c.checklist[sourceId].status === "not_checked")
    c.checklist[sourceId] = {
      sourceId,
      status: "searched",
      notes: c.checklist[sourceId]?.notes || "",
      updatedAt: now(),
    };
  activity(c, "search", `${name} searched: ${query}`);
}
