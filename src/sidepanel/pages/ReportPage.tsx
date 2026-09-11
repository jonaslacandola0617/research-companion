import { useWorkspace } from "../workspace";
import { buildReport } from "../../services/reportBuilder";
import { download, serializeCase } from "../../services/exportImport";
export function ReportPage() {
  const { c, state, run, notify } = useWorkspace();
  if (!c) return null;
  const markdown = buildReport(c, state.settings.sources);
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">ASSESS & REPORT</span>
        <h1>Make the reasoning clear.</h1>
        <p>A structured summary of your evidence and assessments.</p>
      </div>
      <div className="button-grid report-controls">
        <button
          onClick={() =>
            void run(async () => {
              await navigator.clipboard.writeText(
                buildReport(c, state.settings.sources, false),
              );
              notify("Plain text report copied.");
            })
          }
        >
          Copy plain text
        </button>
        <button
          onClick={() =>
            void run(async () => {
              await navigator.clipboard.writeText(markdown);
              notify("Markdown report copied.");
            })
          }
        >
          Copy Markdown
        </button>
        <button onClick={() => window.print()}>Print</button>
        <button
          onClick={() => download("research-case.json", serializeCase(c))}
        >
          Export case JSON
        </button>
        <button
          onClick={() =>
            download("research-summary.md", markdown, "text/markdown")
          }
        >
          Download Markdown
        </button>
      </div>
      <p className="hint report-controls">
        Generated from saved records. Edit findings, case notes, or candidate
        rationales to update this report.
      </p>
      <pre className="report-preview">
        {buildReport(c, state.settings.sources, false)}
      </pre>
    </>
  );
}
