import { describe, it, expect } from "vitest";
import { toast, subscribeToasts, type ToastItem } from "../toast";

describe("toast helper", () => {
  it("pushes toast items to subscribers with correct type and duration", () => {
    const received: ToastItem[] = [];
    const unsubscribe = subscribeToasts((item) => {
      received.push(item);
    });

    toast.success("Saved successfully");
    toast.error("An error occurred");
    toast.warning("Warning message", 2000);
    toast.info("FYI");

    expect(received).toHaveLength(4);
    expect(received[0].type).toBe("success");
    expect(received[0].message).toBe("Saved successfully");
    expect(received[0].duration).toBe(3500);

    expect(received[1].type).toBe("error");
    expect(received[1].message).toBe("An error occurred");
    expect(received[1].duration).toBe(5000);

    expect(received[2].type).toBe("warning");
    expect(received[2].message).toBe("Warning message");
    expect(received[2].duration).toBe(2000);

    expect(received[3].type).toBe("info");
    expect(received[3].message).toBe("FYI");

    unsubscribe();

    // After unsubscribe, listener should not receive new toasts
    toast.info("Should not receive");
    expect(received).toHaveLength(4);
  });

  it("ignores blank or whitespace-only messages", () => {
    const received: ToastItem[] = [];
    const unsubscribe = subscribeToasts((item) => received.push(item));

    toast.success("");
    toast.warning("   ");

    expect(received).toHaveLength(0);
    unsubscribe();
  });
});
