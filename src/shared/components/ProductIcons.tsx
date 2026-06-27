import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

export type ProductIconName =
  | 'user'
  | 'education'
  | 'briefcase'
  | 'settings'
  | 'resume'
  | 'backup'
  | 'scan'
  | 'result'
  | 'qa'
  | 'help'
  | 'database'
  | 'shield'
  | 'spark'
  | 'external';

const paths: Record<ProductIconName, ReactNode> = {
  user: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c.8-3.2 3-4.8 6.5-4.8s5.7 1.6 6.5 4.8" />
    </>
  ),
  education: (
    <>
      <path d="m3.5 8.2 8.5-3.7 8.5 3.7-8.5 3.7-8.5-3.7Z" />
      <path d="M7 10v4.5c1.4 1.2 3.1 1.8 5 1.8s3.6-.6 5-1.8V10" />
      <path d="M20.5 8.4v5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="4" y="7" width="16" height="11" rx="2" />
      <path d="M9 7V5.8c0-1 .8-1.8 1.8-1.8h2.4c1 0 1.8.8 1.8 1.8V7" />
      <path d="M4 12h16" />
      <path d="M10.2 12v1.3h3.6V12" />
    </>
  ),
  settings: (
    <>
      <path d="M12 8.1a3.9 3.9 0 1 0 0 7.8 3.9 3.9 0 0 0 0-7.8Z" />
      <path d="M18.6 13.3c.1-.4.1-.9.1-1.3s0-.9-.1-1.3l2-1.4-2-3.4-2.3 1a7.2 7.2 0 0 0-2.2-1.3L13.8 3h-3.6l-.4 2.6c-.8.3-1.5.7-2.2 1.3l-2.3-1-2 3.4 2 1.4c-.1.4-.1.9-.1 1.3s0 .9.1 1.3l-2 1.4 2 3.4 2.3-1c.7.6 1.4 1 2.2 1.3l.4 2.6h3.6l.4-2.6c.8-.3 1.5-.7 2.2-1.3l2.3 1 2-3.4-2.1-1.4Z" />
    </>
  ),
  resume: (
    <>
      <path d="M7 3.5h7l3 3V20H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" />
      <path d="M14 3.5V7h3.5" />
      <path d="M8.5 11h7" />
      <path d="M8.5 14h7" />
      <path d="M8.5 17h4.5" />
    </>
  ),
  backup: (
    <>
      <path d="M6 8.5A5.5 5.5 0 0 1 16.4 6" />
      <path d="M17.5 4.2v3.5H14" />
      <path d="M18 15.5A5.5 5.5 0 0 1 7.6 18" />
      <path d="M6.5 19.8v-3.5H10" />
      <path d="M10 12h4" />
    </>
  ),
  scan: (
    <>
      <path d="M5 8V5h3" />
      <path d="M16 5h3v3" />
      <path d="M19 16v3h-3" />
      <path d="M8 19H5v-3" />
      <path d="M7 12h10" />
      <path d="M9 9.5h6" />
      <path d="M9 14.5h4" />
    </>
  ),
  result: (
    <>
      <path d="M5 5.5h14" />
      <path d="M5 12h14" />
      <path d="M5 18.5h14" />
      <path d="m8 9 2 2 4-4" />
      <path d="m8 15.5 2 2 4-4" />
    </>
  ),
  qa: (
    <>
      <path d="M5.5 6.2A5.5 5.5 0 0 1 11 3h2a5.5 5.5 0 0 1 2 10.6L12 17H9.5A5.5 5.5 0 0 1 5.5 6.2Z" />
      <path d="M10 8.6a2 2 0 1 1 3.2 1.6c-.6.5-1.2.9-1.2 1.8" />
      <path d="M12 15h.01" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.8 9.2a2.4 2.4 0 1 1 3.3 2.2c-.7.4-1.1 1-1.1 1.8" />
      <path d="M12 16.7h.01" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="6.5" ry="3" />
      <path d="M5.5 6v6c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3V6" />
      <path d="M5.5 12v5.5c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3V12" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 18.5 6v5.3c0 4-2.6 7.4-6.5 9.2-3.9-1.8-6.5-5.2-6.5-9.2V6L12 3.5Z" />
      <path d="m9.2 12.2 1.8 1.8 3.8-4" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3.8 13.6 9l4.8 1.6-4.8 1.8L12 20.2l-1.6-7.8-4.8-1.8L10.4 9 12 3.8Z" />
      <path d="M18 4.5v3" />
      <path d="M19.5 6h-3" />
    </>
  ),
  external: (
    <>
      <path d="M14 5h5v5" />
      <path d="m13 11 6-6" />
      <path d="M19 14v3.5c0 .9-.7 1.5-1.5 1.5h-11C5.7 19 5 18.4 5 17.5v-11C5 5.7 5.7 5 6.5 5H10" />
    </>
  ),
};

export function ProductIcon({ title, className, children, ...props }: IconProps & { name: ProductIconName }) {
  const { name, ...svgProps } = props as IconProps & { name: ProductIconName };

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...svgProps}
    >
      {title && <title>{title}</title>}
      {paths[name]}
      {children}
    </svg>
  );
}

export function BrandMark({ title, className, ...props }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...props}
    >
      {title && <title>{title}</title>}
      <rect x="6" y="6" width="52" height="52" rx="14" fill="currentColor" />
      <path
        d="M18 20.5c0-2.5 2-4.5 4.5-4.5h10.8c7 0 12.7 5.7 12.7 12.7v14.8"
        stroke="var(--ca-text-on-strong)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M18 43.5V30.8c0-2.7 2.2-4.8 4.8-4.8H35"
        stroke="var(--ca-text-on-strong)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M27 43.5h18"
        stroke="var(--ca-text-on-strong)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="45" cy="20" r="4" fill="var(--ca-accent)" />
    </svg>
  );
}
