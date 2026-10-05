import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index.ts";

export function createDb(connectionString: string) {
  return drizzle({
    connection: { connectionString },
    schema,
  });
}

export type Database = ReturnType<typeof createDb>;
