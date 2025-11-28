import { NextResponse } from "next/server";
import type { Schedule } from "@/lib/types";

// ダミーデータ（JSON 版）
import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "data/schedules.json");

export async function POST() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return NextResponse.json({ success: false, error: "DBが存在しません" });
    }

    const raw = fs.readFileSync(DB_FILE, "utf-8");
    let schedules: Schedule[] = JSON.parse(raw);

const todayStr = new Date().toISOString().split("T")[0];
    const beforeCount = schedules.length;
schedules = schedules.filter((s) => s.date >= todayStr); // () は不要
    fs.writeFileSync(DB_FILE, JSON.stringify(schedules, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      deletedCount: beforeCount - schedules.length,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: "削除中にエラー" });
  }
}
