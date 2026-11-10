import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AdminClassrooms from "../pages/admin/AdminClassrooms";
import { toast } from "../helper/toast";

const api = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
}));

vi.mock("../api/api", () => ({
    API: {
        defaults: { baseURL: "http://localhost/api" },
        get: vi.fn(),
        interceptors: { response: { use: vi.fn() } },
    },
    getAPICall: api.get,
    postAPICall: api.post,
    putAPICall: api.put,
    patchAPICall: api.patch,
    deleteAPICall: api.del,
}));

vi.mock("../helper/toast", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

const mockClassroomsList = [
    {
        id: 10,
        section: "Rizal",
        gradeLevel: 10,
        totalStudent: 2,
        adviserId: 50,
        adviserFullname: "Juan Dela Cruz",
        status: "active",
    },
    {
        id: 11,
        section: "Bonifacio",
        gradeLevel: 10,
        totalStudent: 0,
        adviserId: null,
        adviserFullname: null,
        status: "active",
    },
];

const mockClassroomDetail = {
    id: 10,
    section: "Rizal",
    gradeLevel: 10,
    totalStudent: 2,
    adviserId: 50,
    adviserFullname: "Juan Dela Cruz",
    status: "active",
    students: [
        {
            enrollmentId: 101,
            studentId: 201,
            studentLrn: "123456789012",
            studentEmail: "maria.santos@test.local",
            fullname: "Maria Santos",
            studentBirthdate: "2008-05-12",
            studentAge: 16,
            studentSex: "Female",
        },
        {
            enrollmentId: 102,
            studentId: 202,
            studentLrn: "123456789013",
            studentEmail: "juan.luna@test.local",
            fullname: "Juan Luna",
            studentBirthdate: "2008-08-20",
            studentAge: 16,
            studentSex: "Male",
        },
    ],
};

const mockSubjectsNotInClass = [
    {
        subjectId: 101,
        subjectName: "Mathematics 10",
        subjectCode: "MATH10",
        subjectUnit: 4,
        faculties: [
            { facultyId: 50, facultyFullname: "Juan Dela Cruz" },
            { facultyId: 51, facultyFullname: "Ana Reyes" },
        ],
    },
    {
        subjectId: 102,
        subjectName: "Science 10",
        subjectCode: "SCI10",
        subjectUnit: 4,
        faculties: [
            { facultyId: 50, facultyFullname: "Juan Dela Cruz" },
            { facultyId: 52, facultyFullname: "Pedro Penduko" },
        ],
    },
    {
        subjectId: 103,
        subjectName: "English 10",
        subjectCode: "ENG10",
        subjectUnit: 3,
        faculties: [
            { facultyId: 51, facultyFullname: "Ana Reyes" },
            { facultyId: 53, facultyFullname: "Clara Santos" },
        ],
    },
];

describe("AdminClassrooms - Multiple Subject & Same Teacher Assignment", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        api.get.mockImplementation(async (url: string) => {
            if (url === "/classrooms") {
                return { data: mockClassroomsList };
            }
            if (url === "/class/10/students") {
                return { data: mockClassroomDetail };
            }
            if (url === "/classrooms/10/faculties-subject") {
                return { data: [] };
            }
            if (url === "/subjects/classrooms/10/faculties") {
                return { data: mockSubjectsNotInClass };
            }
            return { data: [] };
        });

        api.post.mockResolvedValue({ data: null, success: true });
        api.put.mockResolvedValue({ data: null, success: true });
        api.patch.mockResolvedValue({ data: null, success: true });
        api.del.mockResolvedValue({ data: null, success: true });
    });

    async function navigateToClassroomSubjectsTab(user: ReturnType<typeof userEvent.setup>) {
        render(<AdminClassrooms />);

        // 1. Wait for Grade 10 card and select Grade 10
        const gradeCard = await screen.findByRole("button", {
            name: "View classrooms for Grade 10",
        });
        await user.click(gradeCard);

        // 2. Select classroom section "Rizal"
        const classroomCard = await screen.findByRole("heading", { name: "Rizal" });
        await user.click(classroomCard);

        // 3. Switch to "Subject" tab
        const subjectTab = await screen.findByRole("tab", { name: /Subject/i });
        await user.click(subjectTab);

        // 4. Verify "Add Subjects" button appears
        const addSubjectsBtn = await screen.findByRole("button", { name: "Add Subjects" });
        return { addSubjectsBtn };
    }

    it("scenario: adds multiple subjects to classroom with the same teacher assigned to both", async () => {
        const user = userEvent.setup();
        const { addSubjectsBtn } = await navigateToClassroomSubjectsTab(user);

        // Step 1: Open the "Add Subjects" modal
        await user.click(addSubjectsBtn);

        await screen.findByRole("heading", { name: "New Subject" });
        expect(api.get).toHaveBeenCalledWith("/subjects/classrooms/10/faculties");

        // Step 2: Select first subject (Mathematics 10)
        const mathCheckbox = screen.getByLabelText(/Mathematics 10/i);
        expect(mathCheckbox).not.toBeChecked();
        await user.click(mathCheckbox);
        expect(mathCheckbox).toBeChecked();

        // Step 3: Assign teacher Juan Dela Cruz to Mathematics 10
        const mathJuanRadio = await screen.findByRole("radio", {
            name: /Juan Dela Cruz/i,
        });
        await user.click(mathJuanRadio);
        expect(mathJuanRadio).toBeChecked();

        // Step 4: Select second subject (Science 10)
        const scienceCheckbox = screen.getByLabelText(/Science 10/i);
        expect(scienceCheckbox).not.toBeChecked();
        await user.click(scienceCheckbox);
        expect(scienceCheckbox).toBeChecked();

        // Step 5: Assign the SAME teacher (Juan Dela Cruz) to Science 10
        // Find all radio buttons labeled "Juan Dela Cruz" and click the one for Science
        const juanRadios = screen.getAllByRole("radio", { name: /Juan Dela Cruz/i });
        expect(juanRadios).toHaveLength(2); // One under Math, one under Science
        await user.click(juanRadios[1]);
        expect(juanRadios[1]).toBeChecked();

        // Step 6: Verify assigning Juan to Science did NOT uncheck or overwrite Math assignment
        expect(juanRadios[0]).toBeChecked();
        expect(mathCheckbox).toBeChecked();
        expect(scienceCheckbox).toBeChecked();

        // Prepare updated mock for reload after save
        const savedAssignedSubjects = [
            {
                classSubjectId: 501,
                facultyId: 50,
                facultyFullname: "Juan Dela Cruz",
                unit: 4,
                code: "MATH10",
                subjectId: 101,
                subjectName: "Mathematics 10",
            },
            {
                classSubjectId: 502,
                facultyId: 50,
                facultyFullname: "Juan Dela Cruz",
                unit: 4,
                code: "SCI10",
                subjectId: 102,
                subjectName: "Science 10",
            },
        ];

        api.get.mockImplementation(async (url: string) => {
            if (url === "/classrooms/10/faculties-subject") {
                return { data: savedAssignedSubjects };
            }
            if (url === "/classrooms") {
                return { data: mockClassroomsList };
            }
            if (url === "/class/10/students") {
                return { data: mockClassroomDetail };
            }
            return { data: [] };
        });

        // Step 7: Submit the assignments
        const submitBtn = screen.getByRole("button", { name: "Create Subject" });
        await user.click(submitBtn);

        // Step 8: Verify POST API call contains both subjects mapped to the same teacher
        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
        const [postUrl, postPayload] = api.post.mock.calls[0];
        expect(postUrl).toBe("/classrooms/subjects");
        expect(postPayload).toEqual({
            newSubjects: [
                { classId: 10, subjectId: 101, facultyId: 50 },
                { classId: 10, subjectId: 102, facultyId: 50 },
            ],
        });

        // Step 9: Verify both subjects are displayed in the subject table under Juan Dela Cruz
        await waitFor(() => {
            expect(screen.getByText("Mathematics 10")).toBeInTheDocument();
            expect(screen.getByText("Science 10")).toBeInTheDocument();
        });

        const rows = screen.getAllByRole("row");
        // Row 0 is header, rows 1 & 2 are subjects
        expect(rows.length).toBeGreaterThanOrEqual(3);

        const tableText = screen.getByRole("table").textContent;
        expect(tableText).toContain("Mathematics 10");
        expect(tableText).toContain("Science 10");
        expect(tableText).toContain("Juan Dela Cruz");
    });

    it("verifies persistence when reloading/re-entering the classroom subjects page", async () => {
        const user = userEvent.setup();

        const persistedSubjects = [
            {
                classSubjectId: 501,
                facultyId: 50,
                facultyFullname: "Juan Dela Cruz",
                unit: 4,
                code: "MATH10",
                subjectId: 101,
                subjectName: "Mathematics 10",
            },
            {
                classSubjectId: 502,
                facultyId: 50,
                facultyFullname: "Juan Dela Cruz",
                unit: 4,
                code: "SCI10",
                subjectId: 102,
                subjectName: "Science 10",
            },
        ];

        api.get.mockImplementation(async (url: string) => {
            if (url === "/classrooms") return { data: mockClassroomsList };
            if (url === "/class/10/students") return { data: mockClassroomDetail };
            if (url === "/classrooms/10/faculties-subject") return { data: persistedSubjects };
            return { data: [] };
        });

        render(<AdminClassrooms />);

        // Select Grade 10 -> Rizal -> Subject Tab
        await user.click(await screen.findByRole("button", { name: "View classrooms for Grade 10" }));
        await user.click(await screen.findByRole("heading", { name: "Rizal" }));
        await user.click(await screen.findByRole("tab", { name: /Subject/i }));

        // Both persisted subjects are rendered with the same teacher
        expect(await screen.findByText("Mathematics 10")).toBeInTheDocument();
        expect(screen.getByText("Science 10")).toBeInTheDocument();

        // 2 subjects count displayed
        expect(screen.getByText("2 subjects")).toBeInTheDocument();

        const facultyOccurrences = screen.getAllByText("Juan Dela Cruz");
        // Appears in the table for each subject and as class adviser
        expect(facultyOccurrences.length).toBeGreaterThanOrEqual(2);
    });

    it("prevents duplicate teacher selection within the same subject via radio group", async () => {
        const user = userEvent.setup();
        const { addSubjectsBtn } = await navigateToClassroomSubjectsTab(user);

        await user.click(addSubjectsBtn);

        // Select Mathematics 10
        await user.click(screen.getByLabelText(/Mathematics 10/i));

        // Options: Juan Dela Cruz (50) and Ana Reyes (51)
        const juanRadio = await screen.findByRole("radio", { name: /Juan Dela Cruz/i });
        const anaRadio = screen.getByRole("radio", { name: /Ana Reyes/i });

        // Select Juan
        await user.click(juanRadio);
        expect(juanRadio).toBeChecked();
        expect(anaRadio).not.toBeChecked();

        // Select Ana -> Juan is automatically deselected (radio behavior prevents duplicates)
        await user.click(anaRadio);
        expect(anaRadio).toBeChecked();
        expect(juanRadio).not.toBeChecked();
    });

    it("warns and blocks submission if a selected subject has no assigned teacher", async () => {
        const user = userEvent.setup();
        const { addSubjectsBtn } = await navigateToClassroomSubjectsTab(user);

        await user.click(addSubjectsBtn);

        // Check Mathematics, but do not pick a faculty radio
        await user.click(screen.getByLabelText(/Mathematics 10/i));

        const submitBtn = screen.getByRole("button", { name: "Create Subject" });
        await user.click(submitBtn);

        expect(toast.warning).toHaveBeenCalledWith(
            "Assign a faculty for the selected subject before adding."
        );
        expect(api.post).not.toHaveBeenCalled();
    });

    it("warns and blocks submission if no subjects are selected", async () => {
        const user = userEvent.setup();
        const { addSubjectsBtn } = await navigateToClassroomSubjectsTab(user);

        await user.click(addSubjectsBtn);

        const submitBtn = screen.getByRole("button", { name: "Create Subject" });
        await user.click(submitBtn);

        expect(toast.warning).toHaveBeenCalledWith("Select at least one subject to add.");
        expect(api.post).not.toHaveBeenCalled();
    });

    it("unchecking a subject removes it from the submission payload", async () => {
        const user = userEvent.setup();
        const { addSubjectsBtn } = await navigateToClassroomSubjectsTab(user);

        await user.click(addSubjectsBtn);

        // Select Mathematics and assign Juan
        const mathCheckbox = screen.getByLabelText(/Mathematics 10/i);
        await user.click(mathCheckbox);
        const mathJuanRadio = await screen.findByRole("radio", { name: /Juan Dela Cruz/i });
        await user.click(mathJuanRadio);

        // Select Science and assign Juan
        const scienceCheckbox = screen.getByLabelText(/Science 10/i);
        await user.click(scienceCheckbox);
        const juanRadios = screen.getAllByRole("radio", { name: /Juan Dela Cruz/i });
        await user.click(juanRadios[1]);

        // Uncheck Science
        await user.click(scienceCheckbox);
        expect(scienceCheckbox).not.toBeChecked();

        // Submit: only Mathematics should be submitted
        const submitBtn = screen.getByRole("button", { name: "Create Subject" });
        await user.click(submitBtn);

        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
        const [, payload] = api.post.mock.calls[0];
        expect(payload).toEqual({
            newSubjects: [
                { classId: 10, subjectId: 101, facultyId: 50 },
            ],
        });
    });
});

