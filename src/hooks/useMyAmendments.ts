import { useCallback, useEffect, useState } from "react";
import { getMyAmendmentRequests } from "../api/amendments";
import type { AmendmentRequest, AmendmentRecordType } from "../constant/amendment";

export interface PermissionCheckParams {
  enrollmentId: number;
  quarter: number;
  recordType: AmendmentRecordType;
  classSubjectId?: number | null;
}

export function useMyAmendments() {
  const [requests, setRequests] = useState<AmendmentRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyAmendmentRequests({ limit: 100 });
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Non-critical background failure, fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const hasActivePermission = useCallback(
    (params: PermissionCheckParams): boolean => {
      const now = new Date();
      return requests.some((req) => {
        if (req.status !== "approved") return false;
        if (req.enrollmentId !== params.enrollmentId) return false;
        if (req.quarter !== params.quarter) return false;
        if (req.recordType !== params.recordType) return false;
        if (
          params.classSubjectId !== undefined &&
          params.classSubjectId !== null &&
          req.classSubjectId !== null &&
          req.classSubjectId !== params.classSubjectId
        ) {
          return false;
        }
        if (req.permission) {
          if (req.permission.status !== "active" || req.permission.consumedAt) return false;
          if (new Date(req.permission.expiresAt) <= now) return false;
        }
        return true;
      });
    },
    [requests]
  );

  const getPendingRequest = useCallback(
    (params: PermissionCheckParams): AmendmentRequest | undefined => {
      return requests.find((req) => {
        if (req.status !== "pending") return false;
        if (req.enrollmentId !== params.enrollmentId) return false;
        if (req.quarter !== params.quarter) return false;
        if (req.recordType !== params.recordType) return false;
        if (
          params.classSubjectId !== undefined &&
          params.classSubjectId !== null &&
          req.classSubjectId !== null &&
          req.classSubjectId !== params.classSubjectId
        ) {
          return false;
        }
        return true;
      });
    },
    [requests]
  );

  return {
    requests,
    loading,
    refresh: fetchRequests,
    hasActivePermission,
    getPendingRequest,
  };
}

