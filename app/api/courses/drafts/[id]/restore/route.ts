import { NextRequest, NextResponse } from "next/server"

import db from "@/lib/db"
import socialDb from "@/lib/social-db"

const DATABASE_PREFIX = process.env.DATABASE_PREFIX ?? ""

type RouteParams = {
  params: Promise<{
    id: string
  }>
}

type DraftRestoreRow = {
  id: number
  published_course_id: number | null
  deleted_at: Date | null
}

function isMissingColumn(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; sqlMessage?: unknown }
  if (candidate.code === "ER_BAD_FIELD_ERROR") {
    return String(candidate.sqlMessage ?? "").includes(columnName)
  }
  return false
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

    let draft: DraftRestoreRow | undefined
    try {
      draft = (await (db as any)
        .selectFrom(`${DATABASE_PREFIX}drafts`)
        .select(["id", "published_course_id", "deleted_at"])
        .where("id", "=", numericId)
        .executeTakeFirst()) as DraftRestoreRow | undefined
    } catch (error) {
      if (
        !isMissingColumn(error, "published_course_id") &&
        !isMissingColumn(error, "deleted_at")
      ) {
        throw error
      }
      return NextResponse.json(
        {
          error:
            "La tabella bozze non supporta ancora il ripristino. Esegui le migration locali.",
        },
        { status: 400 },
      )
    }

    if (!draft) {
      return NextResponse.json(
        { error: "Bozza non trovata" },
        { status: 404 },
      )
    }

    if (!draft.deleted_at) {
      return NextResponse.json(
        { error: "La bozza non risulta pubblicata o eliminata." },
        { status: 409 },
      )
    }

    const publishedCourseId = Number(draft.published_course_id ?? 0)
    if (!publishedCourseId || Number.isNaN(publishedCourseId)) {
      return NextResponse.json(
        { error: "La bozza non è associata a un course_id pubblicato." },
        { status: 409 },
      )
    }

    await socialDb.transaction().execute(async (trx) => {
      await (trx as any)
        .deleteFrom("lms_provider_learning_scorm")
        .where("course_id", "=", publishedCourseId)
        .executeTakeFirst()

      await (trx as any)
        .deleteFrom("lms_provider_learning_moduli")
        .where("course_id", "=", publishedCourseId)
        .executeTakeFirst()

      await (trx as any)
        .deleteFrom("lms_provider_learning")
        .where("course_id", "=", publishedCourseId)
        .executeTakeFirst()
    })

    await (db as any)
      .updateTable(`${DATABASE_PREFIX}drafts`)
      .set({
        deleted_at: null,
        published_course_id: null,
      })
      .where("id", "=", numericId)
      .executeTakeFirst()

    return NextResponse.json(
      {
        success: true,
        message: "Bozza ripristinata e corso rimosso dal sito.",
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error restoring draft", error)

    const isDebug =
      process.env.DEBUG === "TRUE" ||
      process.env.DEBUG === "true" ||
      process.env.DEBUG === "1"

    const payload: Record<string, unknown> = {
      error: "Errore durante il ripristino della bozza",
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
