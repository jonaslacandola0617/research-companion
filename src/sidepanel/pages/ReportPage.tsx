import { useState } from "react";
import { Clipboard, Download, FileText, Printer } from "lucide-react";
import { useWorkspace } from "../workspace";
import { buildReport } from "../../services/reportBuilder";
import { download, serializeCase } from "../../services/exportImport";

export function ReportPage() {
  const { c, state, run, notify } = useWorkspace();
  const [generated, setGenerated] = useState(false);
  if (!c) return null;

  const markdown = buildReport(c, state.settings.sources);
  const plain = buildReport(c, state.settings.sources, false);
  const reviewed = Object.values(c.checklist).filter((item) => item.status !== "not_checked").length;
  const unresolved = c.discrepancies.filter((d) => d.status === "Unresolved").length;

  return (
    <>
      <div className="page-title compact-title report-title">
        <span className="eyebrow">REPORT</span>
        <h1>Research summary.</h1>
        <p>Bring the evidence, uncertainty, and analyst decisions into one readable view.</p>
      </div>

      <div className="report-metrics" aria-label="Case summary metrics">
        <div>
          <strong>{reviewed}</strong>
          <span>Sources reviewed</span>
        </div>
        <div>
          <strong>{c.findings.length}</strong>
          <span>Findings</span>
        </div>
        <div>
          <strong>{c.candidates.length}</strong>
          <span>Candidates</span>
        </div>
        <div className={unresolved ? "metric-warning" : ""}>
          <strong>{unresolved}</strong>
          <span>Open discrepancies</span>
        </div>
      </div>

      {!generated ? (
        <section className="report-generate-panel">
          <div>
            <span className="eyebrow">READY WHEN YOU ARE</span>
            <h2>Generate the current summary.</h2>
            <p>
              The report is built locally from saved case details, findings, candidate assessments,
              discrepancies, and source progress.
            </p>
          </div>
          <button className="primary full" onClick={() => setGenerated(true)}>
            <FileText size={16} />
            Generate summary
          </button>
        </section>
      ) : (
        <>
          <section className="report-document-section">
            <div className="report-document-heading">
              <div>
                <span className="eyebrow">GENERATED SUMMARY</span>
                <h2>{c.subjectName}</h2>
              </div>
              <button className="text-button" onClick={() => setGenerated(false)}>
                Hide
              </button>
            </div>
            <pre className="report-preview warm-report-preview">{plain}</pre>
          </section>

          <section className="report-actions report-controls">
            <span className="eyebrow">USE OR EXPORT</span>
            <div className="report-action-list">
              <button
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(plain);
                    notify("Plain text report copied.");
                  })
                }
              >
                <Clipboard size={15} />
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
                <Clipboard size={15} />
                Copy Markdown
              </button>
              <button onClick={() => download("research-summary.md", markdown, "text/markdown")}>
                <Download size={15} />
                Download Markdown
              </button>
              <button onClick={() => window.print()}>
                <Printer size={15} />
                Print / Save PDF
              </button>
              <button onClick={() => download("research-case.json", serializeCase(c))}>
                <Download size={15} />
                Export case JSON
              </button>
            </div>
            <p className="hint">
              Update case notes, findings, discrepancies, or candidate rationales and regenerate to reflect the latest saved records.
            </p>
          </section>
        </>
      )}
    </>
  );
}
