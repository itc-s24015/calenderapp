// lib/microcms.ts

import { createClient } from "microcms-js-sdk";
import type { Schedule, ScheduleInput } from "./types";
import fs from "fs/promises";
import path from "path";

// If microCMS environment variables are provided, use the real client.
// Otherwise fall back to a simple in-memory store for local development.
const hasMicroCMSEnv =
  !!process.env.MICROCMS_SERVICE_DOMAIN && !!process.env.MICROCMS_API_KEY;

export const client = hasMicroCMSEnv
  ? createClient({
      serviceDomain: process.env.MICROCMS_SERVICE_DOMAIN as string,
      apiKey: process.env.MICROCMS_API_KEY as string,
    })
  : null;

// Data file for local persistence when microCMS is not configured
const DATA_FILE = path.resolve(process.cwd(), "data", "schedules.json");

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch (e) {
    // create empty array file
    await fs.writeFile(DATA_FILE, "[]", "utf8");
  }
}

async function loadStore(): Promise<Schedule[]> {
  try {
    await ensureDataFile();
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw || "[]") as Schedule[];
  } catch (e) {
    console.error("Failed to load local store:", e);
    return [];
  }
}

async function saveStore(store: Schedule[]) {
  try {
    await ensureDataFile();
    await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to save local store:", e);
  }
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 全予定を取得
 */
export async function getSchedules(
  year?: number,
  month?: number
): Promise<Schedule[]> {
  try {
    // If microCMS client is not configured, use in-memory store
    if (!client) {
      const store = await loadStore();
      if (year && month) {
        const prefix = `${year}-${String(month).padStart(2, "0")}`;
        return store.filter((s) => s.date.startsWith(prefix));
      }

      return [...store];
    }

    let filters = "";

    if (year && month) {
      // 指定された月の予定のみを取得
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month).padStart(2, "0")}-31`;
      filters = `date[greater_than]${startDate}[and]date[less_than]${endDate}`;
    }

    // microCMS の返り値は { contents: Schedule[], limit: number, totalCount: number, ... } 形式なので
    // 必要に応じて型を明示しておく
    const response = await client.get<{ contents: Schedule[] }>({
      endpoint: "schedules",
      queries: {
        limit: 100,
        orders: "date",
        ...(filters && { filters }),
      },
    });

    return response.contents;
  } catch (error) {
    console.error("Failed to fetch schedules:", error);
    throw error;
  }
}

/**
 * 特定の予定を取得
 */
export async function getSchedule(id: string): Promise<Schedule> {
  try {
    if (!client) {
      const store = await loadStore();
      const found = store.find((s) => s.id === id);
      if (!found) throw new Error(`Schedule ${id} not found`);
      return found;
    }

    const schedule = await client.get<Schedule>({
      endpoint: "schedules",
      contentId: id,
    });

    return schedule;
  } catch (error) {
    console.error(`Failed to fetch schedule ${id}:`, error);
    throw error;
  }
}

/**
 * 予定を作成
 */
export async function createSchedule(data: ScheduleInput): Promise<Schedule> {
  try {
    if (!client) {
      const store = await loadStore();
      const id = generateId();
      const now = new Date().toISOString();
      const schedule: Schedule = {
        ...data,
        id,
        completed: data.completed ?? false,
        createdAt: now,
        updatedAt: now,
      } as Schedule;
      store.push(schedule);
      await saveStore(store);
      return schedule;
    }

    const response = await client.create({
      endpoint: "schedules",
      content: {
        ...data,
        completed: data.completed ?? false,
      },
    });

    return {
      ...data,
      id: response.id,
      completed: data.completed ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Schedule;
  } catch (error) {
    console.error("Failed to create schedule:", error);
    throw error;
  }
}

/**
 * 予定を更新
 */
export async function updateSchedule(
  id: string,
  data: Partial<ScheduleInput>
): Promise<Schedule> {
  try {
    if (!client) {
      const store = await loadStore();
      const idx = store.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error(`Schedule ${id} not found`);
      const updated = {
        ...store[idx],
        ...data,
        updatedAt: new Date().toISOString(),
      } as Schedule;
      store[idx] = updated;
      await saveStore(store);
      return updated;
    }

    await client.update({
      endpoint: "schedules",
      contentId: id,
      content: data,
    });

    // 更新後のデータを取得
    return await getSchedule(id);
  } catch (error) {
    console.error(`Failed to update schedule ${id}:`, error);
    throw error;
  }
}

/**
 * 予定を削除
 */
export async function deleteSchedule(id: string): Promise<void> {
  try {
    if (!client) {
      const store = await loadStore();
      const idx = store.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error(`Schedule ${id} not found`);
      store.splice(idx, 1);
      await saveStore(store);
      return;
    }

    await client.delete({
      endpoint: "schedules",
      contentId: id,
    });
  } catch (error) {
    console.error(`Failed to delete schedule ${id}:`, error);
    throw error;
  }
}

/**
 * 複数の予定を一括作成
 */
export async function createScheduleBulk(
  schedules: ScheduleInput[]
): Promise<Schedule[]> {
  try {
    // createSchedule already handles microCMS vs in-memory fallback
    const results = await Promise.all(
      schedules.map((schedule) => createSchedule(schedule))
    );
    return results;
  } catch (error) {
    console.error("Failed to create schedules in bulk:", error);
    throw error;
  }
}

/**
 * 日付範囲で予定を取得
 */
export async function getSchedulesByDateRange(
  startDate: string,
  endDate: string
): Promise<Schedule[]> {
  try {
    if (!client) {
      const store = await loadStore();
      return store.filter((s) => s.date > startDate && s.date < endDate);
    }

    const filters = `date[greater_than]${startDate}[and]date[less_than]${endDate}`;

    const response = await client.get<{ contents: Schedule[] }>({
      endpoint: "schedules",
      queries: {
        limit: 100,
        orders: "date",
        filters,
      },
    });

    return response.contents;
  } catch (error) {
    console.error("Failed to fetch schedules by date range:", error);
    throw error;
  }
}
