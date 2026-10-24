import EnrollmentWorkspace from "../../components/EnrollmentWorkspace";

/**
 * Register (registration/enrollment staff) enrollment workspace.
 *
 * Reuses the shared enrollment flow with school-year creation enabled.
 * Registering a new student and printing SF10 live on the student registry
 * at /register/students (`StudentManagement`).
 */
export default function RegisterEnrollments() {
  return <EnrollmentWorkspace allowSchoolYearCreation />;
}
