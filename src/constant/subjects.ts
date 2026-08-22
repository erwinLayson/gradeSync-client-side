export interface Subject {
    id: number;
    name: string;
    code: string;
    unit: number;
    hasComponents?: boolean;
}

export interface NewSubject extends Omit<Subject, "id" | "unit" | "hasComponents"> {
    unit: string;
    hasComponents?: boolean;
    components?: ComponentCreateProps[];
}

export interface SubjectWithTeachers extends Subject {
    teachers: {
        id: number;
        name: string;
    }[];
    components?: SubjectComponent[];
}

export interface SubjectComponent {
    id: number;
    parentSubjectId: number;
    name: string;
    code: string;
    weight: number;
    createdAt?: string;
}

export interface ComponentCreateProps {
    name: string;
    code: string;
    weight: number;
}
