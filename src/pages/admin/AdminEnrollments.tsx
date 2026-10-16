import EnrollmentWorkspace from "../../components/EnrollmentWorkspace";

/**
 * Admin enrollment workspace.
 *
 * The enrollment flow itself is shared with the Register role
 * (`components/EnrollmentWorkspace.tsx`). Admin keeps the full flow:
 * creating a new school year and inspecting a candidate's past submitted grades.
 * See docs/register-role-implementation-plan.md.
 */
export default function AdminEnrollments() {
  return <EnrollmentWorkspace allowSchoolYearCreation allowPastGrades />;
}
