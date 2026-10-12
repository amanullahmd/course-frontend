import { z } from "zod";

/** Minimal translator signature for the "validation" namespace. */
export type ValidationT = (key: "email" | "passwordMin" | "passwordMax" | "passwordLetter" | "passwordDigit") => string;

export const makeEmailSchema = (t: ValidationT) => z.email(t("email")).trim();

export const makePasswordSchema = (t: ValidationT) =>
  z
    .string()
    .min(8, t("passwordMin"))
    .max(64, t("passwordMax"))
    .regex(/[A-Za-z]/, t("passwordLetter"))
    .regex(/\d/, t("passwordDigit"));

/** 0 = empty, 1 weak … 4 strong. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;
  return Math.min(4, Math.max(1, points - 1)) as 1 | 2 | 3 | 4;
}
