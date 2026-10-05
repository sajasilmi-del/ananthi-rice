import type { ReactNode } from "react";

export type IconName = "leaf" | "tag" | "truck" | "chat" | "pin" | "phone" | "mail" | "user";

export function LineIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    leaf: (
      <>
        <path d="M12 21V10" />
        <path d="M12 10c0-4 2.5-6.5 6.5-7-.3 4.2-2.6 6.8-6.5 7z" />
        <path d="M12 14c0-3.4-2.2-5.6-5.8-6 .3 3.6 2.3 5.7 5.8 6z" />
      </>
    ),
    tag: (
      <>
        <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z" />
        <circle cx="8" cy="8" r="1.4" />
      </>
    ),
    truck: (
      <>
        <path d="M2.5 6.5h11v9h-11z" />
        <path d="M13.5 9.5h4l3 3.2v2.8h-7" />
        <circle cx="6.5" cy="17" r="1.8" />
        <circle cx="17" cy="17" r="1.8" />
      </>
    ),
    chat: (
      <>
        <path d="M4 18.5 5.3 15A7.5 7.5 0 1 1 8.6 18z" />
        <path d="M9 10.5h6M9 13h4" />
      </>
    ),
    phone: <path d="M6.6 3.5h2.6l1.4 4-2 1.4a11 11 0 0 0 6.5 6.5l1.4-2 4 1.4v2.6a1.6 1.6 0 0 1-1.7 1.6A16.6 16.6 0 0 1 5 5.2a1.6 1.6 0 0 1 1.6-1.7z" />,
    mail: (
      <>
        <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
        <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8.5" r="3.6" />
        <path d="M4.8 20c.9-3.6 3.7-5.6 7.2-5.6s6.3 2 7.2 5.6" />
      </>
    ),
    pin: (
      <>
        <path d="M12 21s-6.5-6.3-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.7 12 21 12 21z" />
        <circle cx="12" cy="9.8" r="2.3" />
      </>
    ),
  };
  return (
    <svg className="line-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}
