// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "../ErrorBoundary";

const Boom = () => {
  throw new Error("boom");
};

describe("ErrorBoundary", () => {
  it("renders fallback when child throws", () => {
    render(
      <ErrorBoundary name="Test Widget">
        <Boom />
      </ErrorBoundary>
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Test Widget failed to load.");
    expect(alert.textContent).toContain("boom");
  });

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary name="Safe Widget">
        <div>hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("hello")).toBeTruthy();
  });
});
