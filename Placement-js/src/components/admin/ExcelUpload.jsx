import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { toast } from "sonner";

const REQUIRED_COLUMNS = ["name", "roll", "email", "branch"];

function sanitizeEmail(email) {
  return email.toLowerCase().replace(/[.#$[\]]/g, "_");
}

function parseRows(sheet) {
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return raw.map((row) => {
    const normalized = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[k.trim().toLowerCase()] = String(v).trim();
    }
    return normalized;
  });
}

export default function ExcelUpload({ onUploaded }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null); // { rows, errors }
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    setDone(false);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = parseRows(sheet);

        const errors = [];
        const valid = [];

        rows.forEach((row, i) => {
          const missing = REQUIRED_COLUMNS.filter((c) => !row[c]);
          if (missing.length > 0) {
            errors.push(`Row ${i + 2}: missing ${missing.join(", ")}`);
          } else if (!row.email.endsWith("@thapar.edu")) {
            errors.push(`Row ${i + 2}: email "${row.email}" is not a @thapar.edu address`);
          } else {
            valid.push(row);
          }
        });

        setPreview({ rows: valid, errors, total: rows.length });
      } catch {
        toast.error("Could not parse the file. Ensure it is a valid .xlsx or .csv.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!preview || preview.rows.length === 0) return;
    setUploading(true);
    try {
      const writes = preview.rows.map((row) => {
        const docId = sanitizeEmail(row.email);
        return setDoc(
          doc(db, "students", docId),
          {
            name: row.name,
            roll: row.roll,
            email: row.email.toLowerCase(),
            branch: row.branch,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });
      await Promise.all(writes);
      toast.success(`${preview.rows.length} student records saved.`);
      setDone(true);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded?.();
    } catch (err) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Upload Student Data</h3>
        <p className="text-xs text-slate-500">
          Upload an Excel (.xlsx) or CSV file with columns:{" "}
          <span className="font-mono text-slate-700">name, roll, email, branch</span>.
          Existing records will be updated by email.
        </p>
      </div>

      {/* Drop zone */}
      {!preview && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 px-6 text-center transition hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          {done ? (
            <>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <p className="text-sm font-medium text-green-700">Upload complete!</p>
              <p className="text-xs text-slate-400">Click or drop another file to upload again.</p>
            </>
          ) : (
            <>
              <div className="rounded-full bg-white p-3 shadow-sm border border-slate-200">
                <Upload className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Drop your file here or <span className="text-blue-600">browse</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">Supports .xlsx and .csv</p>
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,.xls"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-slate-700">
                {preview.rows.length} valid rows of {preview.total} total
              </span>
            </div>
            <button
              onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ""; }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Errors */}
          {preview.errors.length > 0 && (
            <div className="px-4 py-3 border-b border-red-100 bg-red-50">
              <div className="flex items-start gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-red-700">
                  {preview.errors.length} row(s) will be skipped:
                </p>
              </div>
              <ul className="space-y-0.5 pl-6">
                {preview.errors.slice(0, 5).map((e, i) => (
                  <li key={i} className="text-xs text-red-600">{e}</li>
                ))}
                {preview.errors.length > 5 && (
                  <li className="text-xs text-red-400">…and {preview.errors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

          {/* Preview table */}
          {preview.rows.length > 0 && (
            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {REQUIRED_COLUMNS.map((c) => (
                      <th key={c} className="px-4 py-2 text-left font-medium text-slate-500 uppercase tracking-wide">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-700">{row.name}</td>
                      <td className="px-4 py-2 text-slate-700">{row.roll}</td>
                      <td className="px-4 py-2 text-slate-500">{row.email}</td>
                      <td className="px-4 py-2 text-slate-700">{row.branch}</td>
                    </tr>
                  ))}
                  {preview.rows.length > 10 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-xs text-slate-400 text-center">
                        …and {preview.rows.length - 10} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 px-4 py-3 bg-slate-50 border-t border-slate-100">
            <button
              onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ""; }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || preview.rows.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-blue-700 transition"
            >
              {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Upload {preview.rows.length} Records
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
