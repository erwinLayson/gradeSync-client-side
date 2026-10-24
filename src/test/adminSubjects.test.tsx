import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AdminSubjects from "../pages/admin/AdminSubjects";

const api = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
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
    deleteAPICall: api.del,
    uploadFile: vi.fn(),
}));

describe("AdminSubjects create form", () => {
    beforeEach(() => {
        api.get.mockReset().mockResolvedValue({ data: [] });
        api.post.mockReset().mockResolvedValue({ data: null });
        api.put.mockReset().mockResolvedValue({ data: null });
        api.del.mockReset().mockResolvedValue({ data: null });
    });

    it("creates a subject without units or sub-components", async () => {
        const user = userEvent.setup();
        render(<AdminSubjects />);

        await user.click(
            await screen.findByRole("button", { name: "Open create subject form" }),
        );

        await user.type(screen.getByLabelText("Subject Name"), "Homeroom");
        await user.type(screen.getByLabelText("Subject Code"), "HR101");

        // Units and "Has Sub-Components" are left untouched/empty.
        await user.click(screen.getByRole("button", { name: "Create Subject" }));

        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));

        const [url, body] = api.post.mock.calls[0];
        expect(url).toBe("/subjects");
        expect(body).toMatchObject({
            name: "Homeroom",
            code: "HR101",
            unit: "",
            hasComponents: false,
            components: [],
        });
    });
});
