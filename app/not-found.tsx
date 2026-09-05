import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-[520px]">
        <p className="eyebrow mb-3">404</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
          That record does not exist in this environment.
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">
          This workspace contains 10,000 transactions, four open investigations and nine
          actions. Anything outside that set will not resolve. Check the identifier, or start
          from the command centre.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/command-center"
            className="inline-flex h-9 items-center rounded-[4px] bg-[#101216] px-4 text-[13px] font-medium text-white hover:bg-[#23272e]"
          >
            Command Center
          </Link>
          <Link
            href="/audit"
            className="inline-flex h-9 items-center rounded-[4px] border border-line-strong px-4 text-[13px] font-medium text-ink hover:bg-raised"
          >
            Audit trail
          </Link>
        </div>
      </div>
    </div>
  );
}
