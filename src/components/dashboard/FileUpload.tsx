import React, { useCallback, useState } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFile: (file: File, columns: string[], rowCount: number) => void;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFile, disabled }) => {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<{ name: string; columns: string[]; rows: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
        setError("Please upload an Excel file (.xlsx, .xls) or CSV.");
        return;
      }
      try {
        const { parseSourceExcel } = await import("@/lib/excelProcessor");
        const { rows, columnNames } = await parseSourceExcel(file);
        setPreview({ name: file.name, columns: columnNames, rows: rows.length });
        onFile(file, columnNames, rows.length);
      } catch (err) {
        setError(String(err));
      }
    },
    [onFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  return (
    <div className="space-y-4">
      <label
        className={cn(
          "flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200",
          dragging
            ? "border-primary bg-primary/10 glow-border"
            : "border-border hover:border-primary/50 hover:bg-muted/40",
          disabled && "opacity-50 cursor-not-allowed",
          preview && "border-success/50 bg-success/5"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />
        {preview ? (
          <CheckCircle className="w-10 h-10 text-success" />
        ) : (
          <UploadCloud className={cn("w-10 h-10 transition-colors", dragging ? "text-primary" : "text-muted-foreground")} />
        )}
        <div className="text-center">
          {preview ? (
            <>
              <p className="font-semibold text-success">{preview.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {preview.rows} rows detected
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-foreground">
                Drop Excel file here or <span className="text-primary">browse</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                .xlsx · .xls · .csv — Expects columns: 순번, Product
              </p>
            </>
          )}
        </div>
      </label>

      {preview && (
        <div className="panel p-4 animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Detected Columns</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {preview.columns.map((col) => (
              <span
                key={col}
                className="px-2 py-0.5 rounded text-xs font-mono bg-secondary text-secondary-foreground border border-border"
              >
                {col}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            <span className="text-primary font-semibold">{preview.rows}</span> source rows ready for processing
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
