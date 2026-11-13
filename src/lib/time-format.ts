export type TimeLanguage = "en" | "ar";

/** Format stored HH:mm values for people, without changing the stored value. */
export function formatTime12h(
  time: string,
  language: TimeLanguage = "en"
): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return time;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return time;

  const date = new Date(Date.UTC(2020, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat(language === "ar" ? "ar-LB" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date);
}

/** Convert clock values in user-facing text while leaving ISO timestamps alone. */
export function formatTimesInText(
  text: string,
  language: TimeLanguage = "en"
): string {
  return text.replace(
    /(^|[^\dT])((?:[01]?\d|2[0-3]):[0-5]\d)(?!\d)/g,
    (_match, prefix: string, time: string) =>
      `${prefix}${formatTime12h(time, language)}`
  );
}
