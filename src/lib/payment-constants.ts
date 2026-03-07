import { PROBLEM_STATEMENTS } from "@/data/problem-statements";

export const PAYMENT_AMOUNT_INR = 300;
export const DEFAULT_PAYMENT_UPI_ID = "9301161940@fam";

export const PAYMENT_UPI_ID_BY_STATEMENT = Object.fromEntries(
  PROBLEM_STATEMENTS.map((statement) => [statement.id, DEFAULT_PAYMENT_UPI_ID]),
) as Record<(typeof PROBLEM_STATEMENTS)[number]["id"], string>;

export const getPaymentUpiIdForStatement = (problemStatementId: string) =>
  PAYMENT_UPI_ID_BY_STATEMENT[
    problemStatementId
      .trim()
      .toLowerCase() as keyof typeof PAYMENT_UPI_ID_BY_STATEMENT
  ] ?? null;
