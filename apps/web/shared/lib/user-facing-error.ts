export type UserFacingErrorCategory =
  | "network"
  | "validation"
  | "permission"
  | "authentication"
  | "conflict"
  | "not_found"
  | "provider"
  | "unexpected";

export type UserFacingError = {
  category: UserFacingErrorCategory;
  title: string;
  message: string;
  actionLabel?: string;
  actionType?: "retry" | "sign_in" | "go_back" | "contact_admin" | "review_status";
  severity: "info" | "warning" | "error";
  retryable: boolean;
};

const unexpected: UserFacingError = {
  category: "unexpected",
  title: "We could not complete that action",
  message: "Please try again. If the problem continues, contact your administrator.",
  actionLabel: "Try again",
  actionType: "retry",
  severity: "error",
  retryable: true,
};

/**
 * Converts an untrusted client-visible error into approved product language.
 * Never return the source message: Convex and provider failures can include
 * function names, identifiers, endpoints, or implementation diagnostics.
 */
export function toUserFacingError(cause: unknown, fallback: UserFacingError = unexpected): UserFacingError {
  const source = cause instanceof Error ? cause.message.toLowerCase() : "";
  if (/unauthenticated|session|sign in|identity/.test(source)) {
    return { category: "authentication", title: "Sign in required", message: "Your session has expired. Please sign in again to continue.", actionLabel: "Sign in", actionType: "sign_in", severity: "warning", retryable: false };
  }
  if (/unauthori[sz]ed|permission|role|required access|forbidden/.test(source)) {
    return { category: "permission", title: "Access restricted", message: "You do not have permission to complete this action. Contact your administrator if you believe this is an error.", actionLabel: "Contact administrator", actionType: "contact_admin", severity: "warning", retryable: false };
  }
  if (/not found|does not exist|unknown tenant/.test(source)) {
    return { category: "not_found", title: "Information unavailable", message: "We could not find the requested information. Check the link and try again.", actionLabel: "Go back", actionType: "go_back", severity: "warning", retryable: false };
  }
  if (/already exists|duplicate|conflict|already .*active/.test(source)) {
    return { category: "conflict", title: "This information has changed", message: "This record already exists or changed elsewhere. Refresh and review the details before continuing.", actionLabel: "Refresh", actionType: "review_status", severity: "warning", retryable: true };
  }
  if (/valid|required|must |invalid|cannot be|choose |enter /.test(source)) {
    return { category: "validation", title: "Check the information provided", message: "Review the highlighted fields and try again.", actionLabel: "Review details", actionType: "review_status", severity: "warning", retryable: false };
  }
  if (/timeout|network|offline|fetch|connection|unreachable/.test(source)) {
    return { category: "network", title: "Connection issue", message: "We could not reach the service. Please check your connection and try again.", actionLabel: "Try again", actionType: "retry", severity: "warning", retryable: true };
  }
  if (/payment|m-?pesa|airtel|sms|email|router|radius|pppoe/.test(source)) {
    return { category: "provider", title: "This action could not be completed", message: "Please review the details and try again.", actionLabel: "Try again", actionType: "retry", severity: "warning", retryable: true };
  }
  return fallback;
}

export function userFacingMessage(cause: unknown, fallbackMessage?: string): string {
  const fallback = fallbackMessage ? { ...unexpected, message: fallbackMessage } : unexpected;
  return toUserFacingError(cause, fallback).message;
}
