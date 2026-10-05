"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

type ControlProps = {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  const generatedId = useId();
  const control = isValidElement<ControlProps>(children) ? (children as ReactElement<ControlProps>) : null;
  const controlId = control?.props.id ?? generatedId;
  const errorId = error ? `${controlId}-error` : undefined;
  const rendered = control
    ? cloneElement(control, {
        id: controlId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : control.props["aria-describedby"],
      })
    : children;
  return (
    <div className="field">
      <label htmlFor={control ? controlId : undefined}>
        <span>{label}</span>
        {rendered}
      </label>
      {error ? (
        <p className="error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
