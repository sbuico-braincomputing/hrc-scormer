"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"

type Trainer = {
  name?: string | null
  role?: string | null
  company?: string | null
}

type Module = {
  title?: string | null
  description?: string | null
  video_url?: string | null
  document_id?: string | null
  trainers?: Trainer[] | null
}

type DraftCourse = {
  id: number
  course_title?: string | null
  course_name?: string | null
  course_description?: string | null
  description?: string | null
  image_url_landscape?: string | null
  category_id?: string | null
  company?: string | null
  course_scorm_file?: string | null
  date_from?: string | null
  date_to?: string | null
  modules?: Module[] | null
}

function isMissing(value: unknown) {
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim().length === 0
  if (typeof value === "number" || typeof value === "boolean") return false
  return String(value).trim().length === 0
}

export default function CourseReviewPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const isDraft = searchParams.get("draft") === "1"
  const courseId = params.id

  const [course, setCourse] = useState<DraftCourse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiMissingFields, setApiMissingFields] = useState<string[]>([])

  useEffect(() => {
    async function loadDraft() {
      if (!courseId) return

      try {
        setIsLoading(true)
        setError(null)

        const res = await fetch(`/api/courses/drafts/${courseId}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          const message =
            typeof data.error === "string"
              ? data.error
              : "Impossibile caricare la bozza"
          throw new Error(message)
        }

        const data = (await res.json()) as DraftCourse
        setCourse(data)
      } catch (err) {
        console.error("Errore caricamento bozza per review", err)
        setError(
          err instanceof Error ? err.message : "Errore nel caricamento della bozza",
        )
      } finally {
        setIsLoading(false)
      }
    }

    if (isDraft) {
      loadDraft()
      return
    }

    setError("La review è disponibile solo per le bozze.")
    setIsLoading(false)
  }, [courseId, isDraft])

  const localMissingFields = useMemo(() => {
    if (!course) return []

    const missing: string[] = []
    const title = (course.course_title ?? course.course_name ?? "").trim()
    const description = (course.course_description ?? course.description ?? "").trim()
    const modules = Array.isArray(course.modules) ? course.modules : []

    if (isMissing(title)) missing.push("Titolo corso")
    if (isMissing(description)) missing.push("Descrizione corso")
    if (isMissing(course.image_url_landscape)) missing.push("Immagine corso")
    if (isMissing(course.category_id)) missing.push("Categoria")
    if (isMissing(course.company)) missing.push("Azienda")
    if (isMissing(course.course_scorm_file)) missing.push("File SCORM")
    if (isMissing(course.date_from)) missing.push("Data inizio")
    if (isMissing(course.date_to)) missing.push("Data fine")
    if (modules.length === 0) missing.push("Almeno un modulo")

    modules.forEach((module, index) => {
      const moduleLabel = `Modulo ${index + 1}`
      if (isMissing(module?.title)) missing.push(`${moduleLabel}: Titolo`)
      if (isMissing(module?.description))
        missing.push(`${moduleLabel}: Descrizione`)
      if (isMissing(module?.video_url)) missing.push(`${moduleLabel}: Video`)
      if (isMissing(module?.document_id))
        missing.push(`${moduleLabel}: Documento associato`)

      const trainers = Array.isArray(module?.trainers) ? module.trainers : []
      if (trainers.length === 0) {
        missing.push(`${moduleLabel}: Almeno un trainer`)
        return
      }

      trainers.forEach((trainer, trainerIndex) => {
        const trainerLabel = `${moduleLabel} - Trainer ${trainerIndex + 1}`
        if (isMissing(trainer?.name)) missing.push(`${trainerLabel}: Nome`)
        if (isMissing(trainer?.role)) missing.push(`${trainerLabel}: Ruolo`)
        if (isMissing(trainer?.company))
          missing.push(`${trainerLabel}: Azienda`)
      })
    })

    return missing
  }, [course])

  async function handlePublish() {
    if (!courseId) return

    try {
      setIsPublishing(true)
      setError(null)
      setApiMissingFields([])

      const res = await fetch(`/api/courses/drafts/${courseId}/publish`, {
        method: "POST",
      })

      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        missingFields?: string[]
        message?: string
      }

      if (!res.ok) {
        if (Array.isArray(data.missingFields)) {
          setApiMissingFields(data.missingFields)
        }
        throw new Error(data.error ?? "Impossibile pubblicare il corso")
      }

      router.push("/courses")
    } catch (err) {
      console.error("Errore pubblicazione bozza", err)
      setError(err instanceof Error ? err.message : "Errore di pubblicazione")
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 lg:px-6">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Review bozza corso
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Controlla i dettagli in sola lettura prima della pubblicazione.
            </p>
          </div>
          {courseId && (
            <Button asChild variant="outline">
              <Link href={`/courses/${courseId}/edit?draft=1`}>Vai a modifica</Link>
            </Button>
          )}
        </header>

        {isLoading && (
          <div className="rounded-lg bg-white p-5 text-sm text-zinc-500 shadow-sm">
            Caricamento bozza...
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!isLoading && course && (
          <>
            {localMissingFields.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Ci sono campi mancanti: completa la bozza prima di procedere alla
                pubblicazione.{" "}
                <Link
                  href={`/courses/${courseId}/edit?draft=1`}
                  className="font-medium underline"
                >
                  Apri la pagina di modifica
                </Link>
                .
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {localMissingFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </div>
            )}

            {apiMissingFields.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                L&apos;API di pubblicazione ha bloccato la richiesta per campi
                mancanti.
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {apiMissingFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </div>
            )}

            <section className="space-y-4 rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">Dettagli corso</h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase text-zinc-500">Titolo</dt>
                  <dd className="text-sm text-zinc-800">
                    {course.course_title ?? course.course_name ?? "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-zinc-500">Categoria</dt>
                  <dd className="text-sm text-zinc-800">{course.category_id ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-zinc-500">Azienda</dt>
                  <dd className="text-sm text-zinc-800">{course.company ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-zinc-500">SCORM</dt>
                  <dd className="text-sm text-zinc-800">{course.course_scorm_file ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-zinc-500">Data inizio</dt>
                  <dd className="text-sm text-zinc-800">{course.date_from ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-zinc-500">Data fine</dt>
                  <dd className="text-sm text-zinc-800">{course.date_to ?? "-"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-zinc-500">
                    Descrizione
                  </dt>
                  <dd className="text-sm text-zinc-800">
                    {course.course_description ?? course.description ?? "-"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="space-y-3 rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">Moduli</h2>
              {(course.modules ?? []).map((module, index) => (
                <article
                  key={index}
                  className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3"
                >
                  <h3 className="text-sm font-semibold">Modulo {index + 1}</h3>
                  <p className="text-sm text-zinc-800">
                    <span className="font-medium">Titolo:</span> {module.title || "-"}
                  </p>
                  <p className="text-sm text-zinc-800">
                    <span className="font-medium">Descrizione:</span>{" "}
                    {module.description || "-"}
                  </p>
                  <p className="text-sm text-zinc-800">
                    <span className="font-medium">Video:</span> {module.video_url || "-"}
                  </p>
                  <p className="text-sm text-zinc-800">
                    <span className="font-medium">Documento:</span>{" "}
                    {module.document_id || "-"}
                  </p>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-zinc-800">Trainer</p>
                    {module.trainers && module.trainers.length > 0 ? (
                      <ul className="list-disc pl-5 text-sm text-zinc-700">
                        {module.trainers.map((trainer, trainerIndex) => (
                          <li key={trainerIndex}>
                            {trainer.name || "-"} - {trainer.role || "-"} (
                            {trainer.company || "-"})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-zinc-600">Nessun trainer</p>
                    )}
                  </div>
                </article>
              ))}
            </section>

            <div className="flex items-center justify-end gap-2">
              <Button asChild variant="outline">
                <Link href={`/courses/${courseId}/edit?draft=1`}>Torna a modifica</Link>
              </Button>
              <Button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing || localMissingFields.length > 0}
              >
                {isPublishing ? "Pubblicazione in corso..." : "Conferma pubblicazione"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
