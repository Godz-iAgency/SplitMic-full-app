"use client";

import { useState, useTransition } from "react";
import { adminRunDirectoryImport } from "@/app/admin/directory/actions";
import type { DirectoryImportResult } from "@/lib/directory/import";

/**
 * Runs the CSV import. Dry run first, always — it reports exactly what would
 * change without writing, so the counts can be sanity-checked before any rows
 * are touched.
 */
export function DirectoryImportPanel({ currentTotal }: { currentTotal: number }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<(DirectoryImportResult & { error?: string }) | null>(
    null,
  );
  const [csvText, setCsvText] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  function run(dryRun: boolean) {
    setResult(null);
    startTransition(async () => {
      setResult(await adminRunDirectoryImport({ dryRun, csvText: csvText || undefined }));
    });
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Import from CSV</h2>
          <p className="mt-1 text-sm text-brand-gray-300">
            {currentTotal} {currentTotal === 1 ? "business" : "businesses"} in the
            directory now. Re-importing refreshes scraped details and never
            changes tiers or outreach notes.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => run(true)}
            disabled={pending}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white tappable hover:bg-white/10 disabled:opacity-50"
          >
            {pending ? "Working…" : "Dry run"}
          </button>
          <button
            type="button"
            onClick={() => run(false)}
            disabled={pending}
            className="rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-black tappable hover:bg-brand-orange/90 disabled:opacity-50"
          >
            Import now
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowPaste((v) => !v)}
        className="mt-3 text-xs font-semibold text-brand-gray-400 underline-offset-2 hover:text-white hover:underline"
      >
        {showPaste ? "Hide" : "Paste CSV instead of reading the file"}
      </button>

      {showPaste ? (
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder="Category,Business Name,Email,Website,Notes…"
          className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 p-3 font-mono text-xs text-white placeholder:text-brand-gray-400 focus:border-brand-orange/50 focus:outline-none"
        />
      ) : null}

      {result ? <ImportReport result={result} /> : null}
    </section>
  );
}

function ImportReport({ result }: { result: DirectoryImportResult & { error?: string } }) {
  const categories = Object.entries(result.byCategory ?? {}).filter(([, n]) => n > 0);

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
      {result.error ? (
        <p className="text-sm font-semibold text-red-300">{result.error}</p>
      ) : (
        <p className="text-sm font-semibold text-emerald-300">
          {result.dryRun ? "Dry run — nothing was written." : "Import complete."}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <Stat label="Rows read" value={result.parsed} />
        <Stat label="Importable" value={result.valid} />
        <Stat label="Duplicates in file" value={result.duplicatesInFile} />
        <Stat label="Unmappable" value={result.skippedInvalid} />
        <Stat label="To insert" value={result.toInsert} />
        <Stat label="To update" value={result.toUpdate} />
        <Stat label="Unchanged" value={result.unchanged} />
        {!result.dryRun ? (
          <Stat label="Written" value={result.inserted + result.updated} />
        ) : null}
      </dl>

      {categories.length > 0 ? (
        <p className="text-xs text-brand-gray-400">
          {categories.map(([cat, n]) => `${cat} ${n}`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-brand-gray-400">{label}</dt>
      <dd className="font-bold text-white">{value}</dd>
    </div>
  );
}
