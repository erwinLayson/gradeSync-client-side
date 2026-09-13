import {
  FaBookOpen,
  FaChalkboardTeacher,
  FaChartLine,
  FaClipboardCheck,
  FaClipboardList,
  FaCog,
  FaHome,
  FaIdCard,
  FaImage,
  FaSchool,
  FaScroll,
  FaToggleOn,
  FaUserGraduate,
} from "react-icons/fa";


export const DASHBOARD_PATH = {
  admin: '/admin/dashboard',
  teacher: '/teacher/dashboard',
  student: '/student/dashboard',
  developer: '/developer/dashboard',
};



export const DASHBOARD_LINKS = {
  admin: [
    {
      title: "Main", 
      sections: [
        { label: "Dashboard", path: "/admin/dashboard",icon: FaHome, },
        { label: "Reports & Analytics",path: "/admin/analytics-reports", icon: FaChartLine,},
      ]
    }, 
    {
      title: "Academics",
      sections: [
        { label: "Enrollments",path: "/admin/enrollments",icon: FaClipboardList,},
        { label: "Students", path: "/admin/students", icon: FaUserGraduate,},
        { label: "Classrooms",path: "/admin/classrooms", icon: FaSchool, },
        { label: "Subjects", path: "/admin/subjects", icon: FaBookOpen,},
        { label: "Teachers", path: "/admin/teachers", icon: FaChalkboardTeacher, },
        { label: "Submission Tracker", path: "/admin/student-records", icon: FaClipboardList, },
        { label: "Reports", path: "/admin/reports", icon: FaChartLine, },
      ]
    },
    {
      title: "Configuration",
      sections: [
        { label: "Settings", path: "/admin/settings", icon: FaCog },
      ]
    }
  ],

  teacher: [
    {
      title: "Main",
      sections: [
        { label: "Dashboard", path: "/teacher/dashboard",icon: FaHome,},
        { label: "Attendance",path: "/teacher/attendance",icon: FaClipboardCheck},
        { label: "My Class",  path: "/teacher/my-class", icon: FaSchool},
        { label: "Gradebook",  path: "/teacher/classes", icon: FaClipboardCheck},
        { label: "Student Records", path: "/teacher/student-records", icon: FaClipboardList},
        { label: "Reports", path: "/teacher/reports", icon: FaChartLine}
      ] 
    },
    {
      title: "Configuration",
      sections: [
        { label: "Settings", path: "/teacher/settings", icon: FaCog }
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
        { label: "Settings", path: "/developer/settings", icon: FaCog }
      ]
    }
  ]
}

export const SCHOOL_NAME = "Abang Suizu Integrated School";
