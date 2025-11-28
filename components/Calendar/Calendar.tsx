// components/Calendar/Calendar.tsx
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { Schedule, CalendarDay } from "@/lib/types";
import { generateCalendarDays, getMonthName, getDayName, formatDate } from "@/lib/utils";
import styles from "./Calendar.module.css";
import QuickAddModal from "@/components/Schedule/QuickAddModal";

interface CalendarProps {
  onDayClick?: (date: Date, schedules: Schedule[]) => void;
}

export default function Calendar({ onDayClick }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const searchParams = useSearchParams();
  const [inputYear, setInputYear] = useState<number>(year);
  const [inputMonth, setInputMonth] = useState<number>(month);

  useEffect(() => {
    setInputYear(year);
    setInputMonth(month);
  }, [year, month]);

  useEffect(() => {
    const focus = searchParams?.get?.("focus");
    if (focus) {
      const d = new Date(focus);
      if (!isNaN(d.getTime())) setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [searchParams]);

  // 予定取得
  useEffect(() => {
    fetchSchedules();
  }, [year, month]);

  // カレンダーデータ生成
  useEffect(() => {
    const days = generateCalendarDays(year, month, schedules);
    setCalendarDays(days);
  }, [year, month, schedules]);

  // 通知機能（5分前通知）
  useEffect(() => {
    if (!("Notification" in window)) return;

    Notification.requestPermission().then((permission) => {
      if (permission !== "granted") return;
      const now = new Date();
      schedules.forEach((s) => {
        const scheduleTime = new Date(`${s.date}T${s.startTime}`);
        const diff = scheduleTime.getTime() - now.getTime() - 5 * 60 * 1000;
        if (diff > 0) {
          setTimeout(() => {
            new Notification("予定通知", { body: `${s.startTime} ${s.title}` });
          }, diff);
        }
      });
    });
  }, [schedules]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/schedules?year=${year}&month=${month}`);
      const data = await res.json();
      if (data.success) setSchedules(data.data || []);
      else setError(data.error || "予定の取得に失敗しました");
    } catch (err) {
      setError("予定取得中にエラー");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 2, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month, 1));
  const handleToday = () => setCurrentDate(new Date());
  const handleGotoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const y = Number(inputYear) || year;
    let m = Number(inputMonth) || month;
    if (m < 1) m = 1;
    if (m > 12) m = 12;
    setCurrentDate(new Date(y, m - 1, 1));
  };

  const handleDayClick = (day: CalendarDay) => {
    if (onDayClick) onDayClick(day.date, day.schedules);
  };

  const handleDayDoubleClick = (day: CalendarDay) => {
    setQuickAddDate(day.date);
    setQuickAddOpen(true);
  };

  const handleQuickAddClose = () => {
    setQuickAddOpen(false);
    setQuickAddDate(null);
  };

  const handleQuickAddSaved = async () => {
    handleQuickAddClose();
    await fetchSchedules();
  };

  if (loading) return <div className={styles.loading}>読み込み中...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.navigation}>
          <button className={styles.navButton} onClick={handlePrevMonth}>
            ← 前月
          </button>
          <button className={styles.navButton} onClick={handleNextMonth}>
            次月 →
          </button>
        </div>
        <form className={styles.gotoForm} onSubmit={handleGotoSubmit}>
          <input
            type="number"
            className={styles.gotoInput}
            value={inputYear}
            onChange={(e) => setInputYear(Number(e.target.value || 0))}
          />
          <span>/</span>
          <select
            className={styles.gotoSelect}
            value={inputMonth}
            onChange={(e) => setInputMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button type="submit" className={styles.gotoButton}>
            移動
          </button>
        </form>
        <h2 className={styles.monthTitle}>{getMonthName(year, month)}</h2>
        <button className={styles.todayButton} onClick={handleToday}>
          今日
        </button>
      </div>

      <div className={styles.calendar}>
        <div className={styles.weekDays}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={`${styles.weekDay} ${
                i === 0 ? styles.sunday : i === 6 ? styles.saturday : ""
              }`}
            >
              {getDayName(i)}
            </div>
          ))}
        </div>

        <div className={styles.days}>
          {calendarDays.map((day, index) => {
            const dayOfWeek = day.date.getDay();
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;
            return (
              <div
                key={index}
                className={`${styles.day} ${
                  !day.isCurrentMonth ? styles.otherMonth : ""
                } ${day.isToday ? styles.today : ""} ${
                  isSunday ? styles.sunday : ""
                } ${isSaturday ? styles.saturday : ""}`}
                onClick={() => handleDayClick(day)}
                onDoubleClick={() => handleDayDoubleClick(day)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const data = JSON.parse(
                    e.dataTransfer.getData("text/plain")
                  );
                  const scheduleId = data.scheduleId;
                  const newDate = day.date;
                  try {
                    await fetch(`/api/schedules/${scheduleId}/move`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ date: formatDate(newDate) }),
                    });
                    await fetchSchedules();
                  } catch (err) {
                    console.error(err);
                  }
                }}
              >
                <div className={styles.dayNumber}>{day.date.getDate()}</div>
                <div className={styles.scheduleList}>
                  {/* ★ 修正ポイント：過去予定も含めて表示（フィルタ削除） */}
                  {day.schedules.slice(0, 3).map((schedule) => (
                    <div
                      key={schedule.id}
                      className={styles.scheduleItem}
                      style={{
                        backgroundColor: schedule.color || "#3b82f6",
                      }}
                      title={`${schedule.startTime} ${schedule.title}`}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData(
                          "text/plain",
                          JSON.stringify({
                            scheduleId: schedule.id,
                            oldDate: day.date.toISOString(),
                          })
                        )
                      }
                    >
                      {schedule.startTime} {schedule.title}
                    </div>
                  ))}
                  {day.schedules.length > 3 && (
                    <div className={styles.scheduleCount}>
                      他 {day.schedules.length - 3} 件
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {quickAddOpen && quickAddDate && (
        <QuickAddModal
          initialDate={quickAddDate}
          onClose={handleQuickAddClose}
          onSaved={handleQuickAddSaved}
        />
      )}
    </div>
  );
}
