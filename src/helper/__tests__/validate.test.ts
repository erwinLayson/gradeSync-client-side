import { describe, it, expect } from "vitest";
import { Validate } from "../validate";
import { subscribeToasts, type ToastItem } from "../toast";

describe("Validate helper", () => {
  it("returns true when all fields have valid non-empty values", () => {
    const data = {
      name: "Juan Dela Cruz",
      age: 20,
      active: true,
      count: 0,
      verified: false,
    };

    const isValid = Validate(data);
    expect(isValid).toBe(true);
  });

  it("returns false and triggers warning toast when a field is empty string or whitespace", () => {
    const toasts: ToastItem[] = [];
    const unsubscribe = subscribeToasts((item) => toasts.push(item));

    const data = {
      username: "user1",
      email: "   ",
    };

    const isValid = Validate(data);
    expect(isValid).toBe(false);
    expect(toasts.length).toBeGreaterThan(0);
    expect(toasts[0].type).toBe("warning");
    expect(toasts[0].message).toContain("Please fill in the email field.");

    unsubscribe();
  });

  it("returns false and triggers warning toast when a field is null or undefined", () => {
    const toasts: ToastItem[] = [];
    const unsubscribe = subscribeToasts((item) => toasts.push(item));

    const dataWithNull = {
      section: null,
    };
    expect(Validate(dataWithNull)).toBe(false);
    expect(toasts[0].message).toContain("Please fill in the section field.");

    toasts.length = 0;
    const dataWithUndefined = {
      schoolYear: undefined,
    };
    expect(Validate(dataWithUndefined)).toBe(false);
    expect(toasts[0].message).toContain("Please fill in the schoolYear field.");

    unsubscribe();
  });

  it("accepts valid falsy values like 0 and false as non-empty", () => {
    const data = {
      zeroValue: 0,
      booleanFalse: false,
    };

    const isValid = Validate(data);
    expect(isValid).toBe(true);
  });
});
