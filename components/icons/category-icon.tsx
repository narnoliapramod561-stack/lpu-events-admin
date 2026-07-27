type CategoryIconProps = {
  name: string | null | undefined;
  className?: string;
};

function iconForName(name: string | null | undefined) {
  switch (name) {
    case 'Laptop':
      return (
        <path
          d="M5 7.75A1.75 1.75 0 0 1 6.75 6h10.5A1.75 1.75 0 0 1 19 7.75v6.5H5v-6.5Zm-1 8h16.5l-.75 2.25A1.5 1.5 0 0 1 18.33 19H5.67a1.5 1.5 0 0 1-1.42-1L3.5 15.75Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      );
    case 'FlaskConical':
      return (
        <path
          d="M10 4h4m-2 0v4.2l4.75 8.05A1.9 1.9 0 0 1 15.1 19H8.9a1.9 1.9 0 0 1-1.65-2.75L12 8.2M9.2 14h5.6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      );
    case 'Music4':
      return (
        <path
          d="M14 5v9.5a2.5 2.5 0 1 1-1.5-2.29V7.5l6-1.5v7.5a2.5 2.5 0 1 1-1.5-2.29V4.5L14 5Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      );
    case 'BriefcaseBusiness':
      return (
        <path
          d="M9 7V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1m-10 2h14a2 2 0 0 1 2 2v5.5A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5V11a2 2 0 0 1 2-2Zm5 4h4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      );
    case 'Presentation':
      return (
        <path
          d="M5 5.5h14M12 5.5v8m0 0 3 4.5M12 13.5 9 18m-4-6h14"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      );
    case 'Users':
      return (
        <path
          d="M15.5 19v-1a3.5 3.5 0 0 0-7 0v1m9.5 0v-1a3 3 0 0 0-2-2.83M6 15.17A3 3 0 0 0 4 18v1m8-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-1.5a2.5 2.5 0 1 0-1.72-4.31M6 9.5a2.5 2.5 0 1 1 1.72-4.31"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      );
    case 'Dumbbell':
      return (
        <path
          d="M4.5 9.5v5m3-7v9m9-9v9m3-7v5M7.5 12h9"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      );
    case 'Wrench':
      return (
        <path
          d="M14.5 5.5a3.5 3.5 0 0 0 4.02 4.54l-7.78 7.79a2 2 0 0 1-2.83-2.83l7.79-7.78A3.5 3.5 0 0 0 14.5 5.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      );
    default:
      return (
        <path
          d="M12 3.5 18.5 7v10L12 20.5 5.5 17V7L12 3.5Zm0 4.25v4.5m0 3.25h.01"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      );
  }
}

export function CategoryIcon({ name, className }: CategoryIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {iconForName(name)}
    </svg>
  );
}
