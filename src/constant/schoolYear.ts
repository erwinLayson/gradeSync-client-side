export type SchoolYearStatus = "ongoing" | "completed";

export interface SchoolYear {
    id: number;
    startYear: string;
    endYear: string;
    isActive?: boolean | number;
    status?: SchoolYearStatus | string;
}

export interface ActiveSchoolYearResponse {
    activeSchoolYear: SchoolYear | null;
    hasActive: boolean;
}

