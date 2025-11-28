import cron from "node-cron";
import fs from "fs";
import path from "path";
import type { Schedule } from "@/lib/types";

// ダミーデータを JSON で保存している場合の例
const DB_FILE = path.join(process.cwd(), "data/schedules.json");

// 日付チェック用
const todayStr = () => new Date().toISOString().split("T")[0];

// 0時に毎日実行
cron.schedule("0 0 * * *", async () => {
  console.log("[Cron] 過去予定の自動削除開始");

  try {
    if (!fs.existsSync(DB_FILE)) return;

    const raw = fs.readFileSync(DB_FILE, "utf-8");
    let schedules: Schedule[] = JSON.parse(raw);

    const beforeCount = schedules.length;

    // 過去予定を削除（カレンダーには残す設計ならDB上からは削除）
    schedules = schedules.filter((s) => s.date >= todayStr());

    fs.writeFileSync(DB_FILE, JSON.stringify(schedules, null, 2), "utf-8");

    console.log(`[Cron] 完了: ${beforeCount - schedules.length} 件削除`);
  } catch (err) {
    console.error("[Cron] エラー:", err);
  }
});
