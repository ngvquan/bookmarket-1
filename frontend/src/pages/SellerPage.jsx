// Chủ tài khoản quản lý shop/tin; API xác nhận quyền khi ghi dữ liệu.
import { apiMessage } from "../services/api.js";
import { useState, useEffect } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { sellerSections } from "../data/sellerNavigation.js";
import Pagination from "../components/Pagination.jsx";
import ShopOrders from "../components/ShopOrders.jsx";
import { ArrowUpRight, Store, Pencil, Trash2 } from "lucide-react";
import { Cover, Modal, Empty, Status } from "../components/index.js";
import { types } from "../data/catalog.js";
import { money } from "../utils/format.js";
import ShopSettingsForm from "../components/ShopSettingsForm.jsx";
import PageTitle from "../components/PageTitle.jsx";
import { Plus } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import SellerReviews from "../components/SellerReviews.jsx";
export default function Seller({
  books,
  shop,
  setShop,
  profile,
  services,
  onPost,
  onEdit,
  onDelete,
  onSold,
  onVisibility,
  pageData,
  onPage,
}) {
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  // Nạp một trang tin của chủ tài khoản; lỗi được hiện tại trang thay vì bỏ qua.
  async function loadPage(page) {
    setBusy(true);
    setLoadError("");
    try {
      await onPage(page);
    } catch (error) {
      setLoadError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (profile) {
      loadPage(1);
    }
  }, [profile?.id]);
  const [deleteId, setDeleteId] = useState(null);
  const location = useLocation();
  const currentPath = location.pathname.replace(/\/$/, "");
  if (currentPath === "/nguoi-ban") {
    return <Navigate to="/nguoi-ban/san-pham" replace state={location.state} />;
  }
  const section = sellerSections.find((item) => item.path === currentPath);
  const tab = section?.id;
  const mine = books.filter((b) => b.sellerId === profile?.id);
  if (!section)
    return (
      <Empty
        title="Không tìm thấy trang quản lý"
        description="Chọn một mục trong kênh người bán để tiếp tục."
        to="/nguoi-ban"
        action="Về sản phẩm"
      />
    );
  if (tab === "shop" && !shop)
    return <Navigate to="/dang-ky-rap-sach" replace />;
  return (
    <div className="seller-page-content">
      <PageTitle
        eyebrow="KÊNH NGƯỜI BÁN"
        title={tab === "shop" && shop ? shop.name : section.title}
        description={section.description}
      >
        {profile && (
          <button
            className="button button-dark"
            onClick={() =>
              onPost(shop?.isRegistrationComplete ? "new" : "used")
            }
          >
            Đăng sách
            <Plus size={17} />
          </button>
        )}
      </PageTitle>
      {shop && !shop.isRegistrationComplete && tab !== "shop" && (
        <p role="status" className="info-box">
          Shop chưa hoàn tất đăng ký nên chưa thể đăng sách mới hoặc ebook.{" "}
          <Link to="/nguoi-ban/gian-hang">
            Bổ sung liên hệ và địa chỉ lấy hàng
          </Link>
        </p>
      )}
      {tab === "products" && shop && location.state?.shopReady && (
        <div className="shop-registration-ready" role="status">
          <div>
            <strong>Rạp sách {shop.name} đã sẵn sàng</strong>
            <p>
              Bạn đang ở giao diện người bán. Hãy đăng sách đầu tiên để bắt đầu.
            </p>
          </div>
          <Link className="button button-dark" to="/nguoi-ban/san-pham">
            Đăng sách đầu tiên
            <Plus size={15} />
          </Link>
        </div>
      )}
      <>
        {tab === "products" &&
          (mine.length ? (
            <div className="management-list">
              {mine.map((b) => (
                <div className="management-row" key={b.id}>
                  <Cover book={b} />
                  <div>
                    <strong>{b.title}</strong>
                    <small>
                      {types[b.type].label}{" "}
                      {b.price ? " · " + money(b.price) : ""}
                    </small>
                  </div>
                  <Status
                    tone={
                      b.rejected || b.hidden
                        ? "red"
                        : b.pending
                          ? "amber"
                          : "green"
                    }
                  >
                    {{
                      pending: "Chưa công khai",
                      approved: "Đang hiển thị",
                      rejected: "Bị từ chối",
                      hidden: "Đã ẩn",
                      sold: "Đã bán",
                    }[b.status] || "Chưa công khai"}
                  </Status>
                  {b.type === "used" && !b.sold && !b.pending && (
                    <button
                      className="button button-outline button-small"
                      onClick={() => onSold(b.id)}
                    >
                      Đánh dấu đã bán
                    </button>
                  )}
                  {(b.status === "approved" ||
                    (b.status === "hidden" && b.hiddenBy === "seller")) && (
                    <button
                      className="button button-outline button-small"
                      onClick={() =>
                        onVisibility(b.id, b.status === "approved")
                      }
                    >
                      {b.status === "approved" ? (
                        <>
                          <EyeOff size={15} />
                          Ẩn tin
                        </>
                      ) : (
                        <>
                          <Eye size={15} />
                          Hiện tin
                        </>
                      )}
                    </button>
                  )}
                  <button
                    className="icon-button"
                    disabled={b.sold}
                    onClick={() => onEdit(b)}
                    aria-label={`Sửa ${b.title}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button danger-text"
                    onClick={() => setDeleteId(b.id)}
                    aria-label={`Xóa ${b.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Kệ sách đang chờ bạn"
              description="Bấm Đăng sách để chia sẻ cuốn sách đầu tiên."
              action={null}
            />
          ))}
        {loadError && (
          <p role="alert" className="danger-text">
            {loadError}
          </p>
        )}
        {busy && <p role="status">Đang tải tin…</p>}
        {tab === "products" && (
          <Pagination data={pageData} onPage={loadPage} busy={busy} />
        )}
        {tab === "orders" && <ShopOrders services={services} />}
        {tab === "reviews" && <SellerReviews />}
        {tab === "shop" && (
          <ShopSettingsForm
            key={shop.id}
            shop={shop}
            profile={profile}
            onSave={setShop}
          />
        )}
        {!shop && tab !== "shop" && (
          <div className="shop-cta">
            <Store size={25} />
            <div>
              <strong>Muốn mở một hiệu sách của riêng mình?</strong>
              <p>
                Đăng ký thông tin shop, người liên hệ và địa chỉ để bán sách
                mới, ebook.
              </p>
            </div>
            <Link
              className="button button-dark button-small shop-register-link"
              to="/dang-ky-rap-sach"
            >
              Đăng ký rạp sách
              <ArrowUpRight size={15} />
            </Link>
          </div>
        )}
      </>
      {deleteId && (
        <Modal title="XÓA TIN ĐĂNG" onClose={() => setDeleteId(null)}>
          <div className="form-stack">
            <h2>Xóa cuốn sách này?</h2>
            <p>Tin đăng sẽ được gỡ khỏi danh sách của bạn.</p>
            <div className="form-row">
              <button
                className="button button-outline"
                onClick={() => setDeleteId(null)}
              >
                Giữ lại
              </button>
              <button
                className="button button-dark"
                onClick={() => {
                  onDelete(deleteId);
                  setDeleteId(null);
                }}
              >
                Xác nhận xóa
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
