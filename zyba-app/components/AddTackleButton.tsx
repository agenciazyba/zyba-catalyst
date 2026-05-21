"use client";

import type { ButtonHTMLAttributes } from "react";

export type AddTackleButtonState = "idle" | "adding" | "added";

type AddTackleButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  state?: AddTackleButtonState;
  className?: string;
};

export default function AddTackleButton({
  state = "idle",
  className = "",
  disabled,
  type = "button",
  ...props
}: AddTackleButtonProps) {
  const label = state === "adding" ? "ADDING" : state === "added" ? "ADDED" : "ADD TO TACKLE BOX";
  const classes = ["add-tackle-button", `is-${state}`, className].filter(Boolean).join(" ");

  return (
    <button type={type} className={classes} disabled={disabled || state !== "idle"} {...props}>
      {label}
    </button>
  );
}
