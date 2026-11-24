import { useEffect, useState } from "react";
import { Search, UsersRound } from "lucide-react";
import { adminAccountService, apiMessage } from "../services/api.js";
import Pagination from "./Pagination.jsx";
import { Empty } from "./index.js";

const emptyPage = { items: [], total: 0, page: 1, pages: 0 };

export default function AdminAccounts() {
  const [data, setData] = useState(emptyPage);
  const [scope, setScope] = useState("all");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    adminAccountService.list({ page, scope, ...(search ? { search } : {}) })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError) => {
        if (active) setError(apiMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [page, scope, search, revision]);

  function submit(event) {
    event.preventDefault();
    const value = draft.trim();
    setPage(1);
    if (value === search) setRevision((current) => current + 1);
    else setSearch(value);
  }

  return (
    <section className="admin-accounts" aria-label="Danh sách tài khoản">
      <form className="admin-search-form" onSubmit={submit}>
        <label htmlFor="admin-account-search">Tìm tài khoản</label>
        <div className="admin-search-controls">
          <div className="admin-search-input">
            <Search size={17} aria-hidden="true" />
            <input id="admin-account-search" type="search" maxLength={100}
              placeholder="Tên hoặc email" value={draft}
              onChange={(event) => setDraft(event.target.value)} />
          </div>
          <button type="submit" className="button button-dark">Tìm kiếm</button>
        </div>
      </form>
      <div className="admin-account-filters" role="group" aria-label="Lọc tài khoản">
        {[["all", "Tất cả"], ["shop", "Có gian hàng"], ["no_shop", "Chưa có gian hàng"]].map(([value, label]) => (
          <button type="button" key={value} className={scope === value ? "active" : ""}
            aria-pressed={scope === value}
            onClick={() => { setScope(value); setPage(1); }}>
            {label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="danger-text">{error} <button type="button" onClick={() => setRevision((current) => current + 1)}>Thử lại</button></p>}
      {loading && <p role="status" className="admin-loading">Đang tải tài khoản…</p>}
      {!loading && !error && <p className="admin-list-count" aria-live="polite">{data.total} tài khoản</p>}
      {!loading && !error && data.items.length > 0 && (
        <div className="admin-account-list">
          {data.items.map((account) => (
            <article className="admin-account-row" key={account.id}>
              <span className="admin-account-avatar" aria-hidden="true">{account.name?.trim().charAt(0).toLocaleUpperCase("vi-VN") || "?"}</span>
              <div className="admin-account-identity">
                <strong>{account.name}</strong>
                <small>{account.email}</small>
              </div>
              <div className="admin-account-shop">
                <strong>{account.shop?.name || "Chưa có gian hàng"}</strong>
              </div>
              <time dateTime={account.createdAt}>Tham gia {new Date(account.createdAt).toLocaleDateString("vi-VN")}</time>
            </article>
          ))}
        </div>
      )}
      {!loading && !error && !data.items.length && (
        <Empty icon={UsersRound} title="Không tìm thấy tài khoản"
          description="Thử tên, email hoặc bộ lọc khác." action={null} />
      )}
      <Pagination data={data} onPage={setPage} busy={loading} />
    </section>
  );
}
