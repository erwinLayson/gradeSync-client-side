import { Link } from "react-router-dom";
import { FiAlertTriangle, FiArrowLeft } from "react-icons/fi";

/**
 * Catch-all page for unknown URLs. Without it React Router rendered nothing,
 * leaving a blank screen for any mistyped/removed route.
 */
export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
        <span
          className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-500"
          aria-hidden="true"
        >
          <FiAlertTriangle />
        </span>

        <p className="mt-4 text-3xl font-bold text-slate-800">404</p>
        <h1 className="mt-1 text-lg font-bold text-slate-800">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          The page you are looking for does not exist or has been moved.
        </p>

        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            <FiArrowLeft aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
