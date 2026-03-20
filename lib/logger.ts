import { mkdirSync } from "fs"
import path from "path"

import pino from "pino"

let cachedDate = ""
let cachedLogger: pino.Logger | null = null

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function getLogsDir() {
  const dir = path.join(process.cwd(), "logs")
  mkdirSync(dir, { recursive: true })
  return dir
}

function getDailyErrorLogPath() {
  const date = getTodayIsoDate()
  return path.join(getLogsDir(), `errors-${date}.log`)
}

export function getErrorLogger() {
  const today = getTodayIsoDate()
  if (cachedLogger && cachedDate === today) {
    return cachedLogger
  }

  const destination = pino.destination({
    dest: getDailyErrorLogPath(),
    mkdir: true,
    sync: false,
  })

  cachedLogger = pino(
    {
      level: "error",
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  )
  cachedDate = today
  return cachedLogger
}

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    const err = error as Error & {
      code?: unknown
      errno?: unknown
      sqlState?: unknown
      sqlMessage?: unknown
      sql?: unknown
      details?: unknown
      status?: unknown
    }
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage,
      sql: err.sql,
      status: err.status,
      details: err.details,
    }
  }

  return {
    message: String(error),
    raw: error,
  }
}
