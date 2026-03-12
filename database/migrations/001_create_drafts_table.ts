import { Kysely, sql } from 'kysely'
import 'dotenv/config'

const DATABASE_PREFIX = process.env.DATABASE_PREFIX ?? ''

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable(`${DATABASE_PREFIX}drafts`)
    .addColumn('id', 'bigint', (col) => col.primaryKey().autoIncrement())
    .addColumn('data', 'json', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable(`${DATABASE_PREFIX}drafts`).execute()
}