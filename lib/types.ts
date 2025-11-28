export type Category = "work" | "private" | "event" | "other";

export interface ImageInfo {
  url: string;
  width: number;
  height: number;
}

export interface Schedule {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  description: string;
  category: Category;
  color: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;

  // 追加
  repeat?: "none" | "daily" | "weekly" | "monthly" | "custom";
  repeatEndDate?: string | null;
  customDays?: number[];
  notificationMinutesBefore?: number;
}

export interface ScheduleInput {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  description: string;
  category: Category;
  color: string;
  completed?: boolean;
  sourceImage?: ImageInfo;

  repeat?: "none" | "daily" | "weekly" | "monthly";
  notificationMinutesBefore?: number;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  schedules: Schedule[];
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ↓ ここから追加
export interface CategoryInfo {
  value: Category;
  label: string;
  defaultColor: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { value: "work", label: "仕事", defaultColor: "#3B82F6" },
  { value: "private", label: "プライベート", defaultColor: "#10B981" },
  { value: "event", label: "イベント", defaultColor: "#F59E0B" },
  { value: "other", label: "その他", defaultColor: "#8B5CF6" },
];
