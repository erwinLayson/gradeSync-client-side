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
} as const;

export type UserRoles = (typeof ROLES)[keyof typeof ROLES];