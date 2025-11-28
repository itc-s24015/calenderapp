import { NextResponse } from "next/server";
import type { Schedule } from "@/lib/types";

// ダミーデータベース（本番はDBに置き換え）
let schedules: Schedule[] = [
  // 例:
  // { id: 1, title: "会議", date: "2025-11-01", startTime: "09:00", endTime: "10:00", color: "#FF0000" },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  if (!year || !month) {
    return NextResponse.json({ success: false, error: "year, monthが必要です" });
  }

  // カレンダーに表示するために「過去予定は削除してカレンダーには残す」
  const todayStr = new Date().toISOString().split("T")[0];

  const filtered = schedules.filter((s) => s.date >= todayStr);

  // 月表示用にその月の予定も取得
  const monthStr = (m: number) => (m < 10 ? `0${m}` : `${m}`);
  const monthStart = `${year}-${monthStr(month)}-01`;
  const monthEnd = `${year}-${monthStr(month)}-${new Date(year, month, 0).getDate()}`;

  const monthSchedules = schedules.filter(
    (s) => s.date >= monthStart && s.date <= monthEnd
  );

  return NextResponse.json({ success: true, data: monthSchedules });
}

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.title || !body.date) {
    return NextResponse.json({ success: false, error: "title, date が必要です" });
  }
const newSchedule: Schedule = {
  id: schedules.length
    ? String(Number(schedules[schedules.length - 1].id) + 1)
    : "1",
  title: body.title,
  date: body.date,
  startTime: body.startTime || "09:00",
  endTime: body.endTime || "10:00",
  color: body.color || "#00AAFF",
  description: body.description || "",
  category: body.category || "other",
  completed: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),

  // 追加プロパティ
  repeat: body.repeat || "none",
  repeatEndDate: body.repeatEndDate || null,
  customDays: body.customDays || [],
  notificationMinutesBefore: body.notificationMinutesBefore || 0,
};


  schedules.push(newSchedule);

  return NextResponse.json({ success: true, data: newSchedule });
}
