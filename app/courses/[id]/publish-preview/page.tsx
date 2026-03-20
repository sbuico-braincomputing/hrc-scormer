"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"

type PreviewPayload = {
  draftId: number
  mode: "preview-only"
  preview: {
    baseCourseCode: string
    resolvedCourseCode: string
    suffixUsed: number | null
    existingCourseCodes: string[]
    scormOriginalPath: string | null
    imageOriginalPath: string | null
    scormFilename: string
    imageFilename: string
    durationMinutes: number
    ftpPlan: {
      scormPaths: string[]
      imagePaths: string[]
      scormTargets: string[]
      imageTargets: string[]
    }
    sqlPreview: {
      fullScript: string
      learningInsert: string
      modulesInsert: string
      moduleScormInsert: string
    }
  }
}

export default function PublishPreviewPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const isDraft = searchParams.get("draft") === "1"

  const [data, setData] = useState<PreviewPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missingFields, setMissingFields] = useState<string[]>([])

  useEffect(() => {
    async function loadPreview() {
      if (!params.id) return

      try {
        setIsLoading(true)
        setError(null)
        setMissingFields([])

        const res = await fetch(`/api/courses/drafts/${params.id}/publish`)
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string
          missingFields?: string[]
          preview?: PreviewPayload["preview"]
          mode?: "preview-only"
          draftId?: number
        }

        if (!res.ok) {
          if (Array.isArray(payload.missingFields)) {
            setMissingFields(payload.missingFields)
          }
          throw new Error(payload.error ?? "Impossibile generare l'anteprima")
        }

        if (!payload.preview || payload.mode !== "preview-only") {
          throw new Error("Risposta anteprima non valida")
        }

        setData({
          draftId: payload.draftId ?? Number(params.id),
          mode: "preview-only",
          preview: payload.preview,
        })
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Errore durante la generazione dell'anteprima",
        )
      } finally {
        setIsLoading(false)
      }
    }

    if (!isDraft) {
      setError("La pagina è disponibile solo per le bozze.")
      setIsLoading(false)
      return
    }

    loadPreview()
  }, [isDraft, params.id])

  return (
    <div className="min-h-screen bg-zinc-50 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 lg:px-6">
        <header className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Anteprima pubblicazione bozza
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Nessuna operazione viene eseguita: visualizzi solo SQL e target FTP.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild type="button" variant="outline">
              <Link href={`/courses/${params.id}/review?draft=1`}>Torna alla review</Link>
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/courses">Torna alla lista corsi</Link>
            </Button>
          </div>
        </header>

        {isLoading && (
          <div className="rounded-lg bg-white p-5 text-sm text-zinc-500 shadow-sm">
            Generazione anteprima in corso...
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            {missingFields.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs">
                {missingFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!isLoading && data && (
          <>
            <section className="space-y-3 rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">Naming file</h2>
              <div className="space-y-1 text-sm text-zinc-700">
                <p>
                  <strong>course_code base:</strong>{" "}
                  <code>{data.preview.baseCourseCode}</code>
                </p>
                <p>
                  <strong>course_code risolto:</strong>{" "}
                  <code>{data.preview.resolvedCourseCode}</code>
                </p>
                <p>
                  <strong>Suffisso applicato:</strong>{" "}
                  {data.preview.suffixUsed === null ? "nessuno" : `_${data.preview.suffixUsed}`}
                </p>
                <p>
                  <strong>SCORM finale:</strong> <code>{data.preview.scormFilename}</code>
                </p>
                <p>
                  <strong>Immagine finale:</strong> <code>{data.preview.imageFilename}</code>
                </p>
                <p>
                  <strong>Durata totale video:</strong>{" "}
                  {data.preview.durationMinutes} min
                </p>
              </div>
              {data.preview.existingCourseCodes.length > 0 && (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                  <p className="font-medium">course_code già presenti a DB:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {data.preview.existingCourseCodes.map((code) => (
                      <li key={code}>
                        <code>{code}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">Piano upload FTP</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-zinc-800">Target SCORM</h3>
                  {data.preview.ftpPlan.scormTargets.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-700">
                      Nessun percorso configurato in <code>FTP_SCORM_PATHS</code>.
                    </p>
                  ) : (
                    <ul className="mt-1 list-disc pl-5 text-xs text-zinc-700">
                      {data.preview.ftpPlan.scormTargets.map((target) => (
                        <li key={target}>
                          <code>{target}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-zinc-800">Target immagine</h3>
                  {data.preview.ftpPlan.imageTargets.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-700">
                      Nessun percorso configurato in <code>FTP_IMAGE_PATHS</code>.
                    </p>
                  ) : (
                    <ul className="mt-1 list-disc pl-5 text-xs text-zinc-700">
                      {data.preview.ftpPlan.imageTargets.map((target) => (
                        <li key={target}>
                          <code>{target}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">
                SQL inserimento corso
              </h2>
              <pre className="overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-100">
                {data.preview.sqlPreview.learningInsert}
              </pre>
            </section>

            <section className="space-y-3 rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">
                SQL inserimento moduli
              </h2>
              <pre className="overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-100">
                {data.preview.sqlPreview.modulesInsert}
              </pre>
            </section>

            <section className="space-y-3 rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">
                SQL associazioni modulo/documento-video
              </h2>
              <pre className="overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-100">
                {data.preview.sqlPreview.moduleScormInsert}
              </pre>
            </section>

            <section className="space-y-3 rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">
                Script completo (preview)
              </h2>
              <pre className="overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-100">
                {data.preview.sqlPreview.fullScript}
              </pre>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
