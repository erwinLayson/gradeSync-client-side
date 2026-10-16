export interface StudentResponseProps {
    id: number,
    lrn: number,
    email: string,
    fullname: string,
    // students.birthdate is nullable in the database; the list endpoints render it
    // through the server-side date formatter, which returns null for missing values.
    birthdate: string | null,
    age: number,
    sex: string,
    firstname?: string,
    middlename?: string,
    lastname?: string,
    suffix?: string | null,
    status?: string
}


export interface NewStudentProps {
    lrn: string,
    email: string,
    firstname: string,
    middlename: string,
    lastname: string,
    suffix?: string | null,
    birthdate: string,
    sex: string
}

export type StudentStatusFilter = "active" | "inactive" | "all";
export type StudentSortKey = "name" | "lrn" | "email" | "id";
export type SortDirection = "asc" | "desc";

/**
 * One page of the server-paginated student registry (GET /students). The table
 * renders `students` and derives its pager from `total`.
 */
export interface StudentListResponse {
    students: StudentResponseProps[];
    total: number;
    page: number;
    pageSize: number;
}