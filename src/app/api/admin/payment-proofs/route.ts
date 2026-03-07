import type { NextRequest } from "next/server";
import { PROBLEM_STATEMENTS } from "@/data/problem-statements";
import { listAdminPaymentProofs } from "@/server/admin/payment-proofs";
import { hasAdminReviewAccess } from "@/server/admin/review-access";
import { getRouteAuthContext } from "@/server/auth/context";
import { jsonError, jsonNoStore } from "@/server/http/response";

const allowedStatementIds = new Set(PROBLEM_STATEMENTS.map((item) => item.id));

const parseStatementFilter = (request: NextRequest) => {
  const statement = request.nextUrl.searchParams.get("statement");
  if (!statement || statement === "all") {
    return { ok: true as const, statement: "all" as const };
  }

  const normalized = statement.trim().toLowerCase();
  if (!allowedStatementIds.has(normalized)) {
    return { error: "Invalid statement filter.", ok: false as const };
  }

  return {
    ok: true as const,
    statement: normalized as (typeof PROBLEM_STATEMENTS)[number]["id"],
  };
};

export async function GET(request: NextRequest) {
  const context = await getRouteAuthContext();
  if (!context.ok) {
    return context.response;
  }

  if (!(await hasAdminReviewAccess(context.user.email))) {
    return jsonError("Forbidden", 403);
  }

  const statementParseResult = parseStatementFilter(request);
  if (!statementParseResult.ok) {
    return jsonError(statementParseResult.error, 400);
  }

  const result = await listAdminPaymentProofs({
    statement: statementParseResult.statement,
  });
  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return jsonNoStore(result.data, result.status);
}
