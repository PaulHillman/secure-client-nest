import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { bulkImportStudents, type ImportRow, type ImportResult } from "@/lib/students.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";

/** Minimal CSV parser supporting quoted fields and embedded commas. */
function parseCSV(text: string): string[][] {
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else cell += c;
    }
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Extract section like "03" from "GVMGT331.03.202610.12188". */
function extractSection(courseId: string | undefined): string | null {
  if (!courseId) return null;
  const parts = courseId.split(".");
  if (parts.length >= 2 && /^\d+$/.test(parts[1])) return parts[1];
  return null;
}

function findCol(headers: string[], ...names: string[]): number {
  const norm = headers.map((h) => h.trim().toLowerCase());
  for (const n of names) {
    const i = norm.indexOf(n.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

export function BulkImportPanel() {
  const qc = useQueryClient();
  const importFn = useServerFn(bulkImportStudents);
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importMut = useMutation({
    mutationFn: async () => importFn({ data: { rows } }),
    onSuccess: (r) => {
      setResult(r);
      toast.success(`Imported ${r.created} accounts`);
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Import failed"),
  });

  const onFile = async (file: File) => {
    setParseError(null);
    setResult(null);
    setRows([]);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.length < 2) throw new Error("CSV has no data rows");
      const headers = parsed[0];
      const iLast = findCol(headers, "Last Name", "lastname", "last");
      const iFirst = findCol(headers, "First Name", "firstname", "first");
      const iUser = findCol(headers, "Username", "user", "login");
      const iSid = findCol(headers, "Student ID", "studentid", "id");
      const iCourse = findCol(headers, "Child Course ID", "course id", "course");

      const missing: string[] = [];
      if (iLast < 0) missing.push("Last Name");
      if (iFirst < 0) missing.push("First Name");
      if (iUser < 0) missing.push("Username");
      if (iSid < 0) missing.push("Student ID");
      if (missing.length) throw new Error(`Missing required column(s): ${missing.join(", ")}`);

      const out: ImportRow[] = [];
      for (let r = 1; r < parsed.length; r++) {
        const row = parsed[r];
        if (!row || row.every((c) => !c?.trim())) continue;
        const username = (row[iUser] ?? "").trim();
        const studentId = (row[iSid] ?? "").trim();
        if (!username || !studentId) continue;
        out.push({
          lastName: (row[iLast] ?? "").trim(),
          firstName: (row[iFirst] ?? "").trim(),
          username,
          studentId,
          section: iCourse >= 0 ? extractSection(row[iCourse]) : null,
        });
      }
      if (out.length === 0) throw new Error("No valid rows found");
      setRows(out);
    } catch (e: any) {
      setParseError(e?.message ?? "Failed to parse CSV");
    }
  };

  const previewRows = useMemo(() => rows.slice(0, 10), [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl flex items-center gap-2">
          <Upload className="h-5 w-5 text-gold" /> Bulk import students
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-dashed p-4 text-sm space-y-2">
          <p className="font-medium">CSV format</p>
          <p className="text-muted-foreground">
            Required columns: <code>Last Name</code>, <code>First Name</code>,{" "}
            <code>Username</code>, <code>Student ID</code>. Optional:{" "}
            <code>Child Course ID</code> (section parsed from second segment, e.g.{" "}
            <code>GVMGT331.<b>03</b>.202610.12188</code> → section <b>03</b>).
          </p>
          <p className="text-muted-foreground">
            Each account is created with email <code>username@mail.gvsu.edu</code> and
            initial password set to the <b>Student ID</b> (e.g. <code>G02361464</code>).
          </p>
        </div>

        <div>
          <Label htmlFor="csv-file">CSV file</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          {fileName && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <FileSpreadsheet className="h-3 w-3" /> {fileName}
            </p>
          )}
        </div>

        {parseError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <span>{parseError}</span>
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                Parsed <b>{rows.length}</b> row{rows.length === 1 ? "" : "s"}.
                {previewRows.length < rows.length && (
                  <span className="text-muted-foreground"> Showing first 10.</span>
                )}
              </p>
              <Button
                onClick={() => importMut.mutate()}
                disabled={importMut.isPending}
              >
                {importMut.isPending ? "Importing…" : `Create ${rows.length} accounts`}
              </Button>
            </div>

            <div className="overflow-x-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-2">Name</th>
                    <th className="p-2">Email (derived)</th>
                    <th className="p-2">Initial password</th>
                    <th className="p-2">Section</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.firstName} {r.lastName}</td>
                      <td className="p-2 font-mono">{r.username}@mail.gvsu.edu</td>
                      <td className="p-2 font-mono">{r.studentId}</td>
                      <td className="p-2">{r.section ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-md border p-3 text-sm space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Import complete
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-emerald-500/10">
                Created: {result.created}
              </Badge>
              <Badge variant="outline" className="bg-amber-500/10">
                Skipped (already existed): {result.skipped.length}
              </Badge>
              <Badge variant="outline" className="bg-destructive/10">
                Errors: {result.errors.length}
              </Badge>
            </div>
            {result.skipped.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  View skipped ({result.skipped.length})
                </summary>
                <ul className="mt-1 text-xs space-y-0.5 max-h-40 overflow-y-auto">
                  {result.skipped.map((s, i) => (
                    <li key={i}><code>{s.email}</code> — {s.reason}</li>
                  ))}
                </ul>
              </details>
            )}
            {result.errors.length > 0 && (
              <details open>
                <summary className="cursor-pointer text-xs text-destructive">
                  View errors ({result.errors.length})
                </summary>
                <ul className="mt-1 text-xs space-y-0.5 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <li key={i}><code>{e.email}</code> — {e.error}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
