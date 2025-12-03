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
        applying={false}
      />
    );
    expect(screen.getByText("Since Sample Label")).toBeTruthy();
  });
});
