
import 'dotenv/config';
import 'dotenv-expand/config';

import { DB } from 'kysely-codegen';
import { Kysely, MysqlDialect, MysqlPool } from 'kysely';
import { createPool } from 'mysql2';

const socialDb = new Kysely<DB>({
  dialect: new MysqlDialect({
    pool: createPool(process.env.SOCIAL_DATABASE_URL as string) as unknown as MysqlPool,
  }),
});

export default socialDb;