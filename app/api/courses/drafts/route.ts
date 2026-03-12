import { NextRequest, NextResponse } from "next/server"

import db from "@/lib/db"

const DATABASE_PREFIX = process.env.DATABASE_PREFIX ?? ""

type DraftInsertResult = {
  insertId: number | bigint
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

