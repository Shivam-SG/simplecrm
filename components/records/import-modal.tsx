"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import {
  Upload,
  FileJson,
  FileSpreadsheet,
  Table2,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { mutate as globalMutate } from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { SchemaField, FieldType } from "@/lib/schema-detector"

type Step = "drop" | "preview" | "dedup" | "running" | "done"
type ImportFormat = "json" | "csv" | "excel"

const TYPES: FieldType[] = [
  "string",
  "number",
  "boolean",
  "phone",
  "url",
  "email",
  "array",
  "json",
]

type DetectionPayload = {
  detected: { schema: SchemaField[]; titleField: string; dedupField: string }
  hasExistingRecords: boolean
  preview: Record<string, unknown>[]
}

const FORMAT_COPY: Record<
  ImportFormat,
  {
    label: string
  }
> = {
  json: {
    label: "JSON",
  },
  csv: {
    label: "CSV",
  },
  excel: {
    label: "Excel",
  },
}

const ACCEPTED_IMPORT_TYPES =
  "application/json,.json,text/csv,.csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"

function detectImportFormat(file: File): ImportFormat | null {
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()

  if (name.endsWith(".json") || type.includes("json")) return "json"
  if (name.endsWith(".csv") || type.includes("csv")) return "csv"
  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    type.includes("spreadsheet") ||
    type.includes("excel")
  ) {
    return "excel"
  }
  return null
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeRecords(
  arr: unknown[],
  format: ImportFormat
): Record<string, unknown>[] | null {
  const recs = arr
    .filter(isPlainRecord)
    .map((record) =>
      Object.fromEntries(
        Object.entries(record).filter(
          ([key, value]) => key.trim() !== "" && value !== undefined
        )
      )
    )
    .filter((record) =>
      Object.values(record).some(
        (value) => value !== null && value !== undefined && value !== ""
      )
    )

  if (recs.length === 0) {
    toast.error(
      `${FORMAT_COPY[format].label} file must contain rows with columns.`
    )
    return null
  }
  return recs
}

async function parseImportFile(
  file: File
): Promise<{
  records: Record<string, unknown>[]
  format: ImportFormat
} | null> {
  const format = detectImportFormat(file)
  if (!format) {
    toast.error("Unsupported file type. Please upload JSON, CSV, XLS, or XLSX.")
    return null
  }

  if (format === "json") {
    const text = await file.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      toast.error("Could not parse file. Ensure it's valid JSON.")
      return null
    }

    const arr = Array.isArray(parsed)
      ? parsed
      : isPlainRecord(parsed)
        ? [parsed]
        : null
    if (!arr) {
      toast.error("File must contain an object or array of objects.")
      return null
    }
    if (arr.length === 0) {
      toast.error("File contains no records.")
      return null
    }
    const records = normalizeRecords(arr, format)
    return records ? { records, format } : null
  }

  const workbook =
    format === "csv"
      ? XLSX.read(await file.text(), { type: "string", raw: true })
      : XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) {
    toast.error(`${FORMAT_COPY[format].label} file contains no sheets.`)
    return null
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[firstSheet],
    {
      defval: "",
      raw: true,
    }
  )
  const records = normalizeRecords(rows, format)
  return records ? { records, format } : null
}

export function ImportModal({
  open,
  onOpenChange,
  pageId,
  hasExistingRecords,
  onComplete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  pageId: string
  hasExistingRecords: boolean
  onComplete: () => void
}) {
  const [step, setStep] = useState<Step>("drop")
  const [records, setRecords] = useState<Record<string, unknown>[]>([])
  const [fileName, setFileName] = useState<string>("")
  const [detectedFormat, setDetectedFormat] = useState<ImportFormat | null>(
    null
  )
  const [parsing, setParsing] = useState(false)
  const [detection, setDetection] = useState<DetectionPayload | null>(null)
  const [schema, setSchema] = useState<SchemaField[]>([])
  const [titleField, setTitleField] = useState("")
  const [dedupField, setDedupField] = useState("")
  const [mode, setMode] = useState<"new_only" | "upsert">("new_only")
  const [progress, setProgress] = useState(0)
  const [summary, setSummary] = useState<{
    inserted: number
    updated: number
    skipped: number
    newColumns: string[]
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep("drop")
    setRecords([])
    setFileName("")
    setDetectedFormat(null)
    setDetection(null)
    setSchema([])
    setTitleField("")
    setDedupField("")
    setMode("new_only")
    setProgress(0)
    setSummary(null)
    setParsing(false)
  }

  function handleClose(v: boolean) {
    if (!v) reset()
    onOpenChange(v)
  }

  const onFile = useCallback(
    async (file: File) => {
      setParsing(true)
      setFileName(file.name)
      try {
        const parsed = await parseImportFile(file)
        if (!parsed) return
        setDetectedFormat(parsed.format)
        setRecords(parsed.records)

        // Send first 100 to detect-schema
        const sample = parsed.records.slice(0, 100)
        const res = await fetch(`/api/pages/${pageId}/detect-schema`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: sample }),
        })
        if (!res.ok) {
          toast.error("Schema detection failed")
          setParsing(false)
          return
        }
        const data: DetectionPayload = await res.json()
        setDetection(data)
        setSchema(data.detected.schema)
        setTitleField(data.detected.titleField)
        setDedupField(data.detected.dedupField)
        setStep("preview")
      } finally {
        setParsing(false)
      }
    },
    [pageId]
  )

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  async function runImport() {
    setStep("running")
    setProgress(10)
    try {
      const res = await fetch(`/api/pages/${pageId}/records/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records,
          schema,
          titleField,
          dedupField,
          mode,
        }),
      })
      setProgress(80)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error || "Import failed")
        setStep("preview")
        return
      }
      const data = await res.json()
      setSummary(data)
      setProgress(100)
      setStep("done")
      onComplete()
      globalMutate(
        (key) =>
          typeof key === "string" &&
          key.startsWith(`/api/pages/${pageId}/records`)
      )
      globalMutate(`/api/pages/${pageId}/filters`)
      globalMutate("/api/pages")
      globalMutate("/api/pages?starred=1")
    } catch {
      toast.error("Import failed")
      setStep("preview")
    }
  }

  const stringFields = useMemo(
    () =>
      schema.filter(
        (f) => f.type === "string" || f.type === "phone" || f.type === "email"
      ),
    [schema]
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Data</DialogTitle>
          <DialogDescription>
            {step === "drop" &&
              "Drop a JSON, CSV, XLS, or XLSX file to auto-detect its schema."}
            {step === "preview" &&
              "Review detected columns and confirm settings."}
            {step === "dedup" && "Choose how to handle matching records."}
            {step === "running" && "Importing records..."}
            {step === "done" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        {step === "drop" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition hover:bg-accent/30"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_IMPORT_TYPES}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
              }}
            />
            {parsing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Parsing {fileName}...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex size-12 items-center justify-center rounded-full bg-accent">
                  <Upload className="size-6 text-muted-foreground" />
                </div>
                <p className="font-medium">Drop a data file here</p>
                <p className="text-sm text-muted-foreground">
                  JSON, CSV, XLS, or XLSX
                </p>
              </div>
            )}
          </div>
        )}

        {step === "preview" && detection && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              {detectedFormat === "json" && <FileJson className="size-4" />}
              {detectedFormat === "csv" && <Table2 className="size-4" />}
              {detectedFormat === "excel" && (
                <FileSpreadsheet className="size-4" />
              )}
              <span className="font-medium">{fileName}</span>
              {detectedFormat && (
                <Badge variant="outline">
                  {FORMAT_COPY[detectedFormat].label}
                </Badge>
              )}
              <Badge variant="secondary">{records.length} records</Badge>
              <Badge variant="secondary">{schema.length} columns</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Title field
                </label>
                <Select
                  value={titleField || "__none"}
                  onValueChange={(v) => setTitleField(v === "__none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {stringFields.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Dedup field
                </label>
                <Select
                  value={dedupField || "__none"}
                  onValueChange={(v) => setDedupField(v === "__none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None (no dedup)</SelectItem>
                    {schema.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50">
                  <tr className="text-left">
                    <th className="w-8 px-2 py-1"></th>
                    <th className="px-2 py-1">Key</th>
                    <th className="px-2 py-1">Label</th>
                    <th className="w-32 px-2 py-1">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {schema.map((f, i) => (
                    <tr key={f.key} className="border-t">
                      <td className="px-2 py-1">
                        <Checkbox
                          checked={f.visible}
                          onCheckedChange={(v) => {
                            const next = [...schema]
                            next[i] = { ...f, visible: !!v }
                            setSchema(next)
                          }}
                        />
                      </td>
                      <td className="px-2 py-1 font-mono text-xs text-muted-foreground">
                        {f.key}
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          value={f.label}
                          onChange={(e) => {
                            const next = [...schema]
                            next[i] = { ...f, label: e.target.value }
                            setSchema(next)
                          }}
                          className="h-7"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Select
                          value={f.type}
                          onValueChange={(v) => {
                            const next = [...schema]
                            next[i] = { ...f, type: v as FieldType }
                            setSchema(next)
                          }}
                        >
                          <SelectTrigger className="h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === "dedup" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The page already has records. Server-side dedup will run on the{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {dedupField}
              </code>{" "}
              field. Choose what to do with matches:
            </p>
            <div className="space-y-2">
              <button
                onClick={() => setMode("new_only")}
                className={cn(
                  "w-full rounded-md border p-3 text-left hover:bg-accent/30",
                  mode === "new_only" && "border-foreground bg-accent/40"
                )}
              >
                <div className="text-sm font-medium">Import new only</div>
                <div className="text-xs text-muted-foreground">
                  Skip records that already exist. Existing data is unchanged.
                </div>
              </button>
              <button
                onClick={() => setMode("upsert")}
                className={cn(
                  "w-full rounded-md border p-3 text-left hover:bg-accent/30",
                  mode === "upsert" && "border-foreground bg-accent/40"
                )}
              >
                <div className="text-sm font-medium">
                  Import & update existing
                </div>
                <div className="text-xs text-muted-foreground">
                  Insert new records and overwrite data of matching ones.
                </div>
              </button>
            </div>
          </div>
        )}

        {step === "running" && (
          <div className="space-y-3 py-8">
            <Progress value={progress} />
            <p className="text-center text-sm text-muted-foreground">
              Importing {records.length} records...
            </p>
          </div>
        )}

        {step === "done" && summary && (
          <div className="space-y-3 py-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="size-10 text-green-500" />
              <p className="font-medium">Import complete</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border p-3">
                <div className="text-2xl font-semibold">{summary.inserted}</div>
                <div className="text-xs text-muted-foreground">Inserted</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-2xl font-semibold">{summary.updated}</div>
                <div className="text-xs text-muted-foreground">Updated</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-2xl font-semibold">{summary.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
            </div>
            {summary.newColumns.length > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                {summary.newColumns.length} new column
                {summary.newColumns.length === 1 ? "" : "s"} added (hidden by
                default): {summary.newColumns.join(", ")}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "drop" && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("drop")}>
                Back
              </Button>
              <Button
                onClick={() => {
                  if (hasExistingRecords && dedupField) setStep("dedup")
                  else runImport()
                }}
              >
                {hasExistingRecords && dedupField
                  ? "Continue"
                  : `Import ${records.length} records`}
              </Button>
            </>
          )}
          {step === "dedup" && (
            <>
              <Button variant="outline" onClick={() => setStep("preview")}>
                Back
              </Button>
              <Button onClick={runImport}>
                Import {records.length} records
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => handleClose(false)}>
              <X className="size-4" /> Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
