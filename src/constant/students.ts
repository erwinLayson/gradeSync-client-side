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