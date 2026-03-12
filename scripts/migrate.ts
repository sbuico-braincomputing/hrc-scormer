import db from "@/lib/db";
import { promises as fs } from "fs";
import path from "path";
import { FileMigrationProvider, Migrator } from "kysely";
import 'dotenv/config'

const DATABASE_PREFIX = process.env.DATABASE_PREFIX ?? ''

const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: path.resolve(import.meta.dirname, "../database/migrations"),
    }),
    migrationTableName: `${DATABASE_PREFIX}migrations`,
    migrationLockTableName: `${DATABASE_PREFIX}migrations_lock`,

})

const { error, results } = await migrator.migrateToLatest();

if (error) {
    console.error(error);
    process.exit(1);
}

results?.forEach((it) => {
    if (it.status === 'Success') {
        console.log(`migration "${it.migrationName}" was executed successfully`)
    } else if (it.status === 'Error') {
        console.error(`failed to execute migration "${it.migrationName}"`)
    }
})

if (error) {
    console.error('failed to migrate')
    console.error(error)
    process.exit(1)
}

await db.destroy()
process.exit(0)
