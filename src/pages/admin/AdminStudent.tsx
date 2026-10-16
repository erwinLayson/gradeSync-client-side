import StudentManagement from "../../components/StudentManagement";

/**
 * Admin student registry.
 *
 * The student management screen — list, search, create, edit, soft-delete,
 * student detail with academic history, and SF10 printing — is shared with the
 * Register role (`components/StudentManagement.tsx`), which owns registration.
 * See docs/register-role-implementation-plan.md.
 */
export default function AdminStudents() {
  return <StudentManagement />;
}
