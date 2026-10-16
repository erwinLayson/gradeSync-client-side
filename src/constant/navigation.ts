import {
  FaBookOpen,
  FaChalkboardTeacher,
  FaChartLine,
  FaClipboardCheck,
  FaClipboardList,
  FaCog,
  FaDatabase,
  FaHome,
  FaIdCard,
  FaImage,
  FaSchool,
  FaScroll,
  FaToggleOn,
  FaUserGraduate,
  FaUsersCog,
} from "react-icons/fa";


export const DASHBOARD_PATH = {
  admin: '/admin/dashboard',
  // Keyed by the *user role* (ROLES.TEACHER = "teacher"); the value is the
  // faculty workspace path (docs/faculty-role-implementation-plan.md §3.1).
  teacher: '/faculty/dashboard',
  student: '/student/dashboard',
  developer: '/developer/dashboard',
  // Registration/enrollment staff (docs/register-role-implementation-plan.md).
  register: '/register/dashboard',
};



export const DASHBOARD_LINKS = {
  admin: [
    {
      title: "Main",
      sections: [
        { label: "Dashboard", path: "/admin/dashboard", icon: FaHome },
        { label: "Reports & Analytics", path: "/admin/analytics-reports", icon: FaChartLine },
      ]
    },
    {
      title: "Academics",
      sections: [
        { label: "Enrollments", path: "/admin/enrollments", icon: FaClipboardList },
        { label: "Students", path: "/admin/students", icon: FaUserGraduate },
        { label: "Classrooms", path: "/admin/classrooms", icon: FaSchool },
        { label: "Subjects", path: "/admin/subjects", icon: FaBookOpen },
      ]
    },
    {
      title: "Faculty",
      sections: [
        { label: "Faculty", path: "/admin/faculties", icon: FaChalkboardTeacher },
      ]
    },
    {
      title: "Records",
      sections: [
        { label: "Submission Tracker", path: "/admin/student-records", icon: FaClipboardList },
        { label: "Reports", path: "/admin/reports", icon: FaChartLine },
      ]
    },
    {
      title: "System",
      sections: [
        { label: "Settings", path: "/admin/settings", icon: FaCog },
      ]
    }
  ],

  // Keyed by the *user role* (ROLES.TEACHER = "teacher"), not by entity name.
  teacher: [
    {
      title: "Main",
      sections: [
        { label: "Dashboard", path: "/faculty/dashboard",icon: FaHome,},
        { label: "Attendance",path: "/faculty/attendance",icon: FaClipboardCheck},
        { label: "My Class",  path: "/faculty/my-class", icon: FaSchool},
        { label: "Gradebook",  path: "/faculty/classes", icon: FaClipboardCheck},
        { label: "Student Records", path: "/faculty/student-records", icon: FaClipboardList},
        { label: "Reports", path: "/faculty/reports", icon: FaChartLine}
      ] 
    },
    {
      title: "Configuration",
      sections: [
        { label: "Settings", path: "/faculty/settings", icon: FaCog }
      ]
    }
  ],

  student: [
    {
      title: "Main",
      sections: [
        { label: "Dashboard", path: "/student/dashboard",icon: FaHome },
        { label: "My Profile", path: "/student/profile", icon: FaIdCard },
      ],
    },
     {
      title: "Academics",
      sections: [
        { label: "My Classrooms", path: "/student/classrooms", icon: FaChalkboardTeacher },
        { label: "Prospectus", path: "/student/prospectus", icon: FaScroll },
      ],
    }
  ],

  register: [
    {
      title: "Main",
      sections: [
        { label: "Dashboard", path: "/register/dashboard", icon: FaHome },
      ]
    },
    {
      title: "Academics",
      sections: [
        { label: "Students", path: "/register/students", icon: FaUserGraduate },
        { label: "Enrollments", path: "/register/enrollments", icon: FaClipboardList },
      ]
    },
    {
      title: "Configuration",
      sections: [
        { label: "Settings", path: "/register/settings", icon: FaCog },
      ]
    }
  ],

  developer: [
    {
      title: "Main",
      sections: [
        { label: "Dashboard", path: "/developer/dashboard", icon: FaHome },
        { label: "Feature Management", path: "/developer/features", icon: FaToggleOn },
      ]
    },
    {
      title: "Configuration",
      sections: [
        { label: "Landing Content", path: "/developer/landing-content", icon: FaImage },
        { label: "User Accounts", path: "/developer/users", icon: FaUsersCog },
        { label: "Data Wipe", path: "/developer/data-wipe", icon: FaDatabase },
        { label: "Settings", path: "/developer/settings", icon: FaCog }
      ]
    }
  ]
}

export const SCHOOL_NAME = "Abang Suizu Integrated School";
