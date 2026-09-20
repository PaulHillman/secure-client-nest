import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, FileWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type ViewerVersion = {
  id: string;
  storage_path: string;
  mime_type: string | null;
};

type DocKind = "pdf" | "docx" | "image" | "text" | "unsupported";

function kindOf(mime: string | null, fileName: string): DocKind {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const m = mime ?? "";
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (
    m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  )
    return "docx";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
    return "image";
  if (m.startsWith("text/") || ["txt", "md", "csv"].includes(ext)) return "text";
  return "unsupported";
}

/**
 * In-app document viewer. Opens a signed URL for the version and renders it
 * on the page: PDFs in the browser's own viewer, Word documents with their
 * formatting intact, images directly, and everything readable as plain text.
 */
export function FileViewerDialog({
  open,
  onOpenChange,
  version,
  fileName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  version: ViewerVersion | null;
  fileName: string;
}) {
  const kind = version ? kindOf(version.mime_type, fileName) : "unsupported";
  const [mode, setMode] = useState<"formatted" | "text">("formatted");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [plainText, setPlainText] = useState<string | null>(null);
  const docHostRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Resolve a short-lived signed URL whenever the dialog opens for a version.
  useEffect(() => {
    if (!open || !version) return;
    let alive = true;
    setError(null);
    setPlainText(null);
    setMode("formatted");
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.storage
        .from("vault")
        .createSignedUrl(version.storage_path, 300);
      if (!alive) return;
      if (error || !data) {
        setError("Could not open this file right now.");
        setLoading(false);
        return;
      }
      setSignedUrl(data.signedUrl);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [open, version?.id, version?.storage_path]);

  // Render the formatted view (PDF iframe, docx renderer, image) or text view.
  useEffect(() => {
    if (!open || !version || !signedUrl) return;
    cleanupRef.current?.();
    cleanupRef.current = null;
    let alive = true;
    const host = docHostRef.current;
    if (!host) return;

    (async () => {
      try {
        if (kind === "image") {
          host.innerHTML = "";
          const img = document.createElement("img");
          img.src = signedUrl;
          img.alt = fileName;
          img.className = "max-w-full max-h-[70vh] mx-auto";
          host.appendChild(img);
          return;
        }

        if (kind === "pdf" && mode === "formatted") {
          setLoading(true);
          const res = await fetch(signedUrl);
          if (!res.ok) throw new Error("fetch failed");
          const pdfjs = await import("pdfjs-dist");
          const workerMod = (await import(
            "pdfjs-dist/build/pdf.worker.min.mjs?url"
          )) as { default: string };
          pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
          const doc = await pdfjs.getDocument({ data: await (await res.blob()).arrayBuffer() }).promise;
          if (!alive || !docHostRef.current) return;
          docHostRef.current.innerHTML = "";
          for (let i = 1; i <= doc.numPages; i++) {
            const pg = await doc.getPage(i);
            const viewport = pg.getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.className = "mx-auto my-3 max-w-full h-auto rounded border shadow-sm";
            docHostRef.current.appendChild(canvas);
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("canvas unavailable");
            await pg.render({ canvas, canvasContext: ctx, viewport }).promise;
            if (!alive) return;
          }
          cleanupRef.current = () => {
            if (docHostRef.current) docHostRef.current.innerHTML = "";
          };
          setLoading(false);
          return;
        }

        // Everything below needs the actual bytes.
        setLoading(true);
        const res = await fetch(signedUrl);
        if (!res.ok) throw new Error("fetch failed");
        const blob = await res.blob();
        if (!alive) return;
        setLoading(false);

        if (kind === "docx") {
          if (mode === "formatted") {
            const { renderAsync } = await import("docx-preview");
            if (!alive || !docHostRef.current) return;
            docHostRef.current.innerHTML = "";
            await renderAsync(blob, docHostRef.current, undefined, {
              className: "docx-preview",
              inWrapper: true,
              ignoreWidth: false,
              breakPages: true,
              useBase64URL: true,
            });
            cleanupRef.current = () => {
              if (docHostRef.current) docHostRef.current.innerHTML = "";
            };
          } else {
            const mammoth = await import("mammoth/mammoth.browser");
            const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
            if (!alive || !docHostRef.current) return;
            docHostRef.current.innerHTML = result.value;
            cleanupRef.current = () => {
              if (docHostRef.current) docHostRef.current.innerHTML = "";
            };
          }
          return;
        }

        if (kind === "pdf" && mode === "text") {
          const pdfjs = await import("pdfjs-dist");
          const workerMod = (await import(
            "pdfjs-dist/build/pdf.worker.min.mjs?url"
          )) as { default: string };
          pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
          const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
          const pages: string[] = [];
          for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            pages.push(
              content.items
                .map((it) => ("str" in it ? it.str : ""))
                .join(" ")
                .replace(/\s+/g, " ")
                .trim(),
            );
          }
          if (!alive) return;
          setPlainText(pages.filter(Boolean).join("\n\n"));
          return;
        }

        if (kind === "text") {
          setPlainText(await blob.text());
          return;
        }
      } catch {
        if (alive) {
          setError("This file could not be displayed. Try downloading it instead.");
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [open, kind, mode, signedUrl, version, fileName]);

  // Revoke any object URLs on close (defensive; not used by current flows).
  useEffect(() => {
    if (!open && objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    }
  }, [open, objectUrl]);

  const canFormat = kind === "pdf" || kind === "docx" || kind === "image";

  const downloadCopy = async () => {
    if (!version) return;
    const { data } = await supabase.storage
      .from("vault")
      .createSignedUrl(version.storage_path, 60, { download: fileName });
    if (data) window.open(data.signedUrl, "_blank");
    else toast.error("Could not generate download link");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display truncate pr-6">{fileName}</DialogTitle>
          <DialogDescription>Reading in the vault — nothing was downloaded.</DialogDescription>
        </DialogHeader>

        {canFormat && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant={mode === "formatted" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMode("formatted");
                setPlainText(null);
                setError(null);
              }}
            >
              Document
            </Button>
            {kind !== "image" && (
              <Button
                variant={mode === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setMode("text");
                  setPlainText(null);
                  setError(null);
                }}
              >
                Plain text
              </Button>
            )}
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={downloadCopy}>
                <Download className="h-3.5 w-3.5 mr-1" /> Download
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border/60 bg-background p-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing the document…
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
              <FileWarning className="h-6 w-6" />
              {error}
              <Button variant="outline" size="sm" onClick={downloadCopy}>
                <Download className="h-3.5 w-3.5 mr-1" /> Download instead
              </Button>
            </div>
          )}
          {!loading && !error && plainText !== null && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed max-w-prose mx-auto">
              {plainText}
            </div>
          )}
          {!loading && !error && kind === "unsupported" && (
            <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
              <FileWarning className="h-6 w-6" />
              This file type can't be previewed here. Download it to open it on your computer.
              <Button variant="outline" size="sm" onClick={downloadCopy}>
                <Download className="h-3.5 w-3.5 mr-1" /> Download
              </Button>
            </div>
          )}
          {!loading && !error && !plainText && kind !== "unsupported" && (
            <div ref={docHostRef} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
