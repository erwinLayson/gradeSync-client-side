export interface Subject {
    id: number;
    name: string;
    code: string;
    unit: number;
}

export interface NewSubject extends Omit<Subject, "id" | "unit"> {
    unit: string;
}

export interface SubjectWithTeachers extends Subject {
    teachers: {
        id: number;
        name: string;
    }[];
}
