import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-wide uppercase text-indigo-600">404 error</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Page not found</h1>
          <p className="text-sm text-slate-500">
            The page you are looking for does not exist or may have been moved.
          </p>
        </div>
        <div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            Go back home
          </Link>
        </div>
      </div>
    </div>
  );
}
