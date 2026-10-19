import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBookOpen, FiClipboard, FiClock, FiHome, FiUsers } from "react-icons/fi";
import { PiGraduationCapDuotone } from "react-icons/pi";

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

            {/* Class cards — ModuLearn pattern */}
            <PageSection
                className="faculty-classes__card"
                title="Gradebook"
                description="Select a subject to open its gradebook"
                actions={<span className="page__meta">{`${classes.length} ${classes.length === 1 ? "class" : "classes"}`}</span>}
                flush
            >
                <div className="fc-grid">
                    {classes.map((classItem) => {
                        return (
                            <article className="fc-card" key={classItem.classId}>
                                {/* Top accent bar */}
                                <div className="fc-card__accent" aria-hidden="true" />

                                {/* Card header: icon badge + title/pills */}
                                <div className="fc-card__head">
                                    <div className="fc-card__icon-wrap" aria-hidden="true">
                                        <PiGraduationCapDuotone className="fc-card__icon" />
                                    </div>
                                    <div className="fc-card__title-col">
                                        <h4 className="fc-card__title">
                                            Grade {classItem.classGradeLevel} - {classItem.classSection}
                                        </h4>
                                        <div className="fc-card__pills">
                                            <span className="fc-pill fc-pill--grade">{classItem.classGradeLevel}</span>
                                            <span className="fc-pill fc-pill--section">Section {classItem.classSection}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="fc-card__divider" />

                                {/* Enrolled count row */}
                                <div className="fc-card__info-row">
                                    <div className="fc-card__info-item">
                                        <span className="fc-card__info-label">ENROLLED</span>
                                        <div className="fc-card__info-val-row">
                                            <FiUsers className="fc-card__info-icon" aria-hidden="true" />
                                            <span className="fc-card__info-value">
                                                {studentCountFor(classItem.classId)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="fc-card__divider" />

                                {/* Subjects section */}
                                <div className="fc-card__subjects">
                                    <span className="fc-card__subjects-label">
                                        SUBJECTS ({classItem.subjects.length})
                                    </span>
                                    <div className="fc-card__subject-chips">
                                        {classItem.subjects.map((subject) => (
                                            <button
                                                key={subject.subjectId}
                                                type="button"
                                                className="fc-subject-chip"
                                                onClick={() => navigate(`/faculty/classes/${subject.classSubjectId}/gradebook`)}
                                                aria-label={`Open gradebook for ${subject.subjectName}`}
                                            >
                                                <FiClipboard className="fc-subject-chip__icon" aria-hidden="true" />
                                                {subject.subjectName}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </PageSection>
        </PageShell>
    );
}
