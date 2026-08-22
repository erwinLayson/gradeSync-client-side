import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'

// Pages
import LoginPage from './pages/LoginPage'

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AnalyticsReports from './pages/admin/Analytics-Reports'
import AdminEnrollments from './pages/admin/AdminEnrollments'
import AdminStudents from './pages/admin/AdminStudent'
import AdminClassrooms from './pages/admin/AdminClassrooms'
import AdminSubjects from './pages/admin/AdminSubjects'
import AdminTeachers from './pages/admin/AdminTeachers'
import AdminReports from './pages/admin/Admin-Reports'
import AdminStudentRecords from './pages/admin/AdminStudentRecords'
import AdminSettings from './pages/admin/AdminSettings'
// Teacher Pages
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherAttendance from './pages/teacher/TeacherAttendance'
import TeacherClasses from './pages/teacher/TeacherClasses'
import TeacherMyClass from './pages/teacher/TeacherMyClass'
import TeacherGradeBook from './pages/teacher/TeacherGradebook'
import TeacherStudentRecords from './pages/teacher/TeacherStudentRecords'
import TeacherReport from './pages/teacher/TeacherReport'
import TeacherSetting from "./pages/teacher/TeacherSettings"

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard'
import StudentProfile from './pages/student/StudentProfile'
import StudentClassroom from './pages/student/studentClassroom'
import StudentProspectus from './pages/student/StudentProspectus'

// Components
import MasterLayout from './components/MaterLayout'
import ProtectedRoutes from './routes/ProtectedRoutes'
import { ROLES} from "./constant/users";



function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoutes allowedRoles={[ROLES.ADMIN, ROLES.TEACHER, ROLES.STUDENT]} />}>
              <Route path="/" element={<MasterLayout />}>
              {/* Admin Routes */}
              <Route element={<ProtectedRoutes allowedRoles={[ROLES.ADMIN]} />} >
                <Route path="admin/dashboard" element={<AdminDashboard />} />
                <Route path="admin/enrollments" element={<AdminEnrollments />} />
                <Route path="admin/students" element={<AdminStudents />} />
                <Route path="admin/classrooms" element={<AdminClassrooms />} />
                <Route path="admin/subjects" element={<AdminSubjects />} />
                <Route path="admin/teachers" element={<AdminTeachers />} />
                <Route path="admin/analytics-reports" element={<AnalyticsReports />} />
                <Route path="admin/reports" element={<AdminReports />} />
                <Route path="admin/student-records" element={<AdminStudentRecords />} />
                <Route path="admin/settings" element={<AdminSettings />} />
              </Route>

              {/* Teacher Routes */}
              <Route element={<ProtectedRoutes allowedRoles={[ROLES.TEACHER]} />} >
                <Route path="teacher/dashboard" element={<TeacherDashboard />} />
                <Route path="teacher/attendance" element={<TeacherAttendance />} />
                <Route path="teacher/classes" element={<TeacherClasses />} />
                <Route path="teacher/my-class" element={<TeacherMyClass />} />
                <Route path="teacher/classes/:classId/gradebook" element={<TeacherGradeBook />} />
                <Route path="teacher/student-records" element={<TeacherStudentRecords />} />
                <Route path="teacher/reports" element={<TeacherReport />} />
                <Route path="teacher/settings" element={<TeacherSetting />} />
              </Route>

              {/* Student Routes */}
              <Route element={<ProtectedRoutes allowedRoles={[ROLES.STUDENT]} />} >
                <Route path="student/dashboard" element={<StudentDashboard />} />
                <Route path="student/profile" element={<StudentProfile />} />
                <Route path="student/classrooms" element={<StudentClassroom />} />
                <Route path="student/prospectus" element={<StudentProspectus />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </div>
    </Router>
  )
}

export default App
