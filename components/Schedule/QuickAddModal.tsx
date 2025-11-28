"use client";

import { useState } from "react";
import type { Schedule } from "@/lib/types";
import { formatDate, isValidDate, isValidTime, isValidTimeRange } from "@/lib/utils";
import styles from "./QuickAddModal.module.css";

interface QuickAddModalProps {
  initialDate: Date;
  onClose: () => void;
  onSaved: () => void;
  existingSchedule?: Schedule;
}

export default function QuickAddModal({
  initialDate,
  onClose,
  onSaved,
  existingSchedule,
}: QuickAddModalProps) {
  const [title, setTitle] = useState(existingSchedule?.title || "");
  const [date, setDate] = useState(formatDate(initialDate));
  const [startTime, setStartTime] = useState(existingSchedule?.startTime || "09:00");
  const [endTime, setEndTime] = useState(existingSchedule?.endTime || "10:00");
  const [color, setColor] = useState(existingSchedule?.color || "#3b82f6");
  const [repeat, setRepeat] = useState(existingSchedule?.repeat || "none");
  const [notificationMinutes, setNotificationMinutes] = useState(
    existingSchedule?.notificationMinutesBefore || 0
  );

  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    if (!title.trim()) return setError("タイトルを入力してください");
    if (!isValidDate(date)) return setError("日付が正しくありません");
    if (!isValidTime(startTime) || !isValidTime(endTime)) return setError("時間が正しくありません");
    if (!isValidTimeRange(startTime, endTime)) return setError("終了時間は開始時間より後にしてください");

    try {
      const response = await fetch("/api/schedules", {
        method: existingSchedule ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: existingSchedule?.id,
          title,
          date,
          startTime,
          endTime,
          color,
          repeat,
          notificationMinutesBefore: notificationMinutes,
        }),
      });

      const data = await response.json();
      if (data.success) onSaved();
      else setError(data.error || "保存に失敗しました");
    } catch (err) {
      console.error(err);
      setError("保存中にエラーが発生しました");
    }
  };

  const handleDelete = async () => {
    if (!existingSchedule) return;
    if (!confirm("この予定を削除してよろしいですか？")) return;

    try {
      const response = await fetch(`/api/schedules/${existingSchedule.id}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) onSaved();
      else setError(data.error || "削除に失敗しました");
    } catch (err) {
      console.error(err);
      setError("削除中にエラーが発生しました");
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>{existingSchedule ? "予定編集" : "予定追加"}</h3>
        {error && <div className={styles.error}>{error}</div>}

        <label>タイトル</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label>日付</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <label>時間</label>
        <div className={styles.timeRow}>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <span>〜</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>

        <label>色</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />

        <label>繰り返し</label>
        <select value={repeat} onChange={(e) => setRepeat(e.target.value as any)}>
          <option value="none">なし</option>
          <option value="daily">毎日</option>
          <option value="weekly">毎週</option>
          <option value="monthly">毎月</option>
        </select>

        <label>通知（分前）</label>
        <input
          type="number"
          value={notificationMinutes}
          min={0}
          onChange={(e) => setNotificationMinutes(Number(e.target.value))}
        />

        <div className={styles.buttons}>
          <button className={styles.saveButton} onClick={handleSave}>保存</button>
          {existingSchedule && (
            <button className={styles.deleteButton} onClick={handleDelete}>削除</button>
          )}
          <button className={styles.cancelButton} onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}
