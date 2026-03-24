/**
 * @title React Submit Button — Comprehensive Test Suite
 * @notice Covers label safety, state transitions, interaction blocking,
 *         accessibility attributes, and component rendering.
 * @dev Targets ≥ 95% coverage of react_submit_button.tsx.
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ReactSubmitButton, {
  ALLOWED_TRANSITIONS,
  isSubmitButtonBusy,
  isSubmitButtonInteractionBlocked,
  isValidSubmitButtonStateTransition,
  normalizeSubmitButtonLabel,
  resolveSubmitButtonLabel,
  resolveSafeSubmitButtonState,
  type ReactSubmitButtonProps,
 * @title React Submit Button Tests
 * @notice Validates state transitions, accessibility flags, and security-aware label handling.
 */
import {
  isSubmitButtonBusy,
  isSubmitButtonDisabled,
  resolveSubmitButtonLabel,
  type SubmitButtonLabels,
  type SubmitButtonState,
} from "./react_submit_button";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderBtn(props: Partial<ReactSubmitButtonProps> = {}) {
  const { container } = render(<ReactSubmitButton state="idle" {...props} />);
  return container.querySelector("button") as HTMLButtonElement;
}

const ALL_STATES: SubmitButtonState[] = ["idle", "submitting", "success", "error", "disabled"];

// ── normalizeSubmitButtonLabel ────────────────────────────────────────────────

describe("normalizeSubmitButtonLabel", () => {
  it("returns fallback for non-string values", () => {
    expect(normalizeSubmitButtonLabel(undefined, "Submit")).toBe("Submit");
    expect(normalizeSubmitButtonLabel(null, "Submit")).toBe("Submit");
    expect(normalizeSubmitButtonLabel(404, "Submit")).toBe("Submit");
    expect(normalizeSubmitButtonLabel({}, "Submit")).toBe("Submit");
    expect(normalizeSubmitButtonLabel(true, "Submit")).toBe("Submit");
  });

  it("returns fallback for empty or whitespace-only strings", () => {
    expect(normalizeSubmitButtonLabel("", "Submit")).toBe("Submit");
    expect(normalizeSubmitButtonLabel("   ", "Submit")).toBe("Submit");
    expect(normalizeSubmitButtonLabel("\n\t", "Submit")).toBe("Submit");
  });

  it("strips control characters and normalizes whitespace", () => {
    expect(normalizeSubmitButtonLabel("Pay\u0000Now", "Submit")).toBe("Pay Now");
    expect(normalizeSubmitButtonLabel("Pay\u0008\u001FNow", "Submit")).toBe("Pay Now");
    expect(normalizeSubmitButtonLabel("Pay   \n   Now", "Submit")).toBe("Pay Now");
  });

  it("returns the label unchanged when within the 80-char limit", () => {
    const label = "A".repeat(80);
    expect(normalizeSubmitButtonLabel(label, "Submit")).toBe(label);
  });

  it("truncates labels exceeding 80 characters with ellipsis", () => {
    const long = "A".repeat(200);
    const result = normalizeSubmitButtonLabel(long, "Submit");
    expect(result).toHaveLength(80);
    expect(result.endsWith("...")).toBe(true);
  });

  it("preserves hostile markup-like text as a plain string", () => {
    const xss = "<img src=x onerror=alert(1) />";
    // Security: React renders this as text, not HTML.
    expect(normalizeSubmitButtonLabel(xss, "Submit")).toBe(xss);
  });
});

// ── resolveSubmitButtonLabel ──────────────────────────────────────────────────

describe("resolveSubmitButtonLabel", () => {
  it("returns correct defaults for every state", () => {
    const expected = ["Submit", "Submitting...", "Submitted", "Try Again", "Submit Disabled"];
    expect(ALL_STATES.map((s) => resolveSubmitButtonLabel(s))).toEqual(expected);
  });

  it("uses valid custom labels", () => {
    const labels: SubmitButtonLabels = {
      idle: "Fund Campaign",
      submitting: "Funding...",
      success: "Funded!",
      error: "Retry",
      disabled: "Locked",
    };
    ALL_STATES.forEach((s) => {
      expect(resolveSubmitButtonLabel(s, labels)).toBe(labels[s]);
    });
  });

  it("falls back to defaults for empty or whitespace custom labels", () => {
    const labels: SubmitButtonLabels = { idle: "", submitting: "   " };
describe("resolveSubmitButtonLabel", () => {
  it("returns default labels for every known state", () => {
    const states: SubmitButtonState[] = ["idle", "submitting", "success", "error", "disabled"];
    const output = states.map((state) => resolveSubmitButtonLabel(state));

    expect(output).toEqual(["Submit", "Submitting...", "Submitted", "Try Again", "Submit Disabled"]);
  });

  it("uses custom labels when valid", () => {
    const labels: SubmitButtonLabels = {
      idle: "Send Now",
      submitting: "Please wait",
      success: "Done",
      error: "Retry",
      disabled: "Locked",
    };

    expect(resolveSubmitButtonLabel("idle", labels)).toBe("Send Now");
    expect(resolveSubmitButtonLabel("submitting", labels)).toBe("Please wait");
    expect(resolveSubmitButtonLabel("success", labels)).toBe("Done");
    expect(resolveSubmitButtonLabel("error", labels)).toBe("Retry");
    expect(resolveSubmitButtonLabel("disabled", labels)).toBe("Locked");
  });

  it("falls back to defaults for empty or whitespace labels", () => {
    const labels: SubmitButtonLabels = {
      idle: "",
      submitting: "   ",
    };

    expect(resolveSubmitButtonLabel("idle", labels)).toBe("Submit");
    expect(resolveSubmitButtonLabel("submitting", labels)).toBe("Submitting...");
  });

  it("trims and truncates oversized custom labels", () => {
    const labels: SubmitButtonLabels = { success: `   ${"A".repeat(90)}   ` };
    const result = resolveSubmitButtonLabel("success", labels);
    expect(result).toHaveLength(80);
    expect(result.endsWith("...")).toBe(true);
  });
});

// ── isValidSubmitButtonStateTransition ───────────────────────────────────────

describe("isValidSubmitButtonStateTransition", () => {
  it("allows all transitions defined in ALLOWED_TRANSITIONS", () => {
    for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS) as [SubmitButtonState, SubmitButtonState[]][]) {
      for (const to of targets) {
        expect(isValidSubmitButtonStateTransition(from, to)).toBe(true);
      }
    }
  });

  it("allows same-state transitions (idempotent)", () => {
    ALL_STATES.forEach((s) => {
      expect(isValidSubmitButtonStateTransition(s, s)).toBe(true);
    });
  });

  it("blocks transitions not in the allowed map", () => {
    expect(isValidSubmitButtonStateTransition("idle", "success")).toBe(false);
    expect(isValidSubmitButtonStateTransition("idle", "error")).toBe(false);
    expect(isValidSubmitButtonStateTransition("success", "error")).toBe(false);
    expect(isValidSubmitButtonStateTransition("success", "submitting")).toBe(false);
    expect(isValidSubmitButtonStateTransition("disabled", "submitting")).toBe(false);
    expect(isValidSubmitButtonStateTransition("disabled", "success")).toBe(false);
  });
});

// ── resolveSafeSubmitButtonState ─────────────────────────────────────────────

describe("resolveSafeSubmitButtonState", () => {
  it("returns requested state when transition is valid (strict)", () => {
    expect(resolveSafeSubmitButtonState("submitting", "idle", true)).toBe("submitting");
    expect(resolveSafeSubmitButtonState("success", "submitting", true)).toBe("success");
    expect(resolveSafeSubmitButtonState("error", "submitting", true)).toBe("error");
  });

  it("falls back to previousState for invalid transitions in strict mode", () => {
    expect(resolveSafeSubmitButtonState("success", "idle", true)).toBe("idle");
    expect(resolveSafeSubmitButtonState("error", "success", true)).toBe("success");
    expect(resolveSafeSubmitButtonState("submitting", "disabled", true)).toBe("disabled");
  });

  it("accepts any state when strict mode is disabled", () => {
    expect(resolveSafeSubmitButtonState("success", "idle", false)).toBe("success");
    expect(resolveSafeSubmitButtonState("error", "success", false)).toBe("error");
  });

  it("accepts requested state when previousState is absent", () => {
    expect(resolveSafeSubmitButtonState("error", undefined, true)).toBe("error");
    expect(resolveSafeSubmitButtonState("success", undefined, true)).toBe("success");
  });

  it("defaults strictTransitions to true", () => {
    // idle → success is invalid; should fall back to idle
    expect(resolveSafeSubmitButtonState("success", "idle")).toBe("idle");
  });
});

// ── isSubmitButtonInteractionBlocked ─────────────────────────────────────────

describe("isSubmitButtonInteractionBlocked", () => {
  it("blocks interaction for submitting and disabled states", () => {
    expect(isSubmitButtonInteractionBlocked("submitting")).toBe(true);
    expect(isSubmitButtonInteractionBlocked("disabled")).toBe(true);
  });

  it("blocks when explicit disabled flag is set", () => {
    expect(isSubmitButtonInteractionBlocked("idle", true)).toBe(true);
    expect(isSubmitButtonInteractionBlocked("error", true)).toBe(true);
  });

  it("blocks when locally submitting", () => {
    expect(isSubmitButtonInteractionBlocked("idle", false, true)).toBe(true);
  });

  it("allows interaction for active states with no flags", () => {
    expect(isSubmitButtonInteractionBlocked("idle", false, false)).toBe(false);
    expect(isSubmitButtonInteractionBlocked("error", false, false)).toBe(false);
    expect(isSubmitButtonInteractionBlocked("success", false, false)).toBe(false);
  });
});

// ── isSubmitButtonBusy ────────────────────────────────────────────────────────

describe("isSubmitButtonBusy", () => {
  it("is true only while submitting", () => {
    expect(isSubmitButtonBusy("submitting")).toBe(true);
  });

  it("is true when locally submitting regardless of state", () => {
    expect(isSubmitButtonBusy("idle", true)).toBe(true);
    expect(isSubmitButtonBusy("error", true)).toBe(true);
  });

  it("is false for all non-submitting states with no local flag", () => {
    const nonSubmitting: SubmitButtonState[] = ["idle", "success", "error", "disabled"];
    nonSubmitting.forEach((s) => {
      expect(isSubmitButtonBusy(s, false)).toBe(false);
    });
  });
});

// ── ReactSubmitButton — rendering ────────────────────────────────────────────

describe("ReactSubmitButton rendering", () => {
  it("renders a button element", () => {
    const btn = renderBtn();
    expect(btn.tagName).toBe("BUTTON");
  });

  it("displays the resolved label as text content", () => {
    renderBtn({ state: "idle" });
    expect(screen.getByText("Submit")).toBeTruthy();
  });

  it("displays custom label override", () => {
    renderBtn({ state: "idle", labels: { idle: "Fund Campaign" } });
    expect(screen.getByText("Fund Campaign")).toBeTruthy();
  });

  it("sets data-state to the resolved state", () => {
    ALL_STATES.forEach((s) => {
      const btn = renderBtn({ state: s });
      expect(btn.getAttribute("data-state")).toBe(s);
    });
  });

  it("defaults type to 'button'", () => {
    expect(renderBtn().type).toBe("button");
  });

  it("respects explicit type prop", () => {
    expect(renderBtn({ type: "submit" }).type).toBe("submit");
    expect(renderBtn({ type: "reset" }).type).toBe("reset");
  });

  it("applies custom className", () => {
    const btn = renderBtn({ className: "my-btn" });
    expect(btn.className).toContain("my-btn");
  });

  it("sets the id attribute", () => {
    const btn = renderBtn({ id: "contribute-btn" });
    expect(btn.id).toBe("contribute-btn");
  });
});

// ── ReactSubmitButton — disabled / blocked states ────────────────────────────

describe("ReactSubmitButton disabled behavior", () => {
  it("is disabled in submitting state", () => {
    expect(renderBtn({ state: "submitting" }).disabled).toBe(true);
  });

  it("is disabled in disabled state", () => {
    expect(renderBtn({ state: "disabled" }).disabled).toBe(true);
  });

  it("is disabled when disabled prop is true", () => {
    expect(renderBtn({ disabled: true }).disabled).toBe(true);
  });

  it("is NOT disabled in idle, success, or error states by default", () => {
    expect(renderBtn({ state: "idle" }).disabled).toBe(false);
    expect(renderBtn({ state: "success" }).disabled).toBe(false);
    expect(renderBtn({ state: "error" }).disabled).toBe(false);
  });
});

// ── ReactSubmitButton — accessibility ────────────────────────────────────────

describe("ReactSubmitButton accessibility", () => {
  it("has aria-live='polite'", () => {
    expect(renderBtn().getAttribute("aria-live")).toBe("polite");
  });

  it("sets aria-busy='true' while submitting", () => {
    expect(renderBtn({ state: "submitting" }).getAttribute("aria-busy")).toBe("true");
  });

  it("sets aria-busy='false' for non-submitting states", () => {
    const nonBusy: SubmitButtonState[] = ["idle", "success", "error", "disabled"];
    nonBusy.forEach((s) => {
      expect(renderBtn({ state: s }).getAttribute("aria-busy")).toBe("false");
    });
  });

  it("sets aria-label to the resolved label", () => {
    expect(renderBtn({ state: "idle" }).getAttribute("aria-label")).toBe("Submit");
    expect(renderBtn({ state: "error" }).getAttribute("aria-label")).toBe("Try Again");
  });
});

// ── ReactSubmitButton — click handling ───────────────────────────────────────

describe("ReactSubmitButton click handling", () => {
  it("fires onClick in idle state", async () => {
    const onClick = jest.fn().mockResolvedValue(undefined);
    const { container } = render(<ReactSubmitButton state="idle" onClick={onClick} />);
    const btn = container.querySelector("button") as HTMLButtonElement;
    await act(async () => { fireEvent.click(btn); });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("fires onClick in error state (retry)", async () => {
    const onClick = jest.fn().mockResolvedValue(undefined);
    const { container } = render(<ReactSubmitButton state="error" onClick={onClick} />);
    const btn = container.querySelector("button") as HTMLButtonElement;
    await act(async () => { fireEvent.click(btn); });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire onClick in submitting state", () => {
    const onClick = jest.fn();
    const { container } = render(<ReactSubmitButton state="submitting" onClick={onClick} />);
    const btn = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does NOT fire onClick in disabled state", () => {
    const onClick = jest.fn();
    const { container } = render(<ReactSubmitButton state="disabled" onClick={onClick} />);
    const btn = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does NOT fire onClick when disabled prop is true", () => {
    const onClick = jest.fn();
    const { container } = render(<ReactSubmitButton state="idle" disabled={true} onClick={onClick} />);
    const btn = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("handles async onClick without throwing", async () => {
    const onClick = jest.fn().mockResolvedValue(undefined);
    const { container } = render(<ReactSubmitButton state="idle" onClick={onClick} />);
    const btn = container.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not propagate errors from a rejected async onClick", async () => {
    const onClick = jest.fn().mockRejectedValue(new Error("tx failed"));
    const { container } = render(<ReactSubmitButton state="idle" onClick={onClick} />);
    const btn = container.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(btn);
    });
    // If we reach here without throwing, the component swallowed the rejection correctly.
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// ── ReactSubmitButton — strict transition enforcement ────────────────────────

describe("ReactSubmitButton strict transitions", () => {
  it("renders previousState when transition is invalid in strict mode", () => {
    // idle → success is not allowed; should render idle
    const btn = renderBtn({ state: "success", previousState: "idle", strictTransitions: true });
    expect(btn.getAttribute("data-state")).toBe("idle");
  });

  it("renders requested state when transition is valid in strict mode", () => {
    const btn = renderBtn({ state: "submitting", previousState: "idle", strictTransitions: true });
    expect(btn.getAttribute("data-state")).toBe("submitting");
  });

  it("renders requested state when strict mode is disabled", () => {
    const btn = renderBtn({ state: "success", previousState: "idle", strictTransitions: false });
    expect(btn.getAttribute("data-state")).toBe("success");
  it("trims custom labels and limits overly long labels", () => {
    const veryLongLabel = `${"A".repeat(90)} trailing text`;
    const labels: SubmitButtonLabels = {
      success: `   ${veryLongLabel}   `,
    };

    const resolved = resolveSubmitButtonLabel("success", labels);
    expect(resolved.length).toBe(80);
    expect(resolved.endsWith("...")).toBe(true);
  });

  it("keeps potentially hostile text as plain label content", () => {
    const hostile = "<img src=x onerror=alert(1) />";
    const labels: SubmitButtonLabels = { error: hostile };

    // Security note: React renders strings as text, not executable HTML.
    expect(resolveSubmitButtonLabel("error", labels)).toBe(hostile);
  });
});

describe("isSubmitButtonDisabled", () => {
  it("returns true for submitting and disabled states", () => {
    expect(isSubmitButtonDisabled("submitting")).toBe(true);
    expect(isSubmitButtonDisabled("disabled")).toBe(true);
  });

  it("returns false for active states when disabled flag is not set", () => {
    expect(isSubmitButtonDisabled("idle")).toBe(false);
    expect(isSubmitButtonDisabled("success")).toBe(false);
    expect(isSubmitButtonDisabled("error")).toBe(false);
  });

  it("respects explicit disabled override", () => {
    expect(isSubmitButtonDisabled("idle", true)).toBe(true);
    expect(isSubmitButtonDisabled("success", true)).toBe(true);
  });
});

describe("isSubmitButtonBusy", () => {
  it("is true only while submitting", () => {
    expect(isSubmitButtonBusy("submitting")).toBe(true);
    expect(isSubmitButtonBusy("idle")).toBe(false);
    expect(isSubmitButtonBusy("success")).toBe(false);
    expect(isSubmitButtonBusy("error")).toBe(false);
    expect(isSubmitButtonBusy("disabled")).toBe(false);
 * @title React Submit Button Component Tests
 * @notice Comprehensive tests for standardized submit button states.
 * @dev Covers idle, loading, disabled, variants, accessibility, and security.
 */

/// <reference types="@testing-library/jest-dom" />

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ReactSubmitButton, {
  type SubmitButtonVariant,
  type SubmitButtonState,
} from "./react_submit_button";

describe("ReactSubmitButton", () => {
  describe("rendering and states", () => {
    it("renders with default label", () => {
      render(<ReactSubmitButton>Submit</ReactSubmitButton>);
      expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
    });

    it("renders idle state by default", () => {
      render(<ReactSubmitButton>Save</ReactSubmitButton>);
      const btn = screen.getByRole("button");
      expect(btn).not.toBeDisabled();
      expect(btn).toHaveAttribute("aria-busy", "false");
      expect(btn).toHaveTextContent("Save");
      expect(btn).not.toHaveTextContent("Loading");
    });

    it("renders loading state when isLoading is true", () => {
      render(
        <ReactSubmitButton isLoading>
          Submit
        </ReactSubmitButton>
      );
      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-busy", "true");
      expect(btn).toHaveTextContent("Loading...");
      expect(btn.querySelector(".btn__spinner")).toBeInTheDocument();
    });

    it("renders custom loadingLabel when isLoading", () => {
      render(
        <ReactSubmitButton isLoading loadingLabel="Saving...">
          Save
        </ReactSubmitButton>
      );
      expect(screen.getByRole("button")).toHaveTextContent("Saving...");
    });

    it("renders disabled state when disabled is true", () => {
      render(<ReactSubmitButton disabled>Submit</ReactSubmitButton>);
      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-disabled", "true");
    });

    it("is disabled when both disabled and isLoading", () => {
      render(
        <ReactSubmitButton disabled isLoading>
          Submit
        </ReactSubmitButton>
      );
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  describe("variants", () => {
    const variants: SubmitButtonVariant[] = [
      "primary",
      "secondary",
      "danger",
      "outline",
    ];

    variants.forEach((variant) => {
      it(`applies ${variant} variant class`, () => {
        render(
          <ReactSubmitButton variant={variant}>Submit</ReactSubmitButton>
        );
        const btn = screen.getByRole("button");
        expect(btn).toHaveClass("btn");
        expect(btn).toHaveClass(`btn--${variant}`);
      });
    });
  });

  describe("fullWidth", () => {
    it("applies btn--full when fullWidth is true", () => {
      render(<ReactSubmitButton fullWidth>Submit</ReactSubmitButton>);
      expect(screen.getByRole("button")).toHaveClass("btn--full");
    });

    it("does not apply btn--full when fullWidth is false", () => {
      render(<ReactSubmitButton>Submit</ReactSubmitButton>);
      expect(screen.getByRole("button")).not.toHaveClass("btn--full");
    });
  });

  describe("DOM attributes", () => {
    it("renders type=submit", () => {
      render(<ReactSubmitButton>Submit</ReactSubmitButton>);
      expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
    });

    it("associates with form when form prop is provided", () => {
      render(
        <>
          <form id="test-form" data-testid="form" />
          <ReactSubmitButton form="test-form">Submit</ReactSubmitButton>
        </>
      );
      expect(screen.getByRole("button")).toHaveAttribute("form", "test-form");
    });

    it("passes through data-testid", () => {
      render(
        <ReactSubmitButton data-testid="custom-submit">Submit</ReactSubmitButton>
      );
      expect(screen.getByTestId("custom-submit")).toBeInTheDocument();
    });

    it("merges custom className", () => {
      render(
        <ReactSubmitButton className="custom-class">Submit</ReactSubmitButton>
      );
      const btn = screen.getByRole("button");
      expect(btn).toHaveClass("custom-class");
      expect(btn).toHaveClass("btn");
    });
  });

  describe("click behavior", () => {
    it("calls onClick when clicked in idle state", async () => {
      const handleClick = jest.fn();
      render(<ReactSubmitButton onClick={handleClick}>Submit</ReactSubmitButton>);
      await userEvent.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled", async () => {
      const handleClick = jest.fn();
      render(
        <ReactSubmitButton disabled onClick={handleClick}>
          Submit
        </ReactSubmitButton>
      );
      const btn = screen.getByRole("button");
      await userEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("does not call onClick when isLoading", async () => {
      const handleClick = jest.fn();
      render(
        <ReactSubmitButton isLoading onClick={handleClick}>
          Submit
        </ReactSubmitButton>
      );
      const btn = screen.getByRole("button");
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("does not call onClick when disabled and clicked", () => {
      const handleClick = jest.fn();
      render(
        <ReactSubmitButton disabled onClick={handleClick}>
          Submit
        </ReactSubmitButton>
      );
      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).not.toHaveBeenCalled();
    });

  });

  describe("accessibility", () => {
    it("has role=status on spinner when loading", () => {
      const { container } = render(
        <ReactSubmitButton isLoading>Submit</ReactSubmitButton>
      );
      const spinner = container.querySelector(".btn__spinner");
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute("role", "status");
    });

    it("has aria-busy=true when loading", () => {
      render(<ReactSubmitButton isLoading>Submit</ReactSubmitButton>);
      expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    });

    it("allows aria-busy override", () => {
      render(
        <ReactSubmitButton aria-busy={true}>Submit</ReactSubmitButton>
      );
      expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("security and edge cases", () => {
    it("renders safe string children", () => {
      render(<ReactSubmitButton>Submit Form</ReactSubmitButton>);
      expect(screen.getByRole("button")).toHaveTextContent("Submit Form");
    });

    it("renders numeric children", () => {
      render(<ReactSubmitButton>{42}</ReactSubmitButton>);
      expect(screen.getByRole("button")).toHaveTextContent("42");
    });

    it("always renders type=submit for form semantics", () => {
      render(<ReactSubmitButton>Submit</ReactSubmitButton>);
      expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
    });

    it("disabled from rest props is overridden by component logic when isLoading", () => {
      render(
        <ReactSubmitButton disabled={false} isLoading>
          Submit
        </ReactSubmitButton>
      );
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  describe("state transitions", () => {
    it("transitions from idle to loading", () => {
      const { rerender } = render(<ReactSubmitButton>Submit</ReactSubmitButton>);
      expect(screen.getByRole("button")).not.toBeDisabled();

      rerender(<ReactSubmitButton isLoading>Submit</ReactSubmitButton>);
      expect(screen.getByRole("button")).toBeDisabled();
      expect(screen.getByRole("button")).toHaveTextContent("Loading...");
    });

    it("transitions from loading to idle", () => {
      const { rerender } = render(
        <ReactSubmitButton isLoading>Submit</ReactSubmitButton>
      );
      expect(screen.getByRole("button")).toBeDisabled();

      rerender(<ReactSubmitButton>Submit</ReactSubmitButton>);
      expect(screen.getByRole("button")).not.toBeDisabled();
      expect(screen.getByRole("button")).toHaveTextContent("Submit");
    });
  });
});

describe("SubmitButtonState type", () => {
  it("has expected state values for type checking", () => {
    const states: SubmitButtonState[] = ["idle", "loading", "disabled"];
    expect(states).toContain("idle");
    expect(states).toContain("loading");
    expect(states).toContain("disabled");
  });
});
