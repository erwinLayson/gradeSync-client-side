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
    studentBirthdate: string;
    studentAge: number;
    studentSex: string;
}[]
}

export interface ClassroomTeachersWithSubjectProps  {
    teacherId: number;
    teacherFullname: string;
    unit: number,
    code: string;
    subjectId: number;
    subjectName: string;
}

export interface subjectTeachersProps extends ClassroomTeachersWithSubjectProps {
    subjectUnit: number;
    subjectCode: string
}

export interface subjectNotInClassProps {
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    subjectUnit: number;
    teachers: {
        teacherId: number;
        teacherFullname: string;
    }[]
}

export interface EditSubjectTeacherProps {
    subjectId: number,
    teacherId: number
    
}