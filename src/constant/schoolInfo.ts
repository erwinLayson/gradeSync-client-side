export interface SchoolInfoProps {
    id: number;
    schoolId: number;
    name: string;
    district: string;
    division: string;
    region: string;
    principal: string | null;
    address: string | null;
}

// The school's authorized signature. `dataUrl` is a ready-to-render data: URL
// for the preview; the raw bytes stay on the server (stored in the database so
// they survive restarts on the deployment's ephemeral disk).
export interface SchoolSignatureProps {
    mimeType: string;
    byteSize: number;
    updatedAt: string | null;
    dataUrl: string;
}

// `signature: null` means no signature has been saved yet.
export interface SchoolSignaturePayload {
    signature: SchoolSignatureProps | null;
}

// The school's uploaded logo. Like the signature, `dataUrl` is ready to render
// and the raw bytes stay in the database.
export interface SchoolLogoProps {
    mimeType: string;
    byteSize: number;
    updatedAt: string | null;
    dataUrl: string;
}

// `logo: null` means no logo has been saved yet.
export interface SchoolLogoPayload {
    logo: SchoolLogoProps | null;
}

// Mirrors the server's upload cap (server/src/constant/schoolLogo.ts).
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;
export const ALLOWED_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
