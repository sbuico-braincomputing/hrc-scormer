import { NextRequest, NextResponse } from "next/server"

import db from "@/lib/db"

const DATABASE_PREFIX = process.env.DATABASE_PREFIX ?? ""

type RouteParams = {
  params: Promise<{
    id: string
  }>
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

    await (db as any)
      .deleteFrom(`${DATABASE_PREFIX}drafts`)
      .where("id", "=", numericId)
      .executeTakeFirst()

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

