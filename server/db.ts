import { and, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  conversations,
  files,
  InsertUser,
  messages,
  usage,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  } else {
    values.lastSignedIn = new Date();
    updateSet.lastSignedIn = new Date();
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listUserConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt));
}

export async function getUserConversation(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId))).limit(1);
  return result[0];
}

export async function getConversationMessages(userId: number, conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(and(eq(messages.userId, userId), eq(messages.conversationId, conversationId))).orderBy(messages.createdAt);
}

export async function searchUserConversations(userId: number, query: string) {
  const db = await getDb();
  if (!db) return [];
  const pattern = `%${query}%`;
  const matchingConversationIds = await db
    .select({ conversationId: messages.conversationId })
    .from(messages)
    .where(and(eq(messages.userId, userId), like(messages.content, pattern)))
    .groupBy(messages.conversationId);
  const ids = matchingConversationIds.map(item => item.conversationId);
  const titleMatches = await db.select().from(conversations).where(and(eq(conversations.userId, userId), like(conversations.title, pattern))).orderBy(desc(conversations.updatedAt));
  if (ids.length === 0) return titleMatches;
  const messageMatches = await Promise.all(ids.map(id => getUserConversation(userId, id)));
  const merged = [...titleMatches, ...messageMatches.filter(Boolean)];
  return merged.filter((item, index, list) => list.findIndex(other => other?.id === item?.id) === index);
}

export async function createConversation(userId: number, title: string, mode: "chat" | "search" | "study" | "coding" | "analyze" | "creative", model: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(conversations).values({ userId, title, mode, model });
  const id = Number(result[0].insertId);
  return getUserConversation(userId, id);
}

export async function touchConversation(conversationId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
}

export async function insertMessage(values: typeof messages.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(messages).values(values);
  return Number(result[0].insertId);
}

export async function renameConversation(userId: number, id: number, title: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(conversations).set({ title: title.trim().slice(0, 255), updatedAt: new Date() }).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  return getUserConversation(userId, id);
}

export async function deleteConversation(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.delete(messages).where(and(eq(messages.conversationId, id), eq(messages.userId, userId)));
  await db.delete(files).where(and(eq(files.conversationId, id), eq(files.userId, userId)));
  await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

export async function insertFile(values: typeof files.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.insert(files).values(values);
  return Number(result[0].insertId);
}

export async function insertUsage(values: typeof usage.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(usage).values(values);
}
