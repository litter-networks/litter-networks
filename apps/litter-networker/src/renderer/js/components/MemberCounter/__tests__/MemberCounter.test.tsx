// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import MemberCounter from "../MemberCounter";

describe("MemberCounter", () => {
  it("renders the updated timestamp", () => {
    render(
      <MemberCounter
        inputValue={2}
        onChange={() => {}}
        memberCount={10}
        sinceLabel="Sample Label"
        onApply={() => {}}
        onAdvance={() => {}}
        applying={false}
      />
    );
    expect(screen.getByText("as of Sample Label")).toBeTruthy();
  });
});
