# Research Companion

A Chrome Manifest V3 extension for a human-controlled research workflow:

**Identifier → Search → Find → Capture → Compare → Pivot → Corroborate → Assess → Report**

React, TypeScript, and Vite power a compact, persistent side panel. Case records stay in the browser. There is no backend, account, external AI, analytics, telemetry, scraping, automatic form submission, or automated identity decision.

## Quick start

Requires Node.js 22.12+ (Node 24 recommended), npm, and Chrome 116 or newer.

```sh
npm install
npm run typecheck
npm test
npm run build
```

The complete unpacked Chrome extension is produced in **`dist/`**. This workspace's exact build path is **`D:\argus-extension\dist`**. All runtime assets are bundled locally.

### Load it in Chrome

1. Build using `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select **`D:\argus-extension\dist`**, not the project root.
6. Pin **Research Companion** using Chrome's Extensions menu.
7. Click the toolbar icon to open the side panel.
8. Create a case, or open **Settings → Load fictional demo**.
9. After rebuilding, click **Reload** on its `chrome://extensions` card, then reopen the panel.

No server needs to run when using the installed build.

### Development preview

```sh
npm run dev
```

Open the printed localhost URL, normally `http://127.0.0.1:5173/`. Preview mode uses a separate origin's `localStorage` and displays a preview label. Browser-only actions show a clear message instead of pretending to work. The preview cannot exercise Chrome sidePanel, contextMenus, scripting, or tab grouping. Its records are separate from the installed extension; JSON exports can transfer them.

```sh
npm run typecheck
npm test
npm run build
npm run format
```

The Vite manifest lives in `public/manifest.json`; Vite copies it and the icons to `dist/`. The service worker has a stable `background.js` entry and local shared ES modules. No inline scripts or remote executable code are used.

## Features

### Cases and identifiers

- Create, switch, rename through **Edit details**, duplicate, archive/restore, and delete cases. Deletion requires confirmation.
- Optional structured subject fields: name parts, aliases, age/DOB, location/history, employers, schools, relatives, usernames, emails, phones, other identifiers, and notes.
- **Convert details to identifiers** deduplicates by type/value. Use semicolons between multiple profile values; commas are retained for locations and names.
- Nineteen identifier types; value, source, notes, timestamp, confidence, and analyst-controlled verified/unverified status.
- Click an identifier chip to search, copy, edit/add notes, mark verified/unverified, or remove it.
- Local pattern suggestions for email, username, URL, phone, and possible address. Suggestions require acceptance.
- Global search across saved cases, profiles, identifiers, findings, and notes, including archived cases.

### Search and research progress

- All 60 named sources: PSE (14), SEARCH (6), 1ST SM (4), TOP SOCMED (9), SUB SOC (17), ARREST (7), GSR (3). The brief's sample `SUB SOC 4/20` was illustrative; its actual named list contains 17 sources.
- Choose a stored identifier or custom input, its type, and one or more sources. More than 10 tabs requires confirmation. Maximum batch: 60.
- Google, Bing, and DuckDuckGo have encoded search URL templates. Other built-in sources deliberately open their homepage/tool page for manual entry.
- Each source describes the search strategy and supported identifiers. Disabled sources are omitted. Incompatible sources cannot be selected; previously selected incompatible sources produce an error before opening any tabs.
- Copy the identifier from the search field, then paste it into the opened source yourself.
- Editable exact-name, location, employer, relative, username, and `site:` queries.
- Per-case source status and notes. Opening a tab changes only Not Checked → Searched. All other statuses require analyst input and are preserved on later launches.
- Current-tab source recognition is based on exact host/subdomain matching, not substring matching.

### Browser integration

- Launched tabs are explicitly tracked and grouped by case. A separate group is used in each Chrome window when necessary.
- **Open Research Tabs** focuses the first currently tracked tab and expands its group; it does not replay history or recreate closed tabs.
- **Group Current Tab** explicitly claims a tab for the active case. A tab has one case owner at a time.
- **Close Case Research Tabs** closes only tracked tabs for this case, not every tab in a Chrome group.
- **Ungroup Tabs** ungroups and releases ownership, so a later close action cannot close them.
- A group containing unrelated tabs is never renamed/reused when adding a new research tab.
- Ownership is stored in `chrome.storage.session`, survives worker suspension, and expires at browser restart. Old IDs are never reused from an exported case. Existing restored groups can be reclaimed one tab at a time using Group Current Tab.
- Selection context menu includes all requested Add, typed search, search-engine, and Capture options. Searches first open a reviewable panel workflow; **Open searches** is the final user-controlled launch.
- Captures without a case are queued until one is selected. Captures for another case require explicitly selecting/reassigning the case. Multiple captures are queued in order.

### Findings and provenance

- Capture selected text from the right-click menu or keyboard shortcut. Capture Current Page can also collect page metadata and opens a manual text form.
- Edit title, observation, source display information, category, related identifier, analyst note, assessment, and confidence before saving.
- Original URL, page title, domain, and timestamp remain separately visible and are preserved by the repository on subsequent edits.
- Finding search and assessment filters; all four confidence and assessment labels.
- Public-record sources are leads requiring verification. A name hit never changes candidate classification or establishes criminal-record association.

### Compare, assess, and report

- Candidate profiles with their own editable identifiers, analyst-selected classifications, and rationales.
- Scrollable match matrix with Match, Partial Match, Conflict, Unknown, and Not Applicable plus per-cell evidence notes. Text and symbols accompany colors.
- No automatic scoring, inferred identity, or automatic Confirmed classification.
- Discrepancies record two sources/values, possible explanation, notes, and unresolved/resolved status.
- Chronological research trail records case, search, identifier, finding, candidate, source, discrepancy, and note actions. UI shows the most recent 100 events; exports retain the entire trail. It is an editable local research record, not a tamper-proof forensic audit log.
- Structured cautious report with case information, key identifiers, likely/possible/excluded associations, findings with provenance, discrepancies, unresolved items, sources reviewed, analyst notes, and trail.
- Copy plain text, copy Markdown, download Markdown, print, and export complete JSON. Printing also permits Chrome's own Save as PDF option; no separate PDF renderer is bundled.
- Validated JSON import preserves the original case ID, nested records, comparisons, and provenance. Existing IDs are never overwritten. A duplicate must be created explicitly if needed.

### Settings and demo

- Light/dark neutral themes, enable/disable sources, edit/reorder sources, open homepages, and add custom sources with validated templates.
- Optional **FICTIONAL DEMO DATA**: Daniel Luis Ramirez, identifiers, a supporting observation, discrepancy, and three illustrative candidates (strong possible, ambiguous, excluded false positive). No demo searches are sent automatically; only reserved `example.com` provenance URLs are used.

## Keyboard shortcuts

| Action                             | Default     |
| ---------------------------------- | ----------- |
| Open/toggle Research Companion     | Alt+Shift+R |
| Capture selected text as a finding | Alt+Shift+F |
| Add selected text as an identifier | Alt+Shift+I |

Chrome may leave shortcuts unassigned if another extension or the OS uses them. Inspect/change them at `chrome://extensions/shortcuts`. On macOS Chrome translates Alt to Option.

## Permissions and privacy

| Permission     | Why it is needed                                                                             |
| -------------- | -------------------------------------------------------------------------------------------- |
| `storage`      | Save cases/settings locally; hold pending captures/tab ownership in session storage.         |
| `tabs`         | Read active page URL/title, recognize a source, and manage explicitly tracked research tabs. |
| `tabGroups`    | Create and update case research groups.                                                      |
| `contextMenus` | Selection-only research menu.                                                                |
| `sidePanel`    | Persistent analyst workspace.                                                                |
| `activeTab`    | Temporary page access following a user action.                                               |
| `scripting`    | Read selected text on explicit capture/shortcut actions. No persistent content script.       |

**No host permissions are requested.** The extension does not run background crawlers or read whole documents. It does not fetch third-party APIs. When you explicitly launch an encoded search URL, the selected website receives the query through normal browser navigation. Homepage launches transmit no identifiers in their URL. Websites may require payment, authentication, or their own permissions; the analyst handles those manually.

Cases use `chrome.storage.local`, never `storage.sync`. Data and exports are **not encrypted**. Other users with access to the browser profile or exported file may read them. Uninstalling the extension or clearing its browser storage can delete local records; keep JSON backups. Browser history may retain URLs you choose to open. No extension telemetry is collected.

## Storage and architecture

`src/types/index.ts` defines strong TypeScript types backed by Zod runtime schemas: Case/ResearchCase, Identifier, Finding, Candidate, CandidateIdentifierComparison, ResearchSource, SearchEvent, ResearchChecklistItem, Discrepancy, ActivityEvent, ExtensionSettings.

`src/services/storage.ts` is the storage boundary. The CaseRepository and SettingsRepository plus mutation API keep Chrome persistence out of page components. The worker serializes read-modify-write operations. Case and settings saves compare the caller's revision/snapshot and reject stale writes instead of silently overwriting another panel. Forms save explicitly; keystrokes do not write to storage.

The versioned root is `{ schemaVersion: 1, activeCaseId, cases, settings }`. `migrate()` is the entry point for future schema migrations. Unknown versions or malformed records are preserved and a recovery screen offers a raw backup. Nothing is silently reset. JSON imports have a 10 MB limit and nested field/type/date/UUID/URL/reference validation. The browser's own storage quota may be lower than a particularly large import; write failures are surfaced. React renders captured text as text; no HTML evaluation or `dangerouslySetInnerHTML` is used.

The entire workspace is one atomic local-storage value, suitable for small/moderate datasets. Future encrypted or per-case storage can replace the repository boundary. Settings are global and are not included in single-case JSON; the case retains source IDs, checklist notes, URLs in search events, and finding provenance.

### Project structure

```text
public/
  manifest.json              Manifest V3 permissions, commands, panel, worker
  icons/                     Bundled extension icons
src/
  background/
    serviceWorker.ts         Serialized messages, commands, queued capture
    contextMenus.ts          Menu registration and capture metadata
    tabManager.ts            Session tab ownership and safe grouping
  config/
    researchSources.ts       60 sources, categories, domain recognition
    queryTemplates.ts        Query patterns
    demo.ts                  Opt-in fictional data
  types/index.ts             Types, runtime schemas, factories
  services/
    storage.ts               Versioned persistence and repositories
    queryBuilder.ts          URL safety, queries, identifier suggestions
    comparison.ts            Manual comparison data operations
    reportBuilder.ts         Structured cautious summaries
    exportImport.ts          JSON validation, serialization, download
  sidepanel/
    App.tsx                  Shell, cases, global search, capture routing
    workspace.ts             Shared workspace context
    components/              Accessible dialog, fields, identifier tools
    pages/                   Case, Search, Findings, Compare, Report, Settings
  styles/global.css          Responsive light/dark panel design
  tests/                     Vitest data, safety, and tab tests
index.html
vite.config.ts
package.json
package-lock.json
README.md
dist/                        Built unpacked extension (generated)
```

## Adding a source

Use **Settings → Add custom**, or extend `src/config/researchSources.ts` for a built-in source. Keep IDs stable: source checklists reference them. Set an HTTP(S) homepage, category, enabled flag, supported identifier types, strategy, and notes. Choose homepage mode unless the search URL is reliable.

Supported URL-template variables:

```text
{query} {name} {firstName} {lastName} {username} {email} {phone} {city} {state}
```

Example: `https://example.com/search?q={name}&city={city}`. Each substituted value is passed through `encodeURIComponent`. Variables are allowed in the path/query, never the hostname. Unknown variables, credentials in URLs, non-HTTP(S) schemes, and missing values are rejected. `{query}` means the chosen input; typed values otherwise fall back to case identifiers/profile fields. Matching is never inferred from a search URL.

Query patterns live in `src/config/queryTemplates.ts`. They support the subject name, city, state, employer, relative, and username. The builder skips patterns with missing values, quotes each value, removes embedded quotation marks, and deduplicates results. Choosing a query populates the editable search input and selects Google; the user still clicks Open searches.

The Google Review Date Finder entry opens [Reviewflowz's named tool](https://www.reviewflowz.com/free-tools/google-review-date-finder). Search-service URLs can change; use the source editor to correct or disable unavailable entries.

## Chrome limitations / deliberate scope

- `sidePanel.open()` needs a user gesture; menu and command handlers call it before awaiting asynchronous work. See [Chrome sidePanel documentation](https://developer.chrome.com/docs/extensions/reference/api/sidePanel).
- Chrome internal pages, the Web Store, some PDF viewers, and protected frames cannot be scripted. Shortcut capture shows an error. Panel capture can still provide available metadata and a manual form. Use selection context menus on normal webpages for the most reliable selected-text capture.
- Side-panel button clicks do not always grant fresh `activeTab` access. No broad host permission is requested merely to avoid this limitation.
- Tab/group IDs are valid only within a browser session. Restored tabs are intentionally not automatically reattached after a browser restart. See [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs).
- There is no automated website form entry, login, CAPTCHA handling, facial recognition, scraping, contact lookup API, identity scoring, or confirmation engine.
- Backend/cloud sync, encryption, collaboration, automated PDF generation, attachment capture, custom-source sharing, undo/trash, and automatic tab restoration are deferred.
- Clipboard and print require browser permission/user activation. Their availability can differ in a standalone preview.
- Local records are intended for small/moderate case volumes. No large-dataset indexing or background import worker is included.

## Manual testing checklist

Use a disposable **fictional** case in the installed extension:

1. Create a case, edit/rename it, enter profile values, convert to identifiers, and reload the panel. Verify persistence.
2. Add an email; accept/change the suggestion. Exercise chip edit, copy, notes, verification, and removal.
3. Select Google and Bing, open searches, and verify both tabs join the right case group. Open a homepage launcher and manually paste the copied identifier.
4. Select 11 supported sources and verify the warning; cancel to ensure no tabs open.
5. Leave unrelated tabs open. Group a test tab, manually close one research tab, ungroup/release tabs, and close only the remaining tracked tabs. Confirm unrelated tabs survive.
6. On a regular page select text → Research Companion → Capture as Finding. Confirm text, URL, page title, domain, and timestamp. Edit display metadata and confirm original provenance remains.
7. Repeat capture with no active case; select/create a case and continue. Queue multiple captures and process them in order. Test shortcuts and a protected-page error.
8. Create candidates, add identifiers, select comparison values, enter evidence notes and a rationale. Confirm classification changes only through the analyst selector.
9. Record and resolve a discrepancy. Inspect the trail and report.
10. Export JSON, delete the disposable case after confirming, import it, and verify IDs/evidence/comparisons. Try malformed JSON and duplicate import; both should show errors.
11. Copy both report formats, download Markdown, and print.
12. Toggle a source, change order, and add a safe custom URL template. Reject `javascript:` and unknown variables. Test light/dark and 360/390/440 px widths.
13. Search all cases for an identifier/finding. Duplicate/archive/restore/switch cases. Keep two panels open and verify stale saves are rejected.
14. Restart Chrome: case data remains, but previous session tab ownership expires safely.

Automated tests cover query generation, local suggestions, source URLs/template validation, full JSON roundtrips, schema/import failures, comparison logic, report provenance, concurrent writes, and tab-ownership safety. Visual checks use the local preview; Chrome-native menu/shortcut/side-panel behavior should additionally be checked using the installed build.

### Windows npm troubleshooting

If PowerShell resolves an old `npm.ps1` and reports a missing `npm-cli.js`, use the npm shipped with Node, for example:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' install
& 'C:\Program Files\nodejs\npm.cmd' run build
```

This is a PATH/shim issue on the host, not an extension dependency. No system-wide npm files are modified by this project.
