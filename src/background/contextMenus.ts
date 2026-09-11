import { type CaptureDraft, type IdentifierType } from "../types";
export const menuItems = [
  ["add", "Add to Current Case"],
  ["exact", "Search Exact Text"],
  ["name", "Search as Name"],
  ["username", "Search as Username"],
  ["email", "Search as Email"],
  ["phone", "Search as Phone"],
  ["city", "Search as Location"],
  ["google", "Search Google"],
  ["bing", "Search Bing"],
  ["duckduckgo", "Search DuckDuckGo"],
  ["whatsmyname", "Search WhatsMyName"],
  ["idcrawl", "Search IDCrawl"],
  ["capture", "Capture as Finding"],
];
export async function setupMenus() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: "research-companion",
    title: "Research Companion",
    contexts: ["selection"],
  });
  for (const [id, title] of menuItems)
    chrome.contextMenus.create({
      id,
      title,
      parentId: "research-companion",
      contexts: ["selection"],
    });
}
export function makeDraft(
  action: string,
  text: string,
  tab?: chrome.tabs.Tab,
  sourceUrl = tab?.url || "",
): CaptureDraft {
  let domain = "";
  try {
    domain = new URL(sourceUrl).hostname;
  } catch {}
  const typed = ["name", "username", "email", "phone", "city"].includes(action)
    ? (action as IdentifierType)
    : undefined;
  return {
    id: crypto.randomUUID(),
    caseId: null,
    mode:
      action === "capture"
        ? "finding"
        : action === "add"
          ? "identifier"
          : "search",
    text: action === "exact" ? `"${text.replace(/"/g, "")}"` : text,
    pageTitle: tab?.title || "",
    sourceUrl: /^https?:\/\//.test(sourceUrl) ? sourceUrl : "",
    domain,
    capturedAt: new Date().toISOString(),
    identifierType: typed,
    sourceId: [
      "google",
      "bing",
      "duckduckgo",
      "whatsmyname",
      "idcrawl",
    ].includes(action)
      ? action
      : undefined,
  };
}
