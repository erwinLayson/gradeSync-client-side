import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useTeacherAdvisoryClass, invalidateTeacherAdvisoryClassCache } from "../hooks/useTeacherAdvisoryClass";
import * as api from "../api/api";
import type { User } from "../constant/users";

let mockUser: User | null = null;

vi.mock("../hooks/useUser", () => ({
  useUser: () => ({
    user: mockUser,
    loading: false,
    fetchUser: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe("useTeacherAdvisoryClass", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    invalidateTeacherAdvisoryClassCache();
    mockUser = {
      id: 5,
      email: "teacher@school.edu",
      role: "teacher",
      facultyRole: "teacher",
    };
  });

  it("returns hasAdvisoryClass: true when API returns an advised class", async () => {
    const getAPICallSpy = vi.spyOn(api, "getAPICall").mockResolvedValue({
      data: {
        classroom: { id: 10, section: "Diamond", gradeLevel: 8 },
        facultiesWithSubjects: [],
      },
    } as any);

    const { result } = renderHook(() => useTeacherAdvisoryClass());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getAPICallSpy).toHaveBeenCalledWith("/classrooms/my-advised-class", {
      toast: false,
      skipErrorToast: true,
    });
    expect(result.current.hasAdvisoryClass).toBe(true);
    expect(result.current.advisoryClass?.classroom?.id).toBe(10);
  });

  it("returns hasAdvisoryClass: false when API returns null (teacher has no advisory class)", async () => {
    const getAPICallSpy = vi.spyOn(api, "getAPICall").mockResolvedValue({
      data: null,
    } as any);

    const { result } = renderHook(() => useTeacherAdvisoryClass());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getAPICallSpy).toHaveBeenCalledWith("/classrooms/my-advised-class", {
      toast: false,
      skipErrorToast: true,
    });
    expect(result.current.hasAdvisoryClass).toBe(false);
    expect(result.current.advisoryClass).toBeNull();
  });

  it("returns hasAdvisoryClass: false without calling API when user is not a teaching faculty (e.g. admin)", async () => {
    mockUser = {
      id: 1,
      email: "admin@school.edu",
      role: "admin",
    };

    const getAPICallSpy = vi.spyOn(api, "getAPICall");

    const { result } = renderHook(() => useTeacherAdvisoryClass());

    expect(result.current.loading).toBe(false);
    expect(result.current.hasAdvisoryClass).toBe(false);
    expect(getAPICallSpy).not.toHaveBeenCalled();
  });

  it("caches the result for the same user ID", async () => {
    const getAPICallSpy = vi.spyOn(api, "getAPICall").mockResolvedValue({
      data: {
        classroom: { id: 10, section: "Diamond", gradeLevel: 8 },
      },
    } as any);

    const { result: firstHook } = renderHook(() => useTeacherAdvisoryClass());

    await waitFor(() => {
      expect(firstHook.current.loading).toBe(false);
    });

    expect(getAPICallSpy).toHaveBeenCalledTimes(1);

    // Second hook call should use memory cache
    const { result: secondHook } = renderHook(() => useTeacherAdvisoryClass());
    expect(secondHook.current.loading).toBe(false);
    expect(secondHook.current.hasAdvisoryClass).toBe(true);
    expect(getAPICallSpy).toHaveBeenCalledTimes(1);
  });
});
