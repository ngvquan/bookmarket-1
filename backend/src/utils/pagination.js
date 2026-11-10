// Đọc và kiểm tra page/limit dùng chung cho các API danh sách.
export function readPagination(
  query,
  { defaultLimit = 10, maxLimit = 50 } = {},
) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || defaultLimit);
  const valid =
    Number.isInteger(page) &&
    page >= 1 &&
    page <= 100000 &&
    Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= maxLimit;

  return valid ? { page, limit } : null;
}
