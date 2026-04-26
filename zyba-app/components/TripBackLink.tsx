import Link from "next/link";
import type { MouseEventHandler } from "react";

type TripBackLinkProps = {
  href: string;
  label?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  ariaDisabled?: boolean;
};

export default function TripBackLink({
  href,
  label = "Back to trip details",
  className = "trip-back-link",
  onClick,
  ariaDisabled,
}: TripBackLinkProps) {
  return (
    <Link href={href} className={className} onClick={onClick} aria-disabled={ariaDisabled}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="trip-back-icon"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 5.5 8 12l6.5 6.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12H20" />
      </svg>
      <span className="trip-back-label">{label}</span>
    </Link>
  );
}
