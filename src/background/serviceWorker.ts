import {
  readState,
  writeState,
  serial,
  executeMutation,
} from "../services/storage";
import { buildSearchUrl } from "../services/queryBuilder";
import {
  activity,
  identifierSchema,
  now,
  uuid,
  type CaptureDraft,
  type DeepSearchTaskStatus,
} from "../types";
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
        makeDraft(
          message.mode === "identifier"
            ? "add"
            : message.mode === "lead"
              ? "lead"
              : "capture",
          text,
          tab,
        ),
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
    if (message.kind === "update-run") {
      const run = c.searchRuns.find((item) => item.id === message.runId);
      if (!run) throw Error("Search run no longer exists.");
      if (message.action === "pause") run.status = "paused";
      if (message.action === "continue")
        run.status = run.tasks.some((task) => task.enabled && task.status === "planned")
          ? "running"
          : "completed";
      if (message.action === "cancel") run.status = "cancelled";
      run.updatedAt = now();
      activity(c, "search", `Deep Search ${message.action}d (wave ${run.wave})`);
      await writeState(state);
      return run;
    }
    if (message.kind === "update-search-task") {
      const run = c.searchRuns.find((item) => item.id === message.runId);
      const task = run?.tasks.find((item) => item.id === message.taskId);
      if (!run || !task) throw Error("Search task no longer exists.");
      const allowed: DeepSearchTaskStatus[] = [
        "reviewed",
        "useful_lead",
        "no_useful_result",
        "unavailable",
        "blocked",
        "skipped",
      ];
      if (!allowed.includes(message.status)) throw Error("Unsupported task status.");
      task.status = message.status;
      task.reviewedAt = now();
      const event = c.searchHistory.find(
        (item) => item.searchRunId === run.id && item.taskId === task.id,
      );
      if (event) event.status = message.status;
      run.opened = run.tasks.filter((item) => item.status === "opened").length;
      run.skipped = run.tasks.filter((item) => item.status === "skipped").length;
      run.completed = run.tasks.filter((item) =>
        ["reviewed", "useful_lead", "no_useful_result", "unavailable", "blocked"].includes(
          item.status,
        ),
      ).length;
      if (message.status === "blocked") run.status = "paused";
      else if (!run.tasks.some((item) => item.enabled && item.status === "planned"))
        run.status = "completed";
      run.updatedAt = now();
      await writeState(state);
      return task;
    }
    if (message.kind === "run-search-batch") {
      const run = c.searchRuns.find((item) => item.id === message.runId);
      if (!run) throw Error("Search run no longer exists.");
      if (["paused", "cancelled", "completed"].includes(run.status))
        throw Error(`This search run is ${run.status}.`);
      const batchSize = state.settings.deepSearch.batchSize;
      const tasks = run.tasks
        .filter((task) => task.enabled && task.status === "planned")
        .slice(0, batchSize);
      if (!tasks.length) throw Error("No planned searches remain in this run.");
      run.status = "running";
      const errors: string[] = [];
      let opened = 0;
      for (const task of tasks) {
        try {
          const tab = await chrome.tabs.create({
            url: task.url,
            active: false,
            windowId: message.windowId,
          });
          task.status = "opened";
          task.openedAt = now();
          opened++;
          try {
            await track(c, tab, task.id);
          } catch {
            errors.push(
              `${task.targetSourceName || task.engineSourceId}: tab opened, but grouping failed.`,
            );
          }
          const sourceId = task.targetSourceId || task.engineSourceId;
          const sourceName = task.targetSourceName || task.engineSourceId;
          logSearch(c, sourceId, sourceName, task.query, task.url);
          c.searchHistory.push({
            id: uuid(),
            searchRunId: run.id,
            taskId: task.id,
            query: task.query,
            normalizedQuery: task.normalizedQuery,
            engineSourceId: task.engineSourceId,
            targetSourceId: task.targetSourceId,
            identifierIds: task.identifierIds,
            url: task.url,
            timestamp: task.openedAt,
            status: "opened",
          });
        } catch {
          task.status = "unavailable";
          task.reviewedAt = now();
          errors.push(`${task.targetSourceName || task.engineSourceId}: unable to open.`);
        }
      }
      run.currentTaskIndex = Math.max(
        0,
        run.tasks.findIndex((task) => task.enabled && task.status === "planned"),
      );
      run.opened = run.tasks.filter((task) => task.status === "opened").length;
      run.skipped = run.tasks.filter((task) => task.status === "skipped").length;
      run.completed = run.tasks.filter((task) =>
        ["reviewed", "useful_lead", "no_useful_result", "unavailable", "blocked"].includes(
          task.status,
        ),
      ).length;
      if (!run.tasks.some((task) => task.enabled && task.status === "planned"))
        run.status = "completed";
      run.updatedAt = now();
      await writeState(state);
      return { opened, errors, status: run.status };
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
