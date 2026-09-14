# Research Companion

Research Companion is a local-first Chrome Manifest V3 side-panel extension for analyst-controlled Person of Interest research.

Its main workflow is:

**Known identifiers → Deep Search plan → Controlled search batches → Analyst review → Approved identifier → Continuation wave**

The extension constructs and ranks searches, selects sources, rotates Google/Bing/DuckDuckGo, opens and groups case-owned tabs, prevents repeated searches, and records progress. It does not scrape protected content, submit third-party forms, bypass login/CAPTCHA/anti-bot controls, resolve identities automatically, or assert that a result belongs to the POI.

## Build and load

Requires Node.js 22.12+, npm, and Chrome 116+.

```sh
npm install
npm run typecheck
npm test
npm run build
```

Load the generated `dist/` directory:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this repository's `dist` directory.
5. Pin **Research Companion** and open its side panel.
6. After a new build, click **Reload** on the extension card.

No development server is required for the installed build. `npm run dev` provides a UI-only localhost preview; Chrome tabs, tab groups, context menus, scripting, and side-panel APIs work only in the loaded extension.

## Deep Search workflow

1. Create one case per POI and add known identifiers.
2. Mark identifiers as **Analyst supplied**, **Verified**, or **Unverified lead**. Only supplied/verified values are search seeds.
3. Open **Deep Search**, optionally include public-record sources, and prepare a plan.
4. Review, disable, or remove planned tasks before launching anything.
5. Run the next batch. The default batch is five tabs; the size is configurable.
6. Review each opened task as useful, no useful result, reviewed, or blocked.
7. Save promising webpages under **Leads** without making an identity conclusion.
8. Add a discovered identifier as an unverified lead. Approve it explicitly, then use **Continue Deep Search** to create only new pivots.
9. Use **History** to inspect persisted waves and search events.

Planning defaults:

- Initial depth: 36 tasks; configurable to 12, 24, 36, 48, or 60.
- Continuation depth: 18 tasks.
- Batch size: 5; configurable to 3, 5, 8, or 10.
- Public records: off.
- Engines: Google, Bing, and DuckDuckGo, rotated rather than multiplying every query across all engines.

The planner favors exact email/phone/username queries and useful two- or three-signal combinations such as name + city, name + employer, and name + school. Reliable public query URLs are opened directly; social platforms generally use `site:` discovery; manual sources open their homepage and display the values to enter.

## Source registry

`src/config/researchSources.ts` remains the source of truth for the Argus research list:

- People Search Engines
- OSINT / Identity Discovery
- Initial Social Sources
- Major Social Media
- Secondary / Niche Social
- Arrest / Public Record
- General Search

Each source records its identifier capabilities, interaction type, priority, login/blocking notes, and enabled state. Public-record and mugshot sources are excluded unless explicitly enabled for the plan; their tasks and saved leads display **Requires independent verification**.

## Browser integration and safety

- Deep Search tabs are opened sequentially in controlled batches and grouped as `POI: Subject Name`.
- Only tabs created or explicitly claimed by the extension are managed.
- Focus, close completed tabs, and close all case tabs never operate on unrelated tabs.
- Tab ownership uses `chrome.storage.session`; it is intentionally not restored after Chrome restarts.
- Cases, plans, leads, and history remain in `chrome.storage.local`; the extension does not reopen searches on startup.
- Context-menu actions support **Add as identifier**, **Save as lead**, **Save finding**, and manual one-off searches.
- Selected identifiers are type-suggested locally. Captured identifiers begin as **Unverified lead** and are never silently upgraded.
- No host permissions, backend, remote AI, telemetry, persistent content script, or external API are used.

## Storage migration

Schema version 2 adds Deep Search settings, source capability metadata, `SearchRun`, structured search history, leads, and the three-state identifier provenance model.

`migrate()` upgrades version-1 workspaces without removing cases, identifiers, findings, candidates, discrepancies, source settings, legacy searches, or activity. Legacy analyst entries become **Analyst supplied**; other unverified values become **Unverified lead**. Unknown or malformed schemas are not overwritten and can be exported through the recovery screen.

Single-case JSON export now uses version 2. Version-1 case exports remain importable.

## Project structure

```text
public/manifest.json
src/
  background/
    serviceWorker.ts       Persisted run execution and browser messages
    contextMenus.ts        Selection capture actions
    tabManager.ts          Session-scoped tab ownership and grouping
  config/
    researchSources.ts     Argus source registry and capabilities
  services/
    deepSearch.ts          Pure deterministic planner and deduplication
    queryBuilder.ts        Safe legacy URL/template helpers and type detection
    storage.ts             Versioned persistence and migration
    exportImport.ts        Case import/export validation
  sidepanel/
    pages/
      CasePage.tsx
      SearchPage.tsx       Deep Search plan, batches, and review
      LeadsPage.tsx
      ComparePage.tsx
      HistoryPage.tsx
      SettingsPage.tsx
  tests/
    deepSearch.test.ts
```

## Verification

```sh
npm run typecheck
npm test
npm run build
```

The test suite covers name/location/employer searches, username social pivots, email searches, normalization and deduplication, repeat suppression, public-record opt-in, disabled sources, task limits, continuation waves, unverified-lead exclusion, version-1 migration, URL safety, comparison logic, and case-safe tab ownership.

### Manual Chrome checklist

Use fictional data only.

1. Create a case with a name, city, employer, and username; prepare a 36-task plan.
2. Confirm the plan can be previewed, toggled, removed, and regenerated without opening tabs.
3. Run a batch and confirm no more than the configured batch size opens in a `POI:` group.
4. Mark tasks reviewed/useful/no-result/blocked, pause/continue, and close completed tabs without touching unrelated tabs.
5. Restart the panel and confirm the run and history remain without tabs reopening.
6. Capture a username from a normal page. Confirm it is an unverified lead and does not expand until changed to Analyst supplied or Verified.
7. Continue Deep Search and confirm the new wave uses the new identifier and omits already searched engine/source/query combinations.
8. Confirm public-record tasks are absent by default, present after opt-in, and visibly marked for independent verification.
9. Save and review a lead; verify no UI labels it as the POI automatically.
10. Test 360, 390, 440, and 500 px side-panel widths in light and dark themes.
11. Export/import the case and confirm runs, history, leads, and identifiers remain intact.

## Keyboard shortcuts

| Action | Default |
| --- | --- |
| Open Research Companion | Alt+Shift+R |
| Capture selected text as a finding | Alt+Shift+F |
| Add selected text as an identifier | Alt+Shift+I |

Chrome shortcuts can be changed at `chrome://extensions/shortcuts`.
