import { NextRequest, NextResponse } from "next/server"

import socialDb from "@/lib/social-db"

export async function GET(_request: NextRequest) {
  try {
    const documents = await socialDb
      .selectFrom("documents")
      .selectAll()
      .execute()

    return NextResponse.json(documents, { status: 200 })
  } catch (error) {
    console.error("Error fetching documents list", error)

    const isDebug =
      process.env.DEBUG === "TRUE" ||
      process.env.DEBUG === "true" ||
      process.env.DEBUG === "1"

    const payload: Record<string, unknown> = {
      error: "Errore nel recupero dei documenti",
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

