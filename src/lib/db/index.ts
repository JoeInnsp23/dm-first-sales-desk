import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Disable prefetch for migrations
const queryClient = postgres(process.env.DATABASE_URL!, { max: 1 });

export const db = drizzle(queryClient, { schema });

export type DbClient = typeof db;

// Export schema for use in queries
export { schema };
