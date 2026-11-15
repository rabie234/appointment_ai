"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DAYS,
  normalizeWeek,
  type DayHours,
  type TimeInterval,
} from "@/lib/schedule";
import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/components/i18n/translations";

export function WeekEditor({
  prefix,
  initial,
  closedLabel,
}: {
  prefix: string;
  initial: DayHours[];
  closedLabel?: string;
}) {
  const { language } = useLanguage();

  const translatedClosedLabel = closedLabel
    ? t(language, closedLabel)
    : t(language, "Closed");

  const addRangeLabel =
    language === "ar" ? "إضافة فترة" : "Add time range";
  const removeRangeLabel =
    language === "ar" ? "حذف الفترة" : "Remove time range";

  const [week, setWeek] = useState<DayHours[]>(() => normalizeWeek(initial));

  function updateDay(day: string, update: (entry: DayHours) => DayHours) {
    setWeek((current) =>
      current.map((entry) =>
        entry.day === day ? update(entry) : entry
      )
    );
  }

  function setClosed(day: string, closed: boolean) {
    updateDay(day, (entry) => {
      const intervals = entry.intervals ?? [];

      if (closed) {
        // Keep saved ranges so reopening the day restores them.
        return { ...entry, closed: true, intervals };
      }

      return {
        ...entry,
        closed: false,
        intervals:
          intervals.length > 0
            ? intervals
            : [
                {
                  open: entry.open || "09:00",
                  close: entry.close || "17:00",
                },
              ],
      };
    });
  }

  function updateInterval(
    day: string,
    index: number,
    changes: Partial<TimeInterval>
  ) {
    updateDay(day, (entry) => {
      const intervals = [...(entry.intervals ?? [])];
      const current = intervals[index];

      if (!current) return entry;

      intervals[index] = { ...current, ...changes };

      return {
        ...entry,
        intervals,
        open: intervals[0]?.open ?? entry.open,
        close: intervals[intervals.length - 1]?.close ?? entry.close,
      };
    });
  }

  function addInterval(day: string) {
    updateDay(day, (entry) => ({
      ...entry,
      closed: false,
      intervals: [
        ...(entry.intervals ?? []),
        { open: "", close: "" },
      ],
    }));
  }

  function removeInterval(day: string, removeIndex: number) {
    updateDay(day, (entry) => {
      const intervals = (entry.intervals ?? []).filter(
        (_, index) => index !== removeIndex
      );

      return {
        ...entry,
        intervals,
        open: intervals[0]?.open ?? entry.open,
        close: intervals[intervals.length - 1]?.close ?? entry.close,
      };
    });
  }

  return (
    <div
      className="divide-y rounded-lg border"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      {week.map((entry) => {
        const intervals = entry.intervals ?? [];

        return (
          <div
            key={entry.day}
            className={cn(
              "grid grid-cols-[5.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 px-3 py-2.5",
              entry.closed && "bg-muted/40"
            )}
          >
            <span className="text-sm font-semibold">
              {t(language, entry.day)}
            </span>

            {entry.closed ? (
              <span className="text-sm italic text-muted-foreground">
                {translatedClosedLabel}
              </span>
            ) : (
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {intervals.map((interval, index) => (
                  <div
                    key={`${entry.day}-${index}`}
                    className="flex items-center gap-1"
                  >
                    <Input
                      type="time"
                      value={interval.open}
                      onChange={(event) =>
                        updateInterval(entry.day, index, {
                          open: event.target.value,
                        })
                      }
                      className="h-8 w-28 px-2 text-sm"
                      aria-label={`${t(language, entry.day)} ${index + 1} - ${t(language, "Open")}`}
                    />

                    <span className="text-xs text-muted-foreground">–</span>

                    <Input
                      type="time"
                      value={interval.close}
                      onChange={(event) =>
                        updateInterval(entry.day, index, {
                          close: event.target.value,
                        })
                      }
                      className="h-8 w-28 px-2 text-sm"
                      aria-label={`${t(language, entry.day)} ${index + 1} - ${t(language, "Close")}`}
                    />

                    <button
                      type="button"
                      onClick={() => removeInterval(entry.day, index)}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                      aria-label={`${removeRangeLabel}: ${t(language, entry.day)}`}
                      title={removeRangeLabel}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addInterval(entry.day)}
                  disabled={intervals.length >= 8}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`${addRangeLabel}: ${t(language, entry.day)}`}
                  title={addRangeLabel}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}

            <label className="flex cursor-pointer items-center justify-end gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={entry.closed}
                onChange={(event) =>
                  setClosed(entry.day, event.target.checked)
                }
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              {translatedClosedLabel}
            </label>

            {/* Keep the ranges in FormData, including when the day is Off. */}
            <input
              type="hidden"
              name={`${prefix}-${entry.day}-interval-count`}
              value={intervals.length}
            />

            {intervals.map((interval, index) => (
              <span key={`${entry.day}-fields-${index}`} className="hidden">
                <input
                  type="hidden"
                  name={`${prefix}-${entry.day}-interval-${index}-open`}
                  value={interval.open}
                />
                <input
                  type="hidden"
                  name={`${prefix}-${entry.day}-interval-${index}-close`}
                  value={interval.close}
                />
              </span>
            ))}

            {/* Backwards-compatible one-range fields. */}
            <input
              type="hidden"
              name={`${prefix}-${entry.day}-open`}
              value={entry.open}
            />
            <input
              type="hidden"
              name={`${prefix}-${entry.day}-close`}
              value={entry.close}
            />

            {entry.closed && (
              <input
                type="hidden"
                name={`${prefix}-${entry.day}-off`}
                value="on"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
