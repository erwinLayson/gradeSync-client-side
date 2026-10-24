import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SignaturePad from "../components/SignaturePad";

const api = vi.hoisted(() => ({
    get: vi.fn(),
    upload: vi.fn(),
}));

vi.mock("../api/api", () => ({
    getAPICall: api.get,
    uploadFile: api.upload,
}));

vi.mock("signature_pad", () => ({
    default: class {
        addEventListener() {}
        off() {}
        clear() {}
        isEmpty() {
            return true;
        }
        toData() {
            return [];
        }
        fromData() {}
    },
}));

describe("SignaturePad guard", () => {
    beforeEach(() => {
        api.get.mockReset().mockResolvedValue({ data: { signature: null } });
        api.upload.mockReset();

        globalThis.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver;
    });

    it("locks the canvas until the admin explicitly starts signing", async () => {
        const user = userEvent.setup();
        render(<SignaturePad />);

        const startButton = await screen.findByRole("button", { name: "Start signing" });
        expect(screen.getByText(/Drawing is locked/)).toBeInTheDocument();

        const saveButton = screen.getByRole("button", { name: "Save Signature" });
        expect(saveButton).toBeDisabled();
        await user.click(saveButton);
        expect(api.upload).not.toHaveBeenCalled();

        await user.click(startButton);
        expect(screen.queryByText(/Drawing is locked/)).toBeNull();
        expect(screen.getByRole("button", { name: "Lock" })).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Lock" }));
        expect(screen.getByText(/Drawing is locked/)).toBeInTheDocument();
    });
});
