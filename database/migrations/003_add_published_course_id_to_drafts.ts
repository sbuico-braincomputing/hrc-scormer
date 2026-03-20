import { Kysely } from "kysely"

import "dotenv/config"

const DATABASE_PREFIX = process.env.DATABASE_PREFIX ?? ""

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable(`${DATABASE_PREFIX}drafts`)
    .addColumn("published_course_id", "bigint")
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable(`${DATABASE_PREFIX}drafts`)
    .dropColumn("published_course_id")
    .execute()
}
