import StudentManagement from "../../components/StudentManagement";

/**
 * Register (registration staff) student registry.
 *
 * Register owns the student side of registration, so it reuses the same student
 * management screen as Admin: list/search, create a student + login account,
 * edit, soft-delete, view detail and academic history, and print SF10.
 *
 * The past-submitted-grades view is intentionally not exposed here — it stays
 * Admin-only (docs/register-role-implementation-plan.md §3) and lives on the
 * Admin enrollment workspace, not this page.
 */
export default function RegisterStudents() {
  return <StudentManagement />;
}
