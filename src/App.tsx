import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'

// Pages
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import UnauthorizedPage from './pages/UnauthorizedPage'
import NotFoundPage from './pages/NotFoundPage'

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AnalyticsReports from './pages/admin/Analytics-Reports'
import AdminEnrollments from './pages/admin/AdminEnrollments'
import AdminStudents from './pages/admin/AdminStudent'
import AdminClassrooms from './pages/admin/AdminClassrooms'
import AdminSubjects from './pages/admin/AdminSubjects'
import AdminFaculties from './pages/admin/AdminFaculties'
import AdminReports from './pages/admin/Admin-Reports'
import AdminStudentRecords from './pages/admin/AdminStudentRecords'
import AdminSettings from './pages/admin/AdminSettings'
// Faculty Pages
import FacultyDashboard from './pages/faculty/FacultyDashboard'
import FacultyAttendance from './pages/faculty/FacultyAttendance'
import FacultyClasses from './pages/faculty/FacultyClasses'
import FacultyMyClass from './pages/faculty/FacultyMyClass'
import FacultyGradeBook from './pages/faculty/FacultyGradebook'
import FacultyStudentRecords from './pages/faculty/FacultyStudentRecords'
import FacultyReport from './pages/faculty/FacultyReport'
import FacultySetting from "./pages/faculty/FacultySettings"

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard'
import StudentProfile from './pages/student/StudentProfile'
import StudentClassroom from './pages/student/studentClassroom'
import StudentProspectus from './pages/student/StudentProspectus'

// Register (registration/enrollment staff) Pages
import RegisterDashboard from './pages/register/RegisterDashboard'
import RegisterStudents from './pages/register/RegisterStudents'
import RegisterEnrollments from './pages/register/RegisterEnrollments'
import RegisterSettings from './pages/register/RegisterSettings'

// Developer Pages
import DeveloperDashboard from './pages/developer/DeveloperDashboard'
import DeveloperFeatures from './pages/developer/DeveloperFeatures'
import DeveloperLandingContent from './pages/developer/DeveloperLandingContent'
import DeveloperUsers from './pages/developer/DeveloperUsers'
import DeveloperDataWipe from './pages/developer/DeveloperDataWipe'
import DeveloperSettings from './pages/developer/DeveloperSettings'

// Components
import MasterLayout from './components/MaterLayout'
import ProtectedRoutes from './routes/ProtectedRoutes'
import { ROLES } from "./constant/users";
import { FACULTY_ROLES } from "./constant/faculties";



function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        {/* Target of ProtectedRoutes when a role lacks access — previously
            missing, which left a blank page. */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Master Layout */}
          <Route element={<MasterLayout />}>
            
            {/* Admin Routes */}
            <Route
              element={
                <ProtectedRoutes allowedRoles={[ROLES.ADMIN]} />
              }
            >
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/enrollments" element={<AdminEnrollments />} />
              <Route path="/admin/students" element={<AdminStudents />} />
              <Route path="/admin/students/:studentId" element={<AdminStudents />} />
              <Route path="/admin/classrooms" element={<AdminClassrooms />} />
              <Route path="/admin/subjects" element={<AdminSubjects />} />
              <Route path="/admin/faculties" element={<AdminFaculties />} />
              <Route path="/admin/analytics-reports" element={<AnalyticsReports />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/student-records" element={<AdminStudentRecords />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>

            {/* Faculty Routes — guarded by faculty-role, not by user role. */}
            {/* Every faculty account authenticates as users.role = "teacher", so a
                plain user-role check would let register faculty into the teaching
                workspace. The frontend mirror here is intentionally aligned with the
                backend model: the real authority for faculty workspaces is the
                authenticated user's verified faculty role. */}
            <Route
              element={
                <ProtectedRoutes allowedRoles={[FACULTY_ROLES.TEACHER]} />
              }
            >
              <Route path="/faculty/dashboard" element={<FacultyDashboard />} />
              <Route path="/faculty/attendance" element={<FacultyAttendance />} />
              <Route path="/faculty/classes" element={<FacultyClasses />} />
              <Route path="/faculty/my-class" element={<FacultyMyClass />} />
              <Route
                path="/faculty/classes/:classId/gradebook"
                element={<FacultyGradeBook />}
              />
              <Route
                path="/faculty/student-records"
                element={<FacultyStudentRecords />}
              />
              <Route path="/faculty/reports" element={<FacultyReport />} />
              <Route path="/faculty/settings" element={<FacultySetting />} />
            </Route>

            {/* Student Routes */}
            <Route
              element={
                <ProtectedRoutes allowedRoles={[ROLES.STUDENT]} />
              }
            >
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/student/profile" element={<StudentProfile />} />
              <Route path="/student/classrooms" element={<StudentClassroom />} />
              <Route path="/student/prospectus" element={<StudentProspectus />} />
            </Route>

            {/* Register workspace (registration/enrollment staff). */}
            {/* Access is determined by the authenticated user's verified faculty role
                (faculties.role === "register"), mirrored here for navigation. The
                backend remains the authoritative boundary. */}
            <Route
              element={
                <ProtectedRoutes allowedRoles={[FACULTY_ROLES.REGISTER]} />
              }
            >
              <Route path="/register/dashboard" element={<RegisterDashboard />} />
              <Route path="/register/students" element={<RegisterStudents />} />
              <Route path="/register/students/:studentId" element={<RegisterStudents />} />
              <Route path="/register/enrollments" element={<RegisterEnrollments />} />
              <Route path="/register/settings" element={<RegisterSettings />} />
            </Route>

            {/* Developer Routes */}
            <Route
              element={
                <ProtectedRoutes allowedRoles={[ROLES.DEVELOPER]} />
              }
            >
              <Route path="/developer/dashboard" element={<DeveloperDashboard />} />
              <Route path="/developer/features" element={<DeveloperFeatures />} />
              <Route path="/developer/landing-content" element={<DeveloperLandingContent />} />
              <Route path="/developer/users" element={<DeveloperUsers />} />
              <Route path="/developer/data-wipe" element={<DeveloperDataWipe />} />
              <Route path="/developer/settings" element={<DeveloperSettings />} />
            </Route>

          </Route>

        {/* Catch-all: unknown URLs render the 404 page instead of nothing. */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  )
}

export default App
