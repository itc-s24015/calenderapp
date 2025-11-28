// lib/utils.ts
import type { CalendarDay, Schedule } from "./types";

/**
 * 月のカレンダーデータを生成
 * - schedulesには繰り返し予定も含む
 * - 過去予定は一覧から削除されるがカレンダーには表示
 */
export function generateCalendarDays(
  year: number,
  month: number,
  schedules: Schedule[]
): CalendarDay[] {
  const days: CalendarDay[] = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 月の最初の週の前の月の日付を追加
  const firstDayOfWeek = firstDay.getDay();
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 2, prevMonthLastDay - i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: false,
      schedules: getSchedulesForDate(date, schedules, today),
    });
  }

  // 当月の日付を追加
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month - 1, day);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    days.push({
      date,
      isCurrentMonth: true,
      isToday: dateOnly.getTime() === today.getTime(),
      schedules: getSchedulesForDate(date, schedules, today),
    });
  }

  // 月の最後の週の次の月の日付を追加
  const remainingDays = 7 - (days.length % 7);
  if (remainingDays < 7) {
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month, day);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        schedules: getSchedulesForDate(date, schedules, today),
      });
    }
  }

  return days;
}

/**
 * 指定日付の予定を取得
 * - 過去予定は一覧には表示されない
 * - 繰り返し予定も展開
 */
export function getSchedulesForDate(
  date: Date,
  schedules: Schedule[],
  today: Date
): Schedule[] {
  return schedules
    .filter((schedule) => {
      const scheduleDate = parseDate(schedule.date);

      // 過去予定は一覧に含めない
      if (scheduleDate < today) return false;

      // 繰り返し予定の判定
      if (schedule.repeat && schedule.repeat !== "none") {
        return isRepeatScheduleOnDate(schedule, date);
      }

      // 通常予定は当日のみ
      return schedule.date === formatDate(date);
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * 繰り返し予定が指定日に発生するか判定
 */
function isRepeatScheduleOnDate(schedule: Schedule, date: Date): boolean {
  const startDate = parseDate(schedule.date);
  const dayOfWeek = date.getDay();

  switch (schedule.repeat) {
    case "daily":
      return startDate <= date;
    case "weekly":
      return startDate <= date && startDate.getDay() === dayOfWeek;
    case "monthly":
      return startDate <= date && startDate.getDate() === date.getDate();
    case "custom":
      return startDate <= date && schedule.customDays?.includes(dayOfWeek) === true;
    default:
      return false;
  }
}

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 日付文字列をDateオブジェクトに変換
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 時間をHH:mm形式にフォーマット
 */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * 日付と時間を結合してDateオブジェクトを作成
 */
export function combineDateAndTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

/**
 * 月の表示名を取得
 */
export function getMonthName(year: number, month: number): string {
  return `${year}年${month}月`;
}

/**
 * 曜日名を取得
 */
export function getDayName(dayIndex: number): string {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return days[dayIndex];
}

/**
 * HEXカラーの明度を判定（テキスト色を決定するため）
 */
export function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
}

/**
 * ファイルをBase64に変換
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Base64からmimeTypeを抽出
 */
export function getMimeTypeFromBase64(base64: string): string {
  const match = base64.match(/data:([^;]+);/);
  return match ? match[1] : "image/jpeg";
}

/**
 * Base64からデータ部分のみを抽出
 */
export function getBase64Data(base64: string): string {
  return base64.split(",")[1] || base64;
}

/**
 * バリデーション: 日付が有効か
 */
export function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const date = parseDate(dateStr);
  return !isNaN(date.getTime());
}

/**
 * バリデーション: 時間が有効か
 */
export function isValidTime(timeStr: string): boolean {
  const regex = /^\d{2}:\d{2}$/;
  if (!regex.test(timeStr)) return false;

  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
}

/**
 * バリデーション: 終了時間が開始時間より後か
 */
export function isValidTimeRange(startTime: string, endTime: string): boolean {
  return startTime < endTime;
}
