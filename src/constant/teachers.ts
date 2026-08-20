export interface Teacher {
    id: number;
    fullname: string;
    email: string;
}

export interface NewTeacherProps {
    email: string;
    firstname: string;
    middlename: string;
    lastname: string;
    suffix?: string | null;
}

export interface TeacherDetails extends Teacher {
    userId: number;
    firstname: string;
    middlename: string;
    lastname: string;
    suffix?: string | null;
}

export interface TeacherSubjectDetails {
    classSubjectId: number,
    subjectId: number,
    subjectName: string,
    subjectCode: string,
    subjectUnit: number;
    classGradeLevel: number,
    classId: number,
    classSection: string
}