import type { ReactNode } from "react";

export function Section({
  title,
  badge,
  description,
  testid,
  children,
}: {
  title: string;
  badge: "Tailwind" | "Emotion";
  description: string;
  testid: string;
  children: ReactNode;
}) {
  return (
    <section
      data-testid={testid}
      className="rounded-token border border-border bg-surface p-5 shadow-token"
    >
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
          Styled with {badge}
        </span>
      </div>
      <p className="mb-4 text-sm text-muted">{description}</p>
      {children}
    </section>
  );
}
