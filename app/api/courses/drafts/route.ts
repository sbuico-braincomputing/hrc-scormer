import { NextRequest, NextResponse } from "next/server"

import db from "@/lib/db"

const DATABASE_PREFIX = process.env.DATABASE_PREFIX ?? ""

type DraftRow = {
  id: number
  data: unknown
  created_at: Date
  updated_at: Date
  deleted_at?: Date | null
  published_course_id?: number | null
}

type DraftInsertResult = {
  insertId: number | bigint
}

function isMissingColumn(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; sqlMessage?: unknown }
  if (candidate.code === "ER_BAD_FIELD_ERROR") {
    return String(candidate.sqlMessage ?? "").includes(columnName)
  }
  return false
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim().toLowerCase() ?? ""
    const includeDeleted = searchParams.get("includeDeleted") === "1"

    let draftRows: DraftRow[]
    try {
      const query = (db as any)
        .selectFrom(`${DATABASE_PREFIX}drafts`)
        .select([
          "id",
          "data",
          "created_at",
          "updated_at",
          "deleted_at",
          "published_course_id",
        ])
        .orderBy("created_at", "desc")
      draftRows = (await (includeDeleted
        ? query
        : query.where("deleted_at", "is", null)
      ).execute()) as DraftRow[]
    } catch (error) {
      const missingDeletedAt = isMissingColumn(error, "deleted_at")
      const missingPublishedCourseId = isMissingColumn(error, "published_course_id")
      if (!missingDeletedAt && !missingPublishedCourseId) {
        throw error
      }

      // Compatibilita con schemi DB parzialmente aggiornati:
      // - se manca solo published_course_id, filtriamo comunque deleted_at
      // - se manca anche deleted_at, non possiamo distinguere bozze cancellate
      const fallbackQuery = (db as any)
        .selectFrom(`${DATABASE_PREFIX}drafts`)
        .select(["id", "data", "created_at", "updated_at"])
        .orderBy("created_at", "desc")

      draftRows = (await (missingDeletedAt || includeDeleted
        ? fallbackQuery
        : fallbackQuery.where("deleted_at", "is", null)
      ).execute()) as DraftRow[]
    }

    const parsedDrafts = draftRows.map((row) => {
      const data =
        typeof row.data === "string" ? JSON.parse(row.data) : row.data

      return {
        ...(data as Record<string, unknown>),
        id: row.id,
        isDraft: true,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at ?? null,
        published_course_id: row.published_course_id ?? null,
      }
    })

    const filteredDrafts =
      q.length === 0
        ? parsedDrafts
        : parsedDrafts.filter((draft) => {
            const draftRecord = draft as Record<string, unknown>

            const searchableFields = [
              draftRecord.course_title,
              draftRecord.course_name,
              draftRecord.course_description,
              draftRecord.description,
            ]
              .filter(Boolean)
              .map((value) => String(value).toLowerCase())

            const query = q.toLowerCase()

            return searchableFields.some((value) => value.includes(query))
          })

    return NextResponse.json(
      {
        items: filteredDrafts,
        totalCount: filteredDrafts.length,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error fetching drafts list", error)

    const isDebug =
      process.env.DEBUG === "TRUE" ||
      process.env.DEBUG === "true" ||
      process.env.DEBUG === "1"

    const payload: Record<string, unknown> = {
      error: "Errore nel recupero delle bozze",
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const draftData = body ?? {}

    const insertResult = (await (db as any)
      .insertInto(`${DATABASE_PREFIX}drafts`)
      .values({
        data: JSON.stringify(draftData),
      })
      .executeTakeFirst()) as DraftInsertResult | undefined

    const insertId = insertResult?.insertId

    if (!insertId) {
      return NextResponse.json(
        { error: "Impossibile creare la bozza" },
        { status: 500 },
      )
    }

    const draft = await (db as any)
      .selectFrom(`${DATABASE_PREFIX}drafts`)
      .select(["id", "data", "created_at", "updated_at"])
      .where("id", "=", Number(insertId))
      .executeTakeFirst()

    if (!draft) {
      return NextResponse.json(
        { error: "Bozza creata ma non trovata" },
        { status: 500 },
      )
    }

    const data =
      typeof draft.data === "string"
        ? JSON.parse(draft.data)
        : draft.data

    return NextResponse.json(
      {
        ...(data as Record<string, unknown>),
        id: draft.id,
        isDraft: true,
        created_at: draft.created_at,
        updated_at: draft.updated_at,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error creating draft", error)

    const isDebug =
      process.env.DEBUG === "TRUE" ||
      process.env.DEBUG === "true" ||
      process.env.DEBUG === "1"

    const payload: Record<string, unknown> = {
      error: "Errore nella creazione della bozza",
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

