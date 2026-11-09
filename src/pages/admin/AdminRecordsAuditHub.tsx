import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiActivity, FiFileText } from "react-icons/fi";

import { PageHeader, PageShell } from "../../components/PageLayout";
import { useUser } from "../../hooks/useUser";
import RegisterAmendments from "../register/RegisterAmendments";
import AdminActivityAudit from "./AdminActivityAudit";

import "../../style/recordsAuditHub.css";

export type HubTab = "amendments" | "activity-audit";

export interface AdminRecordsAuditHubProps {
  defaultTab?: HubTab;
}

export default function AdminRecordsAuditHub({ defaultTab }: AdminRecordsAuditHubProps) {
  const { user } = useUser();
  const isAdmin = user?.role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");

  const resolveTab = useCallback(
    (param: string | null): HubTab => {
      // Non-admins can only ever access the amendments tab
      if (!isAdmin) return "amendments";

      if (
        param === "activity-audit" ||
        param === "activity-logs" ||
        param === "audit" ||
        param === "logs"
      ) {
        return "activity-audit";
      }
      if (param === "amendments") {
        return "amendments";
      }
      if (defaultTab === "activity-audit") {
        return "activity-audit";
      }
      return "amendments";
    },
    [isAdmin, defaultTab]
  );

  const [activeTab, setActiveTab] = useState<HubTab>(() => resolveTab(tabParam));

  // Keep state synchronized with URL query params and role changes
  useEffect(() => {
    setActiveTab(resolveTab(tabParam));
  }, [tabParam, resolveTab]);

  const handleTabChange = (newTab: HubTab) => {
    setActiveTab(newTab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", newTab);
        return next;
      },
      { replace: true }
    );
  };

  const isTeacher = user?.role === "teacher" && user?.facultyRole !== "register";
  const canReview = user?.role === "admin" || user?.facultyRole === "register";

  return (
    <PageShell className="records-audit-hub">
      <PageHeader
        title={activeTab === "amendments" ? "Record Amendments" : "Activity Audit & Monitoring"}
        description={
          activeTab === "amendments"
            ? isTeacher && !canReview
              ? "Track the status of your submitted grade and attendance amendment requests."
              : "Review, approve, or reject formal faculty requests to modify locked quarterly records."
            : "Comprehensive historical audit trail of teacher and register operations across the academic system."
        }
      />

      {isAdmin && (
        <div className="records-audit-tabs-wrapper">
          <nav className="records-audit-tabs" role="tablist" aria-label="Records and Audit Hub Tabs">
            <button
              type="button"
              role="tab"
              id="hub-tab-amendments"
              aria-selected={activeTab === "amendments"}
              aria-controls="hub-tabpanel-amendments"
              className={`records-audit-tab ${activeTab === "amendments" ? "records-audit-tab--active" : ""}`}
              onClick={() => handleTabChange("amendments")}
            >
              <FiFileText className="records-audit-tab__icon" aria-hidden="true" />
              <span>Amendments</span>
            </button>
            <button
              type="button"
              role="tab"
              id="hub-tab-activity-audit"
              aria-selected={activeTab === "activity-audit"}
              aria-controls="hub-tabpanel-activity-audit"
              className={`records-audit-tab ${activeTab === "activity-audit" ? "records-audit-tab--active" : ""}`}
              onClick={() => handleTabChange("activity-audit")}
            >
              <FiActivity className="records-audit-tab__icon" aria-hidden="true" />
              <span>Activity Logs</span>
            </button>
          </nav>
        </div>
      )}

      <div
        id={activeTab === "amendments" ? "hub-tabpanel-amendments" : "hub-tabpanel-activity-audit"}
        role="tabpanel"
        aria-labelledby={activeTab === "amendments" ? "hub-tab-amendments" : "hub-tab-activity-audit"}
        className="records-audit-tabpanel"
      >
        {activeTab === "amendments" ? (
          <RegisterAmendments embedded />
        ) : (
          <AdminActivityAudit embedded />
        )}
      </div>
    </PageShell>
  );
}
