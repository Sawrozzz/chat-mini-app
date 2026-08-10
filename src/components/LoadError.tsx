import { useState } from "react";
import type { ErrorDetails } from "./ErrorBoundary";

export function LoadError({
  message = "Failed to load the application.",
  details,
}: {
  message?: string;
  details?: ErrorDetails;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-8">
      <div className="max-w-lg rounded-xl border border-gray-200 bg-white p-8 text-center shadow-lg">
        <div className="mb-4 text-5xl">⚠️</div>

        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Failed to Load
        </h1>

        <p className="mb-6 text-sm text-gray-600">
          {details?.message ?? message}
        </p>

        {details && (
          <div className="mb-6 text-left">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="mb-3 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              {showDetails ? "Hide details" : "Show details"} ▾
            </button>

            {showDetails && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-left text-xs text-gray-700">
                <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                  {details.functionName && (
                    <>
                      <dt className="font-medium text-gray-500">Function</dt>
                      <dd className="break-all font-mono">{details.functionName}</dd>
                    </>
                  )}
                  {details.file && (
                    <>
                      <dt className="font-medium text-gray-500">File</dt>
                      <dd className="break-all font-mono">{details.file}</dd>
                    </>
                  )}
                  {details.line != null && (
                    <>
                      <dt className="font-medium text-gray-500">Location</dt>
                      <dd className="font-mono">
                        line {details.line}
                        {details.column != null ? `:${details.column}` : ""}
                      </dd>
                    </>
                  )}
                </dl>

                {details.stack && (
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-white p-3 font-mono text-[10px] leading-relaxed text-gray-600">
                    {details.stack}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
