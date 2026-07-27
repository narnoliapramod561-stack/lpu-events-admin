// validators.test.ts
// ==================
// Unit Tests for Event Domain Validators

import {
    EventStateValidator,
    EventTitleValidator,
    EventDescriptionValidator,
    EventDatesValidator,
    EventPriceValidator,
} from "../../lib/domain/validators";

describe("Event Validators", () => {
    it("validates event states correctly", () => {
        expect(EventStateValidator.parse("draft")).toEqual("draft");
        expect(() => EventStateValidator.parse("INVALID")).toThrow();
    });

    it("validates event titles correctly", () => {
        expect(EventTitleValidator.parse("Sample Event Title")).toEqual(
            "Sample Event Title"
        );
        expect(() => EventTitleValidator.parse("A")).toThrow(); // Too short
        expect(() => EventTitleValidator.parse("A".repeat(101))).toThrow(); // Too long
    });

    it("validates event descriptions correctly", () => {
        expect(EventDescriptionValidator.parse("This is a valid description.")).toEqual(
            "This is a valid description."
        );
        expect(() => EventDescriptionValidator.parse("Short")).toThrow(); // Too short
        expect(() =>
            EventDescriptionValidator.parse("A".repeat(2001))
        ).toThrow(); // Too long
    });

    it("validates event dates correctly", () => {
        const validDates = {
            start: new Date("2026-01-01"),
            end: new Date("2026-01-02"),
        };
        expect(EventDatesValidator.parse(validDates)).toEqual(validDates);

        const invalidDates = { start: new Date("2026-01-02"), end: new Date("2026-01-01") };
        expect(() => EventDatesValidator.parse(invalidDates)).toThrow();
    });

    it("validates event prices correctly", () => {
        expect(EventPriceValidator.parse(0)).toEqual(0); // Free event
        expect(EventPriceValidator.parse(50.5)).toEqual(50.5); // Valid price
        expect(() => EventPriceValidator.parse(-10)).toThrow(); // Negative price
    });
});