import { describe, expect, it } from "vitest";
import { PROBLEM_STATEMENTS } from "@/data/problem-statements";
import {
  DEFAULT_PAYMENT_UPI_ID,
  PAYMENT_AMOUNT_INR,
  PAYMENT_UPI_ID_BY_STATEMENT,
} from "@/lib/payment-constants";
import {
  getPaymentQrConfig,
  PAYMENT_QR_CONFIG_BY_STATEMENT,
  PAYMENT_STATUS_VALUES,
} from "@/lib/payments";

describe("payments config", () => {
  it("keeps payment amount and per-statement UPI ids in the constants module", () => {
    expect(PAYMENT_AMOUNT_INR).toBe(300);
    expect(Object.keys(PAYMENT_UPI_ID_BY_STATEMENT)).toHaveLength(
      PROBLEM_STATEMENTS.length,
    );

    for (const statement of PROBLEM_STATEMENTS) {
      expect(PAYMENT_UPI_ID_BY_STATEMENT[statement.id]).toBe(
        DEFAULT_PAYMENT_UPI_ID,
      );
    }
  });

  it("maps every problem statement to an INR 300 UPI QR config", () => {
    expect(Object.keys(PAYMENT_QR_CONFIG_BY_STATEMENT)).toHaveLength(
      PROBLEM_STATEMENTS.length,
    );

    for (const statement of PROBLEM_STATEMENTS) {
      const config = getPaymentQrConfig(statement.id);
      expect(config).not.toBeNull();
      expect(config?.amountInr).toBe(PAYMENT_AMOUNT_INR);
      expect(config?.payeeName).toContain(statement.id.toUpperCase());
      expect(config?.qrLabel).toContain(statement.id.toUpperCase());
      expect(config?.qrLabel).toContain(String(PAYMENT_AMOUNT_INR));
      expect(config?.vpa).toBe(DEFAULT_PAYMENT_UPI_ID);
      expect(config?.upiPayload).toContain("upi://pay?");
      expect(config?.upiPayload).toContain(
        `am=${PAYMENT_AMOUNT_INR.toFixed(2)}`,
      );
      expect(config?.upiPayload).not.toContain("&tn=");
    }
  });

  it("exposes the expected payment statuses", () => {
    expect(PAYMENT_STATUS_VALUES).toEqual([
      "not_submitted",
      "submitted",
      "approved",
      "rejected",
    ]);
  });
});
