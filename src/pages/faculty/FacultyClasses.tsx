import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBookOpen, FiClipboard, FiClock, FiHome, FiUsers } from "react-icons/fi";

import { getAPICall } from "../../api/api";
import { PageHeader, PageSection, PageShell, StatGrid, StatTile } from "../../components/PageLayout";
import Skeleton from "../../components/Skeleton";
import { useUser } from "../../hooks/useUser";

import type { FacultyDetails, FacultySubjectDetails } from "../../constant/faculties";
import type { ClassroomResponseProps } from "../../constant/classrooms";

import "../../style/facultyClasses.css";

interface ClassGroup {
    classId: number;
    classSection: string;
    classGradeLevel: number;
    subjects: FacultySubjectDetails[];
}

export default function FacultyClasses() {
    const { user, loading: userLoading } = useUser();
    const navigate = useNavigate();

    // ==================== State ====================
    const [faculty, setFaculty] = useState<FacultyDetails | null>(null);
    const [subjectDetails, setSubjectDetails] = useState<FacultySubjectDetails[] | null>(null);
    const [classrooms, setClassrooms] = useState<ClassroomResponseProps[]>([]);
    const [loading, setLoading] = useState(true);

    // ==================== Fetch real class data ====================
    useEffect(() => {
        if (userLoading) return;

        let cancelled = false;

        async function loadFacultyClasses() {
            if (!user) return;

            try {
                const facultyRes = await getAPICall<FacultyDetails>(`/faculties/by-user/${user.id}`);
                const facultyData = facultyRes.data ?? null;
                if (cancelled) return;
                setFaculty(facultyData);

                if (!facultyData) {
                    setLoading(false);
                    return;
                }

                const [subjectsRes, classroomsRes] = await Promise.all([
                    getAPICall<FacultySubjectDetails[]>(`/faculties/${facultyData.id}/subjects`),
                    getAPICall<ClassroomResponseProps[]>("/classrooms"),
                ]);
                if (cancelled) return;
                setSubjectDetails(subjectsRes.data ?? null);
                setClassrooms(classroomsRes.data ?? []);
            } catch {
                // Error toast handled by API interceptor
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadFacultyClasses();
        return () => { cancelled = true; };
    }, [user, userLoading]);

    // Group subjects into class cards
    const classes = useMemo<ClassGroup[]>(() => {
        if (!subjectDetails) return [];
        const map = new Map<number, ClassGroup>();
        for (const row of subjectDetails) {
            const group = map.get(row.classId);
            if (group) {
                group.subjects.push(row);
            } else {
                map.set(row.classId, {
                    classId: row.classId,
                    classSection: row.classSection,
                    classGradeLevel: row.classGradeLevel,
                    subjects: [row],
                });
            }
        }
        return [...map.values()];
    }, [subjectDetails]);

    const totalStudents = useMemo(
        () => classes.reduce((sum, c) => sum + (classrooms.find((cl) => cl.id === c.classId)?.totalStudent ?? 0), 0),
        [classes, classrooms]
    );
    const totalSubjects = subjectDetails?.length ?? 0;
    const weeklyHours = subjectDetails?.reduce((sum, row) => sum + Number(row.subjectUnit), 0) ?? 0;

    function studentCountFor(classId: number): number {
        return classrooms.find((cl) => cl.id === classId)?.totalStudent ?? 0;
    }

    // ==================== Loading state ====================
    if (userLoading || loading) {
        return (
            <PageShell className="faculty-classes" busy>
                <PageSection className="faculty-classes__card" title="Gradebook" description="Loading…" flush>
                    <div className="p-6">
                        <Skeleton count={2} lines={1} height="10rem" radius="0.75rem" grid="repeat(2, 1fr)" />
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    // ==================== Empty state ====================
    if (!faculty || classes.length === 0) {
        return (
            <PageShell className="faculty-classes">
                <PageSection
                    className="faculty-classes__card"
                    title="Gradebook"
                    description={faculty ? "No classes assigned yet" : "Faculty profile not found"}
                >
                    <div className="faculty-classes__empty flex flex-col items-center justify-center py-10 text-center">
                        <span className="faculty-classes__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                            <FiHome />
                        </span>
                        <p className="faculty-classes__empty-title mt-3 text-sm font-bold">
                            {faculty ? "No classes assigned" : "No faculty profile found"}
                        </p>
                        <p className="faculty-classes__empty-text mt-1 text-[0.8125rem]">
                            {faculty
                                ? "Classes you teach will appear here once you are assigned."
                                : "Your account is not linked to a faculty record yet."}
                        </p>
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    // ==================== Main content ====================
    return (
        <PageShell className="faculty-classes">
            {/* Header */}
            <PageHeader
                title={faculty.fullname}
                description={faculty.email}
                meta={`${classes.length} ${classes.length === 1 ? "class" : "classes"}`}
            />

            {/* Quick stats */}
            <StatGrid>
                <StatTile label="Classes" value={classes.length} icon={FiHome} />
                <StatTile label="Students" value={totalStudents} icon={FiUsers} />
                <StatTile label="Subjects" value={totalSubjects} icon={FiBookOpen} />
                <StatTile label="Weekly Load" value={`${weeklyHours} hrs`} icon={FiClock} />
            </StatGrid>

            {/* Class cards with gradebook buttons */}
            <PageSection
                className="faculty-classes__card"
                title="Gradebook"
                description="Select a subject to open its gradebook"
                actions={<span className="page__meta">{`${classes.length} ${classes.length === 1 ? "class" : "classes"}`}</span>}
                flush
            >
                <div className="faculty-classes__grid grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                    {classes.map((classItem) => (
                        <article
                            className="faculty-classes__class flex flex-col overflow-hidden rounded-xl border"
                            key={classItem.classId}
                        >
                            <div className="faculty-classes__class-head flex items-start justify-between gap-3 p-5 pb-4">
                                <div className="faculty-classes__class-heading min-w-0">
                                    <span className="faculty-classes__class-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                                        Grade {classItem.classGradeLevel}
                                    </span>
                                    <h4 className="faculty-classes__class-name mt-1 truncate text-[1.0625rem] font-bold">
                                        {classItem.classSection}
                                    </h4>
                                    <p className="faculty-classes__class-room mt-0.5 font-mono text-[0.6875rem]">
                                        Classroom #{classItem.classId} &middot; {studentCountFor(classItem.classId)} students
                                    </p>
                                </div>
                                <span className="faculty-classes__class-icon inline-flex h-9 w-9 items-center justify-center rounded-lg text-lg" aria-hidden="true">
                                    <FiHome />
                                </span>
                            </div>

                            <div className="faculty-classes__class-body flex flex-1 flex-col gap-2 p-4 pt-0">
                                {classItem.subjects.map((subject) => (
                                    <div className="faculty-classes__subject flex items-center gap-3 rounded-lg border p-2.5" key={subject.subjectId}>
                                        <span className="faculty-classes__subject-code inline-flex h-8 w-12 shrink-0 items-center justify-center rounded-md font-mono text-[0.625rem] font-bold" aria-hidden="true">
                                            {subject.subjectCode}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <span className="faculty-classes__subject-name block truncate text-[0.8125rem] font-bold">
                                                {subject.subjectName}
                                            </span>
                                            <span className="faculty-classes__subject-meta block font-mono text-[0.6875rem]">
                                                {subject.subjectCode} &middot; {subject.subjectUnit} unit{subject.subjectUnit === 1 ? "" : "s"}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            className="faculty-classes__subject-action inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.6875rem] font-bold"
                                            onClick={() => navigate(`/faculty/classes/${subject.classSubjectId}/gradebook`)}
                                            aria-label={`Open gradebook for ${subject.subjectName}`}
                                        >
                                            <FiClipboard aria-hidden="true" />
                                            Gradebook
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>
            </PageSection>
        </PageShell>
    );
}
