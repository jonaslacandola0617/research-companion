import {
  readState,
  writeState,
  serial,
  executeMutation,
} from "../services/storage";
import { buildSearchUrl } from "../services/queryBuilder";
import { identifierSchema, type CaptureDraft } from "../types";
import {
  track,
  logSearch,
  tabAction,
  forgetTab,
  forgetCase,
} from "./tabManager";
import { setupMenus, makeDraft } from "./contextMenus";
async function saveDraft(draft: CaptureDraft) {
  const state = await readState();
  draft.caseId = state.activeCaseId;
  const { drafts = [] } = await chrome.storage.session.get("drafts");
  await chrome.storage.session.set({ drafts: [...drafts, draft] });
}
async function errorNotice(error: unknown) {
  await chrome.storage.session.set({
    captureError: error instanceof Error ? error.message : String(error),
  });
}
chrome.runtime.onInstalled.addListener(() => {
  void setupMenus().catch(errorNotice);
  void chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(errorNotice);
});
chrome.runtime.onStartup.addListener(() => {
  void setupMenus().catch(errorNotice);
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab) return;
  void chrome.sidePanel.open({ windowId: tab.windowId }).catch(errorNotice);
  void serial(() =>
    saveDraft(
      makeDraft(
        String(info.menuItemId),
        info.selectionText || "",
        tab,
        info.frameUrl || info.pageUrl,
      ),
    ),
  ).catch(errorNotice);
});
chrome.commands.onCommand.addListener((command, tab) => {
  if (!tab?.id) return;
  void chrome.sidePanel.open({ windowId: tab.windowId }).catch(errorNotice);
  void serial(async () => {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      func: () => ({
        text: window.getSelection()?.toString() || "",
        url: location.href,
        title: document.title,
      }),
    });
    const data = results[0]?.result;
    if (!data?.text)
      throw Error(
        "Select text on a regular webpage first. Browser and protected pages cannot be captured.",
      );
    await saveDraft(
      makeDraft(
        command === "capture-finding" ? "capture" : "add",
        data.text,
        { ...tab, title: data.title },
        data.url,
      ),
    );
  }).catch(errorNotice);
});
chrome.tabs.onRemoved.addListener((id) => {
  void serial(() => forgetTab(id)).catch(errorNotice);
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  void serial(async () => {
    if (message.kind === "mutate") {
      const result = await executeMutation(message.cmd);
      if (message.cmd.type === "delete") await forgetCase(message.cmd.id);
      return result;
    }
    if (message.kind === "dismiss-draft") {
      const { drafts = [] } = await chrome.storage.session.get("drafts");
      await chrome.storage.session.set({
        drafts: drafts.filter((d: CaptureDraft) => d.id !== message.id),
      });
      return;
    }
    if (message.kind === "capture") {
      const [tab] = await chrome.tabs.query({
        active: true,
        windowId: message.windowId,
      });
      if (!tab?.id)
        throw Error("The original browser tab is no longer available.");
      let text = "";
      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection()?.toString() || "",
        });
        text = result[0]?.result || "";
      } catch {
        /* Side panel clicks may not grant activeTab; metadata/manual text capture remains available. */
      }
      await saveDraft(
        makeDraft(message.mode === "identifier" ? "add" : "capture", text, tab),
      );
      return;
    }
    const state = await readState();
    const c = state.cases.find((c) => c.id === message.caseId);
    if (!c) throw Error("No active case selected.");
    if (message.kind === "tabs") {
      await tabAction(c, message.action, message.windowId);
      return;
    }
    if (message.kind === "launch") {
      const identifier = identifierSchema.parse(message.identifier);
      const ids = [...new Set<string>(message.sourceIds)];
      if (ids.length > 10 && !message.confirmed)
        throw Error(
          `You are about to open ${ids.length} research tabs. Continue?`,
        );
      if (ids.length > 60) throw Error("Select 60 or fewer sources per batch.");
      const jobs = ids.map((id) => {
        const source = state.settings.sources.find((s) => s.id === id);
        if (!source) throw Error("Source no longer exists.");
        return { source, url: buildSearchUrl(source, identifier, c) };
      });
      const errors: string[] = [];
      let opened = 0;
      for (const { source, url } of jobs) {
        try {
          const tab = await chrome.tabs.create({
            url,
            active: false,
            windowId: message.windowId,
          });
          opened++;
          logSearch(c, source.id, source.name, identifier.value, url);
          try {
            await track(c, tab);
          } catch {
            errors.push(
              `${source.name}: tab opened, but grouping failed. Use Group Current Tab to retry.`,
            );
          }
        } catch {
          errors.push(`${source.name}: unable to open research tab.`);
        }
      }
      await writeState(state);
      return { opened, errors };
    }
    throw Error("Unknown browser action.");
  })
    .then((data) => respond({ ok: true, data }))
    .catch((error) =>
      respond({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete this action.",
      }),
    );
  return true;
});
