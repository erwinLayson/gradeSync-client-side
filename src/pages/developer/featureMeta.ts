// Human-friendly labels/descriptions for known feature keys. Unknown keys
// returned by the API still render (key-as-label) so nothing is hidden from
// the developer — this list only adds friendly copy.
export interface FeatureRow {
    key: string;
    label: string;
    description: string;
}

export const FEATURE_META: Record<string, Omit<FeatureRow, "key">> = {
    reports_analytics: {
        label: "Reports & Analytics",
        description: "Admin analytics dashboards covering enrollment, grades and attendance trends.",
    },
    reports_generation: {
        label: "Report Generation",
        description: "Printable reports: master lists, class rosters, grade sheets and attendance summaries.",
    },
    submission_tracker: {
        label: "Submission Tracker",
        description: "Quarterly submission workflow for advisers freezing class records (SF10 / Form-137).",
    },
};
