import { db } from "../../prisma/db";

export const RECENT_HISTORY_LIMIT = 30;

export async function countAccessEventsByOutcome(start: Date, end: Date) {
  return db.orm.public.AccessEvent
    .where((e) => e.timestamp.gte(start.toISOString()))
    .where((e) => e.timestamp.lt(end.toISOString()))
    .groupBy("outcome")
    .aggregate((aggregate) => ({ total: aggregate.count() }));
}

export async function findRecentAccessEvents() {
  return db.orm.public.AccessEvent
    .orderBy([(e) => e.timestamp.desc(), (e) => e.id.desc()])
    .limit(RECENT_HISTORY_LIMIT)
    .all();
}
