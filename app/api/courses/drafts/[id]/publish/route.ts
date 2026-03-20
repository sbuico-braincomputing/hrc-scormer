import { NextRequest, NextResponse } from "next/server"

import db from "@/lib/db"

const DATABASE_PREFIX = process.env.DATABASE_PREFIX ?? ""

type RouteParams = {
  params: Promise<{
    id: string
  }>
}

type DraftRow = {
  id: number
  data: unknown
}

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

type DraftPayload = {
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

function collectMissingFields(data: DraftPayload): string[] {
  const missing: string[] = []
  const title = (data.course_title ?? data.course_name ?? "").trim()
  const description = (data.course_description ?? data.description ?? "").trim()
  const modules = Array.isArray(data.modules) ? data.modules : []

  if (isMissing(title)) missing.push("Titolo corso")
  if (isMissing(description)) missing.push("Descrizione corso")
  if (isMissing(data.image_url_landscape)) missing.push("Immagine corso")
  if (isMissing(data.category_id)) missing.push("Categoria")
  if (isMissing(data.company)) missing.push("Azienda")
  if (isMissing(data.course_scorm_file)) missing.push("File SCORM")
  if (isMissing(data.date_from)) missing.push("Data inizio")
  if (isMissing(data.date_to)) missing.push("Data fine")
  if (modules.length === 0) missing.push("Almeno un modulo")

  modules.forEach((module, index) => {
    const moduleLabel = `Modulo ${index + 1}`
    if (isMissing(module?.title)) missing.push(`${moduleLabel}: Titolo`)
    if (isMissing(module?.description)) missing.push(`${moduleLabel}: Descrizione`)
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
      if (isMissing(trainer?.company)) missing.push(`${trainerLabel}: Azienda`)
    })
  })

  return missing
}

export async function POST(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params
    const numericId = Number(id)

    if (!numericId || Number.isNaN(numericId)) {
      return NextResponse.json(
        { error: "ID bozza non valido" },
        { status: 400 },
      )
    }

    const draft = (await (db as any)
      .selectFrom(`${DATABASE_PREFIX}drafts`)
      .select(["id", "data"])
      .where("id", "=", numericId)
      .executeTakeFirst()) as DraftRow | undefined

    if (!draft) {
      return NextResponse.json(
        { error: "Bozza non trovata" },
        { status: 404 },
      )
    }

    const payload =
      typeof draft.data === "string" ? JSON.parse(draft.data) : draft.data

    const missingFields = collectMissingFields((payload ?? {}) as DraftPayload)

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: "Impossibile pubblicare: ci sono campi mancanti.",
          missingFields,
          editUrl: `/courses/${numericId}/edit?draft=1`,
        },
        { status: 400 },
      )
    }

    // Mock di pubblicazione: in questa fase non sincronizziamo ancora verso il DB remoto.
    return NextResponse.json(
      {
        success: true,
        message: "Mock pubblicazione completato con successo.",
        publishedCourseId: numericId,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error publishing draft (mock)", error)

    const isDebug =
      process.env.DEBUG === "TRUE" ||
      process.env.DEBUG === "true" ||
      process.env.DEBUG === "1"

    const payload: Record<string, unknown> = {
      error: "Errore nella pubblicazione della bozza",
    }

    if (isDebug) {
      if (error instanceof Error) {
        payload.message = error.message
        payload.stack = error.stack
      } else {
        payload.details = String(error)
      }
    }

    return NextResponse.json(payload, { status: 500 })
  }
}
