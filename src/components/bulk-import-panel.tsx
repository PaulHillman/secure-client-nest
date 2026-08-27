import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { bulkImportStudents, type ImportRow, type ImportResult } from "@/lib/students.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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

/**
 * Extract a section number from any of the common shapes:
 *  "GVMGT331.03.202610.12188" -> 03
 *  "346-01"                    -> 01
 *  "MGT 331 04"                -> 04
 *  "03" / 3                    -> 03
 */
function extractSection(value: string | undefined | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.includes(".")) {
    const parts = raw.split(".");
    if (parts.length >= 2 && /^\d+$/.test(parts[1])) return parts[1].padStart(2, "0");
  }
  const tokens = raw.split(/[^0-9A-Za-z]+/).filter(Boolean);
  const numeric = tokens.filter((t) => /^\d+$/.test(t));
  if (numeric.length === 0) return null;
  // Section is the trailing short number (course numbers are 3+ digits)
  const last = numeric[numeric.length - 1];
  if (last.length <= 2) return last.padStart(2, "0");
  return null;
}

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Fuzzy header match: exact normalized alias first, then substring contains. */
function findCol(headers: string[], aliases: string[]): number {
  const normed = headers.map(norm);
  for (const a of aliases) {
    const t = norm(a);
    const i = normed.indexOf(t);
    if (i >= 0) return i;
  }
  for (const a of aliases) {
    const t = norm(a);
    if (t.length < 4) continue;
    const i = normed.findIndex((h) => h.includes(t) || t.includes(h));
    if (i >= 0) return i;
  }
  return -1;
}

const ALIASES = {
  last: ["last name", "lastname", "lname", "surname", "family name", "last"],
  first: ["first name", "firstname", "fname", "given name", "first"],
  username: ["username", "user name", "netid", "net id", "login", "user id", "userid", "user", "id"],
  studentId: ["student id", "studentid", "g#", "gnumber", "g number", "gnum", "gid", "banner id", "student number"],
  email: ["email", "email address", "eaddr", "emailaddress", "e-mail"],
  section: ["child course id", "child course", "course id", "section", "crn", "course"],
};

/** Read any uploaded file (csv/xlsx/xls) into a matrix of strings. */
async function readSheet(file: File): Promise<string[][]> {
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  if (isCsv) return parseCSV(await file.text());
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
  return matrix.map((r) => (r ?? []).map((c) => String(c ?? "")));
}


export function BulkImportPanel() {
  const qc = useQueryClient();
  const importFn = useServerFn(bulkImportStudents);
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [mapping, setMapping] = useState<{ field: string; column: string }[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const rowKey = (r: ImportRow) => `${r.studentId}|${r.username}`;

  const importMut = useMutation({
    mutationFn: async () =>
      importFn({ data: { rows: rows.filter((r) => selected.has(rowKey(r))) } }),
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
    setMapping([]);
    setFileName(file.name);
    try {
      const parsed = (await readSheet(file)).filter((r) => r.some((c) => c?.trim()));
      if (parsed.length < 2) throw new Error("File has no data rows");

      // Header row is the first row within the first 5 that matches at least 2 known fields
      let headerIdx = 0;
      let best = -1;
      for (let i = 0; i < Math.min(5, parsed.length); i++) {
        const h = parsed[i];
        const score = Object.values(ALIASES).filter((a) => findCol(h, a) >= 0).length;
        if (score > best) { best = score; headerIdx = i; }
      }
      const headers = parsed[headerIdx];

      const iLast = findCol(headers, ALIASES.last);
      const iFirst = findCol(headers, ALIASES.first);
      const iEmail = findCol(headers, ALIASES.email);
      const iSid = findCol(headers, ALIASES.studentId);
      let iUser = findCol(headers, ALIASES.username);
      // Don't let "ID" double as both username and student ID
      if (iUser === iSid) iUser = -1;

      const missing: string[] = [];
      if (iLast < 0) missing.push("Last name");
      if (iFirst < 0) missing.push("First name");
      if (iUser < 0 && iEmail < 0) missing.push("Username or Email");
      if (iSid < 0) missing.push("Student ID (G#)");
      if (missing.length) {
        throw new Error(
          `Could not match column(s): ${missing.join(", ")}. Found headers: ${headers
            .filter(Boolean)
            .join(", ")}`,
        );
      }

      const iCourse = findCol(headers, ALIASES.section);
      const iSectionCol = findCol(headers, ["section"]);

      setMapping(
        [
          ["Last name", iLast],
          ["First name", iFirst],
          ["Username", iUser],
          ["Email", iEmail],
          ["Student ID", iSid],
          ["Section", iSectionCol >= 0 ? iSectionCol : iCourse],
        ]
          .filter(([, i]) => (i as number) >= 0)
          .map(([field, i]) => ({ field: field as string, column: headers[i as number] })),
      );

      const out: ImportRow[] = [];
      for (let r = headerIdx + 1; r < parsed.length; r++) {
        const row = parsed[r];
        if (!row || row.every((c) => !c?.trim())) continue;
        const email = iEmail >= 0 ? (row[iEmail] ?? "").trim() : "";
        let username = iUser >= 0 ? (row[iUser] ?? "").trim() : "";
        if (!username && email.includes("@")) username = email.split("@")[0].trim();
        const studentId = (row[iSid] ?? "").trim();
        if (!username || !studentId) continue;
        const section =
          (iSectionCol >= 0 ? extractSection(row[iSectionCol]) : null) ??
          (iCourse >= 0 ? extractSection(row[iCourse]) : null);
        out.push({
          lastName: (row[iLast] ?? "").trim(),
          firstName: (row[iFirst] ?? "").trim(),
          username,
          studentId,
          section,
        });
      }
      if (out.length === 0) throw new Error("No valid rows found");
      setRows(out);
    } catch (e: any) {
      setParseError(e?.message ?? "Failed to read file");
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
          <div className="flex items-center justify-between">
            <p className="font-medium">CSV format</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                const csv = 'Last Name,First Name,Username,Student ID,Child Course ID\n"Doe","Jane","doej","G02361464","GVMGT331.03.202610.12188"\n"Smith","John","smithj","G02361465","GVMGT331.03.202610.12188"';
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "student_import_template.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3.5 w-3.5" /> Download template
            </Button>
          </div>
          <p className="text-muted-foreground">
            Upload a <b>CSV or Excel</b> file. Column names are matched automatically, so
            variations work: <code>Last Name</code>/<code>Lname</code>,{" "}
            <code>First Name</code>/<code>Fname</code>, <code>Username</code>/<code>ID</code>/
            <code>NetID</code> (or derived from <code>Email</code>), <code>Student ID</code>/
            <code>G#</code>, and <code>Section</code>/<code>Child Course ID</code>.
          </p>
          <p className="text-muted-foreground">
            Section is parsed from any common shape:{" "}
            <code>GVMGT331.<b>03</b>.202610.12188</code>, <code>346-<b>01</b></code>, or{" "}
            <code>MGT 331 <b>04</b></code>.
          </p>
          <p className="text-muted-foreground">
            Each account is created with email <code>username@mail.gvsu.edu</code> and
            initial password set to the <b>Student ID</b> (e.g. <code>G02361464</code>).
          </p>
          <p className="text-xs text-muted-foreground">
            Use the template above for a standard Blackboard download format.
          </p>
        </div>

        <div>
          <Label htmlFor="csv-file">CSV or Excel file</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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

        {mapping.length > 0 && (
          <div className="rounded-md border p-3 text-xs space-y-1">
            <p className="font-medium text-sm">Detected columns</p>
            <div className="flex flex-wrap gap-1.5">
              {mapping.map((m) => (
                <Badge key={m.field} variant="outline">
                  {m.field} ← <code className="ml-1">{m.column}</code>
                </Badge>
              ))}
            </div>
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
