import EnrollmentWorkspace from "../../components/EnrollmentWorkspace";

/**
 * Register (registration/enrollment staff) enrollment workspace.
 *
 * Reuses the shared enrollment flow with the Admin-only actions removed:
 * no school-year creation, no past-submitted-grades view, no academic-settings
 * changes. Register prints SF10 from here.
 *
 * Registering a NEW student is no longer part of this workspace — it lives on
 * the student registry at /register/students (`StudentManagement`), which
 * Register also uses to edit and soft-delete students. Create the student there,
 * then enroll them from the not-yet-enrolled search here.
 *
 * See docs/register-role-implementation-plan.md.
 */
export default function RegisterEnrollments() {
  return <EnrollmentWorkspace allowSf10Print />;
}
