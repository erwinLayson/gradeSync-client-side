import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import App from "../App";
import ToastProvider from "../components/Toast";
import { FeatureFlagProvider } from "../context/featureFlagContext";
import { UserContextProvider } from "../context/userContext";
import { invalidateAcademicSettingsCache } from "../hooks/useAcademicSettings";
import { invalidateLandingContentCache } from "../hooks/useLandingContent";
import { invalidateSchoolInfoCache } from "../hooks/useSchoolInfo";

/*
 * Empty-database page smoke test.
 *
 * The only accounts in the database are the developer, admin, and a register
 * staff member. Every other table (students, faculties, classrooms, subjects,
 * school years, enrollments, grades, attendance) is empty.
 *
 * Visiting each admin/developer/register page must settle into its loaded
 * state: the page must stop showing skeletons/spinners and render its empty
 * state. This guards against pages that hang forever on a blank database (for
 * example because a request never resolves or an empty payload is never
 * handled).
 */

const ADMIN = { id: 1, email: "admin@gradesync.test", role: "admin" };
const DEVELOPER = { id: 2, email: "developer@gradesync.test", role: "developer" };
const REGISTER = { id: 3, email: "register@gradesync.test", role: "teacher" };

const apiState = vi.hoisted(() => {
    const emptyDataFor = (url: string): unknown => {
        const path = url.split("?")[0];

        // ---- Object endpoints -------------------------------------------
        if (path === "/dashboard/summary") {
            return {
                schoolYear: null,
                academicQuarter: 1,
                numQuarters: 4,
                enrollmentOpen: true,
                students: 0,
                faculties: 0,
                classrooms: 0,
                averageGrade: null,
                attendanceToday: null,
                newStudentsThisWeek: 0,
                gradedEnrollments: 0,
                enrollmentCount: 0,
                attentionItems: [],
                academicProgress: {
                    gradeSubmission: null,
                    classesWithoutAdviser: 0,
                    incompleteClasses: [],
                },
            };
        }
        if (path === "/analytics") {
            return {
                students: 0,
                faculties: 0,
                classrooms: 0,
                quarter: 1,
                averageGrade: null,
                passingRate: null,
                passingCount: 0,
                gradedEnrollments: 0,
                enrollmentByGrade: [],
                subjectPerformance: [],
                topPerformers: [],
                attendanceTrend: [],
                schoolYearsWithEnrollments: [],
            };
        }
        if (path === "/academic-settings" || path === "/students/current-quarter") {
            return {
                id: 1,
                currentQuarter: 1,
                numQuarters: 4,
                enrollmentOpen: true,
                submissionsLocked: false,
            };
        }
        if (path === "/school-info") {
            return {
                id: 1,
                schoolId: 1,
                name: "Test School",
                district: "Test District",
                division: "Test Division",
                region: "Test Region",
                principal: null,
                address: null,
            };
        }
        if (path === "/school-info/signature") {
            return { signature: null };
        }
        if (path === "/grading-weight-defaults") {
            return {
                writtenWorkWeight: 20,
                performanceTaskWeight: 30,
                quarterlyAssessmentWeight: 50,
                attendanceWeight: 0,
            };
        }
        if (path === "/features") {
            return {
                reports_analytics: true,
                reports_generation: true,
                submission_tracker: true,
            };
        }
        if (path === "/landing-content") {
            // Merged over the client defaults by useLandingContent.
            return {};
        }
        if (path === "/users") {
            // The only accounts that exist.
            return [
                { id: 1, email: "admin@gradesync.test", role: "admin", status: "active" },
                { id: 2, email: "developer@gradesync.test", role: "developer", status: "active" },
                { id: 3, email: "register@gradesync.test", role: "teacher", status: "active" },
            ];
        }
        if (path === "/faculties/by-user/3") {
            return { id: 1, role: "register" };
        }
        if (path === "/students") {
            return { students: [], total: 0 };
        }
        if (path === "/system/wipe/status") {
            return { tables: [] };
        }

        // ---- Collection endpoints (no records) --------------------------
        return [];
    };

    return { user: null as unknown, emptyDataFor };
});

vi.mock("../api/api", () => {
    const ok = (data: unknown) => Promise.resolve({ success: true, message: "ok", data });

    return {
        API: {
            defaults: { baseURL: "http://localhost/api" },
            get: vi.fn(() => Promise.resolve({ data: new Blob() })),
            interceptors: { response: { use: vi.fn() } },
        },
        getAPICall: vi.fn((url: string) => {
            if (url === "/users/verify") {
                return ok(apiState.user);
            }
            return ok(apiState.emptyDataFor(url));
        }),
        postAPICall: vi.fn(() => ok(null)),
        patchAPICall: vi.fn(() => ok(null)),
        putAPICall: vi.fn(() => ok(null)),
        deleteAPICall: vi.fn(() => ok(null)),
        uploadFile: vi.fn(() => ok(null)),
    };
});

function renderAt(route: string, user: typeof ADMIN | typeof DEVELOPER | typeof REGISTER) {
    apiState.user = user;
    window.history.pushState({}, "", route);

    return render(
        <UserContextProvider>
            <FeatureFlagProvider>
                <ToastProvider>
                    <App />
                </ToastProvider>
            </FeatureFlagProvider>
        </UserContextProvider>,
    );
}

/**
 * Waits for the page's loaded marker, then proves no loading affordance is
 * still on screen (a stuck page keeps either `aria-busy` or a skeleton).
 */
async function expectPageLoaded(marker: () => Promise<HTMLElement>) {
    await marker();

    await waitFor(() => {
        expect(document.querySelector('[aria-busy="true"]')).toBeNull();
        expect(document.querySelectorAll(".skeleton__bar")).toHaveLength(0);
    });
}

interface PageCase {
    route: string;
    role: typeof ADMIN | typeof DEVELOPER | typeof REGISTER;
    marker: () => Promise<HTMLElement>;
}

const PAGES: PageCase[] = [
    {
        route: "/admin/dashboard",
        role: ADMIN,
        marker: () => screen.findByText("All caught up"),
    },
    {
        route: "/admin/enrollments",
        role: ADMIN,
        marker: async () => {
            const noYears = await screen.findByText("No school years available");
            expect(screen.queryByText("Loading school years…")).toBeNull();
            await screen.findByText("Select a grade level first.");
            return noYears;
        },
    },
    {
        route: "/admin/students",
        role: ADMIN,
        marker: () => screen.findByText("No students found"),
    },
    {
        route: "/admin/classrooms",
        role: ADMIN,
        marker: () => screen.findByText("No classrooms found"),
    },
    {
        route: "/admin/subjects",
        role: ADMIN,
        marker: () => screen.findByText("No subjects found"),
    },
    {
        route: "/admin/faculties",
        role: ADMIN,
        marker: () => screen.findByText("No faculties found"),
    },
    {
        route: "/admin/analytics-reports",
        role: ADMIN,
        marker: () => screen.findByText("No enrollments recorded for this school year."),
    },
    {
        route: "/admin/reports",
        role: ADMIN,
        marker: () => screen.findByText("Choose a report type"),
    },
    {
        route: "/admin/settings",
        role: ADMIN,
        marker: async () => {
            const schoolId = await screen.findByLabelText("School ID");
            await waitFor(() => expect(schoolId).not.toBeDisabled());
            return schoolId;
        },
    },
    {
        route: "/developer/dashboard",
        role: DEVELOPER,
        marker: () => screen.findByText("Feature Status"),
    },
    {
        route: "/developer/features",
        role: DEVELOPER,
        marker: () => screen.findByText("Feature Management"),
    },
    {
        route: "/developer/landing-content",
        role: DEVELOPER,
        marker: () => screen.findByRole("heading", { name: "Hero" }),
    },
    {
        route: "/developer/users",
        role: DEVELOPER,
        marker: () => screen.findByText("admin@gradesync.test"),
    },
    {
        route: "/developer/data-wipe",
        role: DEVELOPER,
        marker: async () => {
            const refresh = await screen.findByRole("button", { name: "Refresh" });
            await waitFor(() => expect(refresh).not.toBeDisabled());
            return refresh;
        },
    },
    {
        route: "/developer/settings",
        role: DEVELOPER,
        marker: () => screen.findByText("Developer Settings"),
    },
    {
        route: "/register/dashboard",
        role: REGISTER,
        marker: () => screen.findByText("Enrollment open"),
    },
    {
        route: "/register/students",
        role: REGISTER,
        marker: () => screen.findByText("No students found"),
    },
    {
        route: "/register/enrollments",
        role: REGISTER,
        marker: async () => {
            const noYears = await screen.findByText("No school years available");
            expect(screen.queryByText("Loading school years…")).toBeNull();
            return noYears;
        },
    },
    {
        route: "/register/student-records",
        role: REGISTER,
        marker: () => screen.findByText("No classes yet"),
    },
    {
        route: "/register/settings",
        role: REGISTER,
        marker: () => screen.findByText("Developer Settings"),
    },
];

describe("every admin, developer, and register page loads on an otherwise empty database", () => {
    beforeAll(() => {
        // jsdom has no canvas implementation. SignaturePad (admin settings)
        // only needs a 2D context to clear an empty canvas on mount.
        HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
            fillStyle: "",
            clearRect: vi.fn(),
            fillRect: vi.fn(),
        })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

        globalThis.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver;
    });

    beforeEach(() => {
        apiState.user = null;
        localStorage.clear();
        // These hooks cache their fetch at module scope; clear it so each page
        // performs its own request instead of reusing another test's result.
        invalidateAcademicSettingsCache();
        invalidateSchoolInfoCache();
        invalidateLandingContentCache();
    });

    it.each(PAGES)("$route settles out of loading", async ({ route, role, marker }) => {
        renderAt(route, role);
        await expectPageLoaded(marker);
    });
});
