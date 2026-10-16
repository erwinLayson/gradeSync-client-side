export interface ClassroomResponseProps {
    id: number;
    section: string;
    gradeLevel: number;
    totalStudent: number;
    adviserId?: number | null;
    adviserFullname?: string | null;
    // 'active' | 'inactive' (archived classes are hidden from lists).
    status?: string;
}

export interface ClassroomWithStudentsProps extends ClassroomResponseProps {
students: {
    enrollmentId: number;
    studentId: number;
    studentLrn: string;
    studentEmail: string;
    fullname: string;
    // Nullable: the roster endpoint formats the nullable students.birthdate column.
    studentBirthdate: string | null;
    studentAge: number;
    studentSex: string;
}[]
}

export interface ClassroomFacultiesWithSubjectProps  {
    classSubjectId: number;
    facultyId: number;
    facultyFullname: string;
    unit: number,
    code: string;
    subjectId: number;
    subjectName: string;
}

export interface subjectFacultiesProps extends ClassroomFacultiesWithSubjectProps {
    subjectUnit: number;
    subjectCode: string
}

export interface subjectNotInClassProps {
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    subjectUnit: number;
    faculties: {
        facultyId: number;
        facultyFullname: string;
    }[]
}

export interface EditSubjectFacultyProps {
    subjectId: number,
    facultyId: number
    
}