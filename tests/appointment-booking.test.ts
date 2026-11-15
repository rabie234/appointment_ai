
import assert from "node:assert/strict"
import { test } from "node:test"
import { parseCalendarDate } from "../src/lib/date-validation"

test("accepts a valid calendar date", () => {
    const result = parseCalendarDate("2026-11-15")

    assert.ok(result instanceof Date)
    assert.equal(result.toISOString(), "2026-11-15T00:00:00.000Z")
})

test("rejects February 31", () => {
    assert.equal(parseCalendarDate("2027-02-31"), null)
})

test("accepts February 29 in a leap year", () => {
    assert.ok(parseCalendarDate("2028-02-29"))
})

test("rejects February 29 in a non-leap year", () => {
    assert.equal(parseCalendarDate("2027-02-29"), null)
})

test("rejects April 31", () => {
    assert.equal(parseCalendarDate("2026-04-31"), null)
})

test("rejects an invalid month", () => {
    assert.equal(parseCalendarDate("2026-13-10"), null)
})

test("rejects an invalid date format", () => {
    assert.equal(parseCalendarDate("15/11/2026"), null)
})
