import { Kysely } from "kysely"

import "dotenv/config"

const DATABASE_PREFIX = process.env.DATABASE_PREFIX ?? ""

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable(`${DATABASE_PREFIX}drafts`)
    .addColumn("deleted_at", "timestamp")
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable(`${DATABASE_PREFIX}drafts`)
    .dropColumn("deleted_at")
    .execute()
}
