// Frontend type extensions for the faculty-role authorization model.
//
// `register` is no longer a user-level role. Backend authorization is driven by
// the authenticated user's verified faculty record (`faculties.role`), resolved
// server-side from the signed-in account. The client mirrors that decision with
// two optional flags on the `User` shape:
//
//   - `facultyVerified`  — true once GET /faculties/by-user/:id has resolved the
//                          account to an authoritative faculty record this
//                          session.
//   - `facultyRole`      — the resolved `faculties.role` value ("teacher" |
//                          "register"). Used only by the federated faculty
//                          workspace guards in ProtectedRoutes; it never gates
//                          the already-authenticated session and must not be
//                          written to the server.

// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
    namespace Express {
        interface User {
            // Backward-compatible user-role claim (admin | teacher | student |
            // developer).
            role: string;
            // Resolved by the auth/service layer from the faculty record after the
            // school year is completed (plan §7): teacher | register.
            facultiesRole?: string;
            facultyVerified?: boolean;
            facultyRole?: string;
        }
    }
}

export {};
