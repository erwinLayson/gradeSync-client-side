export interface StudentResponseProps {
    id: number,
    lrn: number,
    email: string,
    fullname: string,
    birthdate: string,
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