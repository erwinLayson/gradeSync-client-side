import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import LoginPage from "../pages/LoginPage";

const UPLOADED_LOGO = "data:image/png;base64,UPLOADED_LOGO";

vi.mock("../hooks/useSchoolLogo", () => ({
    useSchoolLogo: () => ({ schoolLogo: "data:image/png;base64,UPLOADED_LOGO" }),
}));

vi.mock("../hooks/useUser", () => ({
    useUser: () => ({ fetchUser: vi.fn() }),
}));

describe("LoginPage school logo", () => {
    it("renders the uploaded school logo instead of the bundled fallback", () => {
        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        expect(screen.getByAltText("School logo")).toHaveAttribute("src", UPLOADED_LOGO);
    });
});
