import { randomBytes, timingSafeEqual } from "node:crypto";
export function makeTransferCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return (
    "BM" +
    [...randomBytes(10)].map((byte) => chars[byte % chars.length]).join("")
  );
}
export function getPlatformBank() {
  const env = process.env;
  const bank = {
    id: env.PAYMENT_BANK_ID?.trim(),
    name: env.PAYMENT_BANK_NAME?.trim(),
    accountNo: env.PAYMENT_ACCOUNT_NO?.trim(),
    accountName: env.PAYMENT_ACCOUNT_NAME?.trim(),
  };
  if (
    Object.values(bank).some((value) => !value) ||
    !/^[a-zA-Z0-9]+$/.test(bank.id) ||
    !/^[a-zA-Z0-9]{1,19}$/.test(bank.accountNo)
  ) {
    const error = new Error("Thanh toán chuyển khoản chưa được cấu hình");
    error.status = 503;
    throw error;
  }
  return bank;
}
export function buildQrUrl(amount, transferCode, bank) {
  const template = process.env.PAYMENT_QR_TEMPLATE?.trim() || "compact2";
  if (!/^[a-zA-Z0-9_]+$/.test(template)) {
    const error = new Error("Mẫu QR không hợp lệ.");
    error.status = 503;
    throw error;
  }
  const query = new URLSearchParams({
    amount: String(amount),
    addInfo: transferCode,
    accountName: bank.accountName,
  });
  // Quick Link hiện dùng SVG; thẻ img vẫn hiển thị được mà không cần dependency.
  return `https://img.vietqr.io/image/${bank.id}-${bank.accountNo}-${template}.svg?${query}`;
}
export function validWebhookSecret(header) {
  const expected = Buffer.from("Apikey " + process.env.PAYMENT_WEBHOOK_SECRET);
  const supplied = Buffer.from(typeof header === "string" ? header : "");
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}
export function readBankTransaction(body = {}) {
  const amount = body.transferAmount ?? body.amount;
  const id = body.id ?? body.referenceCode ?? body.transactionId;
  const transactionId =
    typeof id === "string" || Number.isSafeInteger(id) ? String(id).trim() : "";
  const rawDescription = [body.content, body.description]
    .filter((value) => typeof value === "string")
    .join(" ")
    .trim()
    .slice(0, 300);
  const normalized = rawDescription.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // SePay có thể tách mã thanh toán vào field code hoặc chỉ để trong nội dung.
  const directCode =
    typeof body.code === "string"
      ? body.code.toUpperCase().replace(/[^A-Z0-9]/g, "")
      : "";
  const codes = [
    ...new Set([
      ...(directCode.match(/BM[A-Z0-9]{10}/g) || []),
      ...(normalized.match(/BM[A-Z0-9]{10}/g) || []),
    ]),
  ];
  return {
    amount,
    transactionId,
    description: rawDescription,
    code: codes.length === 1 ? codes[0] : null,
    incoming: body.transferType === undefined || body.transferType === "in",
    accountNo: body.accountNumber,
  };
}
