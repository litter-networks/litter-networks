// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import CloudfrontInvalidation from "../CloudfrontInvalidation";

describe("CloudfrontInvalidation", () => {
  it("runs invalidation and shows spinner while active", async () => {
    let resolve: (() => void) | null = null;
    const promise = new Promise<void>((res) => {
      resolve = res;
    });
    const onInvalidate = vi.fn(() => promise);

    render(<CloudfrontInvalidation onInvalidate={onInvalidate} />);

    const button = screen.getByRole("button", { name: /Web \/ API/i });
    fireEvent.click(button);

    expect(onInvalidate).toHaveBeenCalledWith("E38XGOGM7XNRC5");
    expect(button.disabled).toBe(true);
    expect(screen.getByText("...")).toBeTruthy();

    resolve?.();
    await waitFor(() => expect(button.disabled).toBe(false));
    await waitFor(() => expect(screen.queryByText("...")).toBeNull());
  });
});
