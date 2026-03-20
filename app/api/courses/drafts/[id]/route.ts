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
  created_at: Date
  updated_at: Date
}

function isMissingDeletedAtColumn(error: unknown) {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; sqlMessage?: unknown }
  if (candidate.code === "ER_BAD_FIELD_ERROR") {
    return String(candidate.sqlMessage ?? "").includes("deleted_at")
  }
  return false
}

export async function GET(
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

    let draft: DraftRow | undefined
    try {
      draft = (await (db as any)
        .selectFrom(`${DATABASE_PREFIX}drafts`)
        .select(["id", "data", "created_at", "updated_at"])
        .where("id", "=", numericId)
        .where("deleted_at", "is", null)
        .executeTakeFirst()) as DraftRow | undefined
    } catch (error) {
      if (!isMissingDeletedAtColumn(error)) {
        throw error
      }
      draft = (await (db as any)
        .selectFrom(`${DATABASE_PREFIX}drafts`)
        .select(["id", "data", "created_at", "updated_at"])
        .where("id", "=", numericId)
        .executeTakeFirst()) as DraftRow | undefined
    }

    if (!draft) {
      return NextResponse.json(
        { error: "Bozza non trovata" },
        { status: 404 },
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
      { status: 200 },
    )
  } catch (error) {
    console.error("Error fetching draft", error)

    const isDebug =
      process.env.DEBUG === "TRUE" ||
      process.env.DEBUG === "true" ||
      process.env.DEBUG === "1"

    const payload: Record<string, unknown> = {
      error: "Errore nel recupero della bozza",
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

export async function DELETE(
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

    try {
      await (db as any)
        .updateTable(`${DATABASE_PREFIX}drafts`)
        .set({ deleted_at: new Date() })
        .where("id", "=", numericId)
        .where("deleted_at", "is", null)
        .executeTakeFirst()
    } catch (error) {
      if (!isMissingDeletedAtColumn(error)) {
        throw error
      }
      await (db as any)
        .deleteFrom(`${DATABASE_PREFIX}drafts`)
        .where("id", "=", numericId)
        .executeTakeFirst()
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("Error deleting draft", error)

    const isDebug =
      process.env.DEBUG === "TRUE" ||
      process.env.DEBUG === "true" ||
      process.env.DEBUG === "1"

    const payload: Record<string, unknown> = {
      error: "Errore nella cancellazione della bozza",
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

export async function PUT(
  request: NextRequest,
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

    const body = await request.json()
    const draftData = body ?? {}

    let existingDraft:
      | {
          id: number
        }
      | undefined
    try {
      existingDraft = await (db as any)
        .selectFrom(`${DATABASE_PREFIX}drafts`)
        .select(["id"])
        .where("id", "=", numericId)
        .where("deleted_at", "is", null)
        .executeTakeFirst()
    } catch (error) {
      if (!isMissingDeletedAtColumn(error)) {
        throw error
      }
      existingDraft = await (db as any)
        .selectFrom(`${DATABASE_PREFIX}drafts`)
        .select(["id"])
        .where("id", "=", numericId)
        .executeTakeFirst()
    }

    if (!existingDraft) {
      return NextResponse.json(
        { error: "Bozza non trovata" },
        { status: 404 },
      )
    }

    await (db as any)
      .updateTable(`${DATABASE_PREFIX}drafts`)
      .set({ data: JSON.stringify(draftData) })
      .where("id", "=", numericId)
      .executeTakeFirst()

    return NextResponse.json(
      {
        ...(draftData as Record<string, unknown>),
        id: numericId,
        isDraft: true,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error updating draft", error)

    const isDebug =
      process.env.DEBUG === "TRUE" ||
      process.env.DEBUG === "true" ||
      process.env.DEBUG === "1"

    const payload: Record<string, unknown> = {
      error: "Errore nell'aggiornamento della bozza",
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


