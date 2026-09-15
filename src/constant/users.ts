export interface User {
    id: number,
    email:string,
    role: UserRoles
}

export interface CreateUserProps {
    email:string,
    password: string,
    role: string
}

export interface UserResponseProps {
    id: number,
    email: string,
    role: UserRoles
    password: string
}

export const ROLES = {
    ADMIN: "admin",
    TEACHER: "teacher",
    STUDENT: "student",
    DEVELOPER: "developer"
} as const;export type UserRoles = (typeof ROLES)[keyof typeof ROLES];

// ==================== developer account management ====================
// docs/developer-users-plan.md Phase 2. Row shape of GET /users
// (server SELECTs id, email, role, status — never the password hash).
export type UserStatus = "active" | "inactive";

export interface UserAccount {
    id: number,
    email: string,
    role: UserRoles,
    status: UserStatus
}

// Bodies for the developer-only endpoints (Phase 1):
// PATCH /users/:id/status · PATCH /users/:id/role · POST /users/:id/reset-password
export interface UpdateUserStatusPayload {
    status: UserStatus
}

export interface UpdateUserRolePayload {
    role: UserRoles
}

