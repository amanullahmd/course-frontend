"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { isApiError } from "@/lib/api/client";
import en from "../../messages/en.json";

type CodeKey = keyof typeof en.errors.codes;
type StatusKey = keyof typeof en.errors.status;

const isCode = (code: string): code is CodeKey => code in en.errors.codes;
const isStatus = (status: string): status is StatusKey => status in en.errors.status;

/**
 * Friendly, localised message for any error: by backend `code`, then HTTP status,
 * then the backend's (already localised) detail. Never shows raw 5xx output.
 */
export function useErrorMessage() {
  const t = useTranslations("errors");
  return React.useCallback(
    (error: unknown): string => {
      if (!isApiError(error)) return t("unknown");
      if (error.status === 0) return t("network");
      const code = error.code;
      const withRef = (message: string) => (error.traceId ? `${message} ${t("reference", { id: error.traceId })}` : message);
      if (code && isCode(code)) return error.status >= 500 ? withRef(t(`codes.${code}`)) : t(`codes.${code}`);
      if (code && code.endsWith("_NOT_FOUND")) return t("codes.NOT_FOUND");
      if (error.status >= 500) return withRef(t("server"));
      const status = String(error.status);
      if (error.status === 400 && error.detail) return error.detail;
      if (isStatus(status)) return t(`status.${status}`);
      return error.detail || t("unknown");
    },
    [t],
  );
}
