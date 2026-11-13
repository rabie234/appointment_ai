"use client";

import { useState } from "react";
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

  function updateDay(day: string, update: (current: DayHours) => DayHours) {
    setWeek((currentWeek) =>
      currentWeek.map((entry) =>
        entry.day === day ? update(entry) : entry
      )
    );
  }

  function setClosed(day: string, closed: boolean) {
    updateDay(day, (entry) => {
      const currentIntervals = entry.intervals ?? [];

      if (closed) {
        return {
          ...entry,
          closed: true,
          // Keep open/close for the old-format fields and when reopening.
          intervals: [],
        };
      }

      const restoredIntervals =
        currentIntervals.length > 0
          ? currentIntervals
          : [
              {
                open: entry.open || "09:00",
                close: entry.close || "17:00",
              },
            ];

      return {
        ...entry,
        closed: false,
        intervals: restoredIntervals,
      };
    });
  }

  function updateInterval(
    day: string,
    intervalIndex: number,
    changes: Partial<TimeInterval>
  ) {
    updateDay(day, (entry) => {
      const intervals = [...(entry.intervals ?? [])];
      const current = intervals[intervalIndex];

      if (!current) return entry;

      intervals[intervalIndex] = {
        ...current,
        ...changes,
      };

      return {
        ...entry,
        intervals,
        open: intervals[0]?.open ?? entry.open,
        close: intervals[intervals.length - 1]?.close ?? entry.close,
      };
    });
  }

  function addInterval(day: string) {
    updateDay(day, (entry) => {
      const intervals = [...(entry.intervals ?? [])];

      intervals.push({
        open: "",
        close: "",
      });

      return {
        ...entry,
        closed: false,
        intervals,
      };
    });
  }

  function removeInterval(day: string, intervalIndex: number) {
    updateDay(day, (entry) => {
      const intervals = (entry.intervals ?? []).filter(
        (_, index) => index !== intervalIndex
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
              "grid gap-3 px-4 py-3 transition-colors sm:grid-cols-[7rem_minmax(0,1fr)_auto]",
              entry.closed && "bg-muted/40"
            )}
          >
            <span className="pt-2 text-sm font-semibold">
              {t(language, entry.day)}
            </span>

            <div className="min-w-0 space-y-2">
              {entry.closed ? (
                <span className="pt-2 text-sm italic text-muted-foreground">
                  {translatedClosedLabel}
                </span>
              ) : (
                <>
                  {intervals.map((interval, index) => (
                    <div
                      key={`${entry.day}-${index}`}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <Input
                        type="time"
                        value={interval.open}
                        onChange={(event) =>
                          updateInterval(entry.day, index, {
                            open: event.target.value,
                          })
                        }
                        className="h-9 w-32"
                        aria-label={`${t(language, entry.day)} ${index + 1} - ${t(language, "Open")}`}
                      />

                      <span className="text-muted-foreground">–</span>

                      <Input
                        type="time"
                        value={interval.close}
                        onChange={(event) =>
                          updateInterval(entry.day, index, {
                            close: event.target.value,
                          })
                        }
                        className="h-9 w-32"
                        aria-label={`${t(language, entry.day)} ${index + 1} - ${t(language, "Close")}`}
                      />

                      <button
                        type="button"
                        onClick={() => removeInterval(entry.day, index)}
                        className="rounded-md px-2 py-1 text-sm text-destructive hover:bg-destructive/10"
                        aria-label={`${removeRangeLabel}: ${t(language, entry.day)}`}
                        title={removeRangeLabel}
                      >
                        ×
                      </button>

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
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addInterval(entry.day)}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    + {addRangeLabel}
                  </button>
                </>
              )}
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground sm:justify-self-end">
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

            {/* New parser reads the interval count and each interval field. */}
            <input
              type="hidden"
              name={`${prefix}-${entry.day}-interval-count`}
              value={entry.closed ? 0 : intervals.length}
            />

            {/* Keep legacy fields for any older form consumers. */}
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