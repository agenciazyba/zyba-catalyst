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
  label = "Return",
  className = "trip-back-link",
  onClick,
  ariaDisabled,
}: TripBackLinkProps) {
  return (
    <Link href={href} className={className} onClick={onClick} aria-disabled={ariaDisabled} aria-label={label}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.5}
        className="trip-back-icon"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 4.5 7.5 12l8 7.5" />
      </svg>
    </Link>
  );
}
