
export function parseCalendarDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

    if (!match) return null

    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])

    if (year < 1 || month < 1 || month > 12 || day < 1) {
        return null
    }

    const isLeapYear =
        year % 4 === 0 &&
        (year % 100 !== 0 || year % 400 === 0)

    const daysInMonth = [
        31,
        isLeapYear ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ]

    if (day > daysInMonth[month - 1]) {
        return null
    }

    const date = new Date(0)
    date.setUTCHours(0, 0, 0, 0)
    date.setUTCFullYear(year, month - 1, day)

    return date
}
