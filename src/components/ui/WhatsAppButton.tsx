import type { ReactNode } from "react";

export function WhatsAppButton({
  href,
  children,
  floating = false,
  testId,
}: {
  href: string;
  children: ReactNode;
  floating?: boolean;
  testId?: string;
}) {
  return (
    <a className={floating ? "btn btn-whatsapp float" : "btn btn-whatsapp"} href={href} target="_blank" rel="noreferrer" data-testid={testId}>
      <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          d="M12 3.2a8.6 8.6 0 0 0-7.4 13l-1.2 4.4 4.5-1.2A8.6 8.6 0 1 0 12 3.2z"
        />
        <path
          fill="currentColor"
          d="M9.1 7.6c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.6 1 1.4 1.8 2.5 2.4.2.1.4.1.5 0l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.4.2.4.4 0 .6-.2 1.2-.7 1.6-.5.4-1.2.6-1.9.4-1.7-.4-3.2-1.4-4.3-2.7-.9-1-1.6-2.2-1.6-3.5 0-.8.4-1.4.9-1.8.2-.2.5-.3.8-.3z"
        />
      </svg>
      <span>{children}</span>
    </a>
  );
}
