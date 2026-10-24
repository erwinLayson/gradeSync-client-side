import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SchoolLogoUploader from "../components/SchoolLogoUploader";

const api = vi.hoisted(() => ({
    get: vi.fn(),
    upload: vi.fn(),
}));

vi.mock("../api/api", () => ({
    getAPICall: api.get,
    uploadFile: api.upload,
}));

const SAVED_LOGO = {
    mimeType: "image/png",
    byteSize: 8,
    updatedAt: "2026-10-24T00:00:00.000Z",
    dataUrl: "data:image/png;base64,iVBORw0KGgo=",
};

describe("SchoolLogoUploader", () => {
    beforeEach(() => {
        api.get.mockReset().mockResolvedValue({ data: { logo: null } });
        api.upload.mockReset().mockResolvedValue({ data: { logo: SAVED_LOGO } });

        Object.defineProperty(URL, "createObjectURL", {
            value: vi.fn(() => "blob:school-logo"),
            writable: true,
            configurable: true,
        });
        Object.defineProperty(URL, "revokeObjectURL", {
            value: vi.fn(),
            writable: true,
            configurable: true,
        });
    });

    it("previews and uploads the selected school logo", async () => {
        const user = userEvent.setup();
        render(<SchoolLogoUploader />);

        await waitFor(() =>
            expect(api.get).toHaveBeenCalledWith("/school-info/logo", expect.anything()),
        );

        const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "logo.png", {
            type: "image/png",
        });

        await user.upload(screen.getByLabelText("Choose school logo"), file);

        expect(screen.getByAltText("School logo preview")).toHaveAttribute(
            "src",
            "blob:school-logo",
        );
        expect(screen.getByText(/logo\.png/)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Save Logo" }));

        await waitFor(() => expect(api.upload).toHaveBeenCalledTimes(1));
        expect(api.upload.mock.calls[0]?.[0]).toBe("/school-info/logo");
        expect(api.upload.mock.calls[0]?.[1]).toBe(file);
        expect(await screen.findByText("Logo saved")).toBeInTheDocument();
    });

    it("asks for confirmation before replacing an existing logo", async () => {
        api.get.mockResolvedValue({ data: { logo: SAVED_LOGO } });
        const user = userEvent.setup();
        render(<SchoolLogoUploader />);

        expect(await screen.findByAltText("School logo preview")).toHaveAttribute(
            "src",
            SAVED_LOGO.dataUrl,
        );

        const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "new-logo.png", {
            type: "image/png",
        });
        await user.upload(screen.getByLabelText("Choose school logo"), file);
        await user.click(screen.getByRole("button", { name: "Save Logo" }));

        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(api.upload).not.toHaveBeenCalled();

        await user.click(screen.getByRole("button", { name: "Replace logo" }));
        await waitFor(() => expect(api.upload).toHaveBeenCalledTimes(1));
    });
});
