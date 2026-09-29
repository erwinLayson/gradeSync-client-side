import { Link } from "react-router-dom";
import { FiArrowLeft, FiLock } from "react-icons/fi";

import { useUser } from "../hooks/useUser";
import { DASHBOARD_PATH } from "../constant/navigation";

/**
 * Rendered by ProtectedRoutes when an authenticated user opens a route their
 * role is not allowed to see (previously this target route did not exist, so
 * the user landed on a blank page).
 */
export default function UnauthorizedPage() {
  const { user } = useUser();
  const dashboardPath = user ? DASHBOARD_PATH[user.role] : "/login";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
        <span
          className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-2xl text-amber-600"
          aria-hidden="true"
        >
          <FiLock />
        </span>

        <h1 className="mt-4 text-xl font-bold text-slate-800">Access denied</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your account does not have permission to view this page.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={dashboardPath}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            Go to my dashboard
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <FiArrowLeft aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
