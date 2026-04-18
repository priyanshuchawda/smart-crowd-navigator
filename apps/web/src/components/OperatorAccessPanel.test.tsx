import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OperatorAccessPanel } from "./OperatorAccessPanel";

afterEach(() => {
  cleanup();
});

describe("OperatorAccessPanel", () => {
  it("renders operator access controls and optional error message", () => {
    render(
      <OperatorAccessPanel
        email=""
        errorMessage="Sign-in failed"
        isSubmitting={false}
        onEmailChange={vi.fn()}
        onGoogleSignIn={vi.fn()}
        onPasswordChange={vi.fn()}
        onSubmit={vi.fn()}
        password=""
      />,
    );

    expect(
      screen.getByRole("region", { name: /Operator access/i }),
    ).toBeVisible();
    expect(screen.getByText("Operator Access")).toBeVisible();
    expect(screen.getByText("Restricted")).toBeVisible();
    expect(screen.getByText("Sign-in failed")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Sign in with Google" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Email")).toBeVisible();
    expect(screen.getByLabelText("Password")).toBeVisible();
  });

  it("wires input and action callbacks", async () => {
    const onEmailChange = vi.fn();
    const onGoogleSignIn = vi.fn();
    const onPasswordChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <OperatorAccessPanel
        email=""
        errorMessage={null}
        isSubmitting={false}
        onEmailChange={onEmailChange}
        onGoogleSignIn={onGoogleSignIn}
        onPasswordChange={onPasswordChange}
        onSubmit={onSubmit}
        password=""
      />,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "operator@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Sign In as Operator" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Sign in with Google" }),
    );

    expect(onEmailChange).toHaveBeenCalled();
    expect(onEmailChange).toHaveBeenLastCalledWith("operator@example.com");
    expect(onPasswordChange).toHaveBeenCalled();
    expect(onPasswordChange).toHaveBeenLastCalledWith("correct-horse");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onGoogleSignIn).toHaveBeenCalledTimes(1);
  });

  it("hides google sign-in controls when callback is not provided", () => {
    render(
      <OperatorAccessPanel
        email="operator@example.com"
        errorMessage={null}
        isSubmitting={true}
        onEmailChange={vi.fn()}
        onPasswordChange={vi.fn()}
        onSubmit={vi.fn()}
        password="secret"
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Sign in with Google" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Signing in/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Sign In as Operator" }),
    ).toBeDisabled();
  });
});
