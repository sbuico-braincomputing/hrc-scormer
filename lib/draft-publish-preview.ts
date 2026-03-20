import socialDb from "@/lib/social-db"

type Trainer = {
  name?: string | null
  role?: string | null
  company?: string | null
}

type Module = {
  title?: string | null
  description?: string | null
  video_url?: string | null
  video_document_id?: number | string | null
  document_id?: string | null
  trainers?: Trainer[] | null
}

export type DraftPayload = {
  course_title?: string | null
  course_name?: string | null
  course_description?: string | null
  description?: string | null
  image_url_landscape?: string | null
  category_id?: string | null
  company?: string | null
  course_scorm_file?: string | null
  course_scorm_original_name?: string | null
  duration?: number | string | null
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

export function collectMissingFields(data: DraftPayload): string[] {
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

function extractExtension(filePath: string | null | undefined, fallbackExt: string) {
  if (!filePath) return fallbackExt
  const cleanPath = filePath.split("?")[0].split("#")[0]
  const filename = cleanPath.split("/").pop() ?? ""
  const dotIndex = filename.lastIndexOf(".")
  if (dotIndex <= 0 || dotIndex === filename.length - 1) return fallbackExt
  return filename.slice(dotIndex)
}

function parseDateToCode(dateString: string | null | undefined) {
  if (!dateString) {
    throw new Error("Data mancante per generare il course_code.")
  }

  const isoLikeMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoLikeMatch) {
    return `${isoLikeMatch[1]}${isoLikeMatch[2]}${isoLikeMatch[3]}`
  }

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Data non valida: ${dateString}`)
  }

  const yyyy = String(date.getUTCFullYear())
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(date.getUTCDate()).padStart(2, "0")
  return `${yyyy}${mm}${dd}`
}

function parseCsvPaths(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function toSqlLiteral(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "number") return String(value)
  return `'${value.replaceAll("'", "''")}'`
}

export type PublishPreviewData = {
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

type CodeResolveResult = {
  baseCourseCode: string
  resolvedCourseCode: string
  suffixUsed: number | null
  existingCourseCodes: string[]
}

async function resolveCourseCode(baseCourseCode: string): Promise<CodeResolveResult> {
  const existingRows = await socialDb
    .selectFrom("lms_provider_learning")
    .select("course_code")
    .where((eb) =>
      eb.or([
        eb("course_code", "=", baseCourseCode),
        eb("course_code", "like", `${baseCourseCode}_%`),
      ]),
    )
    .execute()

  const existingCourseCodes = existingRows
    .map((row) => (row.course_code ?? "").trim())
    .filter(Boolean)

  if (!existingCourseCodes.includes(baseCourseCode)) {
    return {
      baseCourseCode,
      resolvedCourseCode: baseCourseCode,
      suffixUsed: null,
      existingCourseCodes,
    }
  }

  let suffix = 1
  while (existingCourseCodes.includes(`${baseCourseCode}_${suffix}`)) {
    suffix += 1
  }

  return {
    baseCourseCode,
    resolvedCourseCode: `${baseCourseCode}_${suffix}`,
    suffixUsed: suffix,
    existingCourseCodes,
  }
}

function normalizeDocumentId(rawValue: unknown): number | null {
  if (rawValue === null || rawValue === undefined) return null
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) return rawValue
  const parsed = Number(String(rawValue).trim())
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function resolveVideoDocumentId(module: Module): number | null {
  const fromField = normalizeDocumentId(module.video_document_id)
  if (fromField !== null) return fromField

  const videoUrl = (module.video_url ?? "").trim()
  if (/^\d+$/.test(videoUrl)) {
    return Number(videoUrl)
  }

  return null
}

function serializeTrainers(trainers: Trainer[] | null | undefined) {
  return JSON.stringify(Array.isArray(trainers) ? trainers : [])
}

export async function buildPublishPreview(
  data: DraftPayload,
): Promise<PublishPreviewData> {
  const startCode = parseDateToCode(data.date_from)
  const endCode = parseDateToCode(data.date_to)
  const baseCourseCode = `ls_${startCode}_${endCode}`
  const resolvedCode = await resolveCourseCode(baseCourseCode)

  const scormExt = extractExtension(
    data.course_scorm_original_name ?? data.course_scorm_file,
    ".zip",
  )
  const imageExt = extractExtension(data.image_url_landscape, ".jpg")

  const scormFilename = `${resolvedCode.resolvedCourseCode}${scormExt}`
  const imageFilename = `${resolvedCode.resolvedCourseCode}${imageExt}`

  const scormPaths = parseCsvPaths(process.env.FTP_SCORM_PATHS)
  const imagePaths = parseCsvPaths(process.env.FTP_IMAGE_PATHS)

  const scormTargets = scormPaths.map((path) => `${path.replace(/\/$/, "")}/${scormFilename}`)
  const imageTargets = imagePaths.map((path) => `${path.replace(/\/$/, "")}/${imageFilename}`)

  const title = (data.course_title ?? data.course_name ?? "").trim()
  const description = (data.course_description ?? data.description ?? "").trim()
  const modules = Array.isArray(data.modules) ? data.modules : []
  const parsedDuration = Number(data.duration)
  const durationMinutes =
    Number.isFinite(parsedDuration) && parsedDuration > 0
      ? Math.round(parsedDuration)
      : 0

  const learningInsert = [
    "INSERT INTO lms_provider_learning (",
    "  course_code,",
    "  course_title,",
    "  course_description,",
    "  duration,",
    "  category_id,",
    "  course_scorm_file,",
    "  course_scorm_available,",
    "  image_url_landscape,",
    "  image_url_square,",
    "  min_perc_complete,",
    "  language",
    ") VALUES (",
    `  ${toSqlLiteral(resolvedCode.resolvedCourseCode)},`,
    `  ${toSqlLiteral(title || null)},`,
    `  ${toSqlLiteral(description || null)},`,
    `  ${toSqlLiteral(durationMinutes)},`,
    `  ${toSqlLiteral(data.category_id ?? null)},`,
    `  ${toSqlLiteral(scormFilename)},`,
    "  '1',",
    `  ${toSqlLiteral(imageFilename)},`,
    `  ${toSqlLiteral(imageFilename)},`,
    "  80,",
    "  'it'",
    ");",
    "SET @new_course_id = LAST_INSERT_ID();",
  ].join("\n")

  const moduleSqlRows: string[] = []
  const scormSqlRows: string[] = []

  modules.forEach((module, index) => {
    const moduleIndex = index + 1
    const moduleVar = `@new_module_id_${moduleIndex}`
    const moduleOrder = String(moduleIndex)
    const trainersJson = serializeTrainers(module.trainers)

    moduleSqlRows.push(
      [
        "INSERT INTO lms_provider_learning_moduli (",
        "  course_id,",
        "  module_title,",
        "  module_description,",
        "  module_order,",
        "  module_trainers",
        "  module_status",
        ") VALUES (",
        "  @new_course_id,",
        `  ${toSqlLiteral((module.title ?? "").trim() || null)},`,
        `  ${toSqlLiteral((module.description ?? "").trim() || null)},`,
        `  ${toSqlLiteral(moduleOrder)},`,
        `  ${toSqlLiteral(trainersJson)},`,
        "  1",
        ");",
        `SET ${moduleVar} = LAST_INSERT_ID();`,
      ].join("\n"),
    )

    const videoDocumentId = resolveVideoDocumentId(module)
    const documentId = normalizeDocumentId(module.document_id)
    if (videoDocumentId !== null && documentId !== null) {
      scormSqlRows.push(
        [
          "INSERT INTO lms_provider_learning_scorm (",
          "  course_id,",
          "  module_id,",
          "  document_id,",
          "  list_order",
          ") VALUES (",
          "  @new_course_id,",
          `  ${moduleVar},`,
          `  ${toSqlLiteral(videoDocumentId)},`,
          "  1",
          ");",
        ].join("\n"),
      )

      scormSqlRows.push(
        [
          "INSERT INTO lms_provider_learning_scorm (",
          "  course_id,",
          "  module_id,",
          "  document_id,",
          "  list_order",
          ") VALUES (",
          "  @new_course_id,",
          `  ${moduleVar},`,
          `  ${toSqlLiteral(documentId)},`,
          "  2",
          ");",
        ].join("\n"),
      )
    } else {
      scormSqlRows.push(`-- Modulo ${moduleIndex}: servono sia video che documento.`)
    }
  })

  const modulesInsert =
    moduleSqlRows.length > 0
      ? moduleSqlRows.join("\n\n")
      : "-- Nessun modulo disponibile da inserire."
  const moduleScormInsert =
    scormSqlRows.length > 0
      ? scormSqlRows.join("\n\n")
      : "-- Nessuna associazione modulo/documento disponibile."

  const fullScript = [
    "BEGIN;",
    "-- 1) Inserimento corso",
    learningInsert,
    "",
    "-- 2) Inserimento moduli",
    modulesInsert,
    "",
    "-- 3) Inserimento associazioni modulo/documento-video",
    moduleScormInsert,
    "",
    "-- COMMIT da eseguire solo dopo esito positivo FTP+DB in fase reale",
    "ROLLBACK;",
  ].join("\n")

  return {
    baseCourseCode: resolvedCode.baseCourseCode,
    resolvedCourseCode: resolvedCode.resolvedCourseCode,
    suffixUsed: resolvedCode.suffixUsed,
    existingCourseCodes: resolvedCode.existingCourseCodes,
    scormOriginalPath: data.course_scorm_file ?? null,
    imageOriginalPath: data.image_url_landscape ?? null,
    scormFilename,
    imageFilename,
    durationMinutes,
    ftpPlan: {
      scormPaths,
      imagePaths,
      scormTargets,
      imageTargets,
    },
    sqlPreview: {
      fullScript,
      learningInsert,
      modulesInsert,
      moduleScormInsert,
    },
  }
}
