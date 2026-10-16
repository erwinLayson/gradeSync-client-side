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
