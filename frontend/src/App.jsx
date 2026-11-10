// Ghép trang, header/footer và các modal; logic dữ liệu nằm ở hooks/useBookMarket.
import MarketplaceHeader from "./components/MarketplaceHeader.jsx";
import MarketplaceFooter from "./components/MarketplaceFooter.jsx";
import SellerLayout from "./components/SellerLayout.jsx";
import { isSellerArea } from "./data/sellerNavigation.js";
import AccessGate from "./components/AccessGate.jsx";
import { apiMessage, chatService } from "./services/api.js";
import { useState } from "react";
import useChatUnread, { refreshChat } from "./hooks/useChatUnread.js";
import ChatPage from "./pages/ChatPage.jsx";
import ShopRegistrationPage from "./pages/ShopRegistrationPage.jsx";
import useBookMarket from "./hooks/useBookMarket.js";
import OrdersPage from "./pages/OrdersPage.jsx";
import OrderDetailPage from "./pages/OrderDetailPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import FavoritesPage from "./pages/FavoritesPage.jsx";
import Admin from "./pages/AdminPage.jsx";
import Seller from "./pages/SellerPage.jsx";
import Reader from "./components/Reader.jsx";
import PostForm from "./components/PostForm.jsx";
import Auth from "./components/Auth.jsx";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { X, CheckCircle2 } from "lucide-react";
import { catalogSections } from "./data/catalog.js";
import { Empty, Modal, Success } from "./components/index.js";
import Home from "./pages/HomePage.jsx";
import Catalog from "./pages/CatalogPage.jsx";
import SearchPanel from "./components/SearchPanel.jsx";
import PaymentModal from "./components/PaymentModal.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import useNotifications from "./hooks/useNotifications.js";
import { SellerDirectory } from "./pages/SellerDirectoryPage.jsx";
import { SellerStorefront } from "./pages/SellerStorefrontPage.jsx";
import BookDetailModal from "./components/BookDetailModal.jsx";
import CartModal from "./components/CartModal.jsx";
import CheckoutModal from "./components/CheckoutModal.jsx";
import AdminLogin from "./components/AdminLogin.jsx";
import BottomNav from "./components/BottomNav.jsx";
export default function App() {
  const {
    loading,
    error,
    reloadMarket,
    authenticate,
    logout,
    deleteListing,
    markSold,
    setListingVisibility,
    moderateListing,
    books,
    setBooks,
    favorites,
    cart,
    setCart,
    library,
    ownedBooks,
    refreshLibrary,
    libraryLoading,
    libraryError,
    paymentOrder,
    setPaymentOrder,
    finishDigitalOrder,
    profile,
    setProfile,
    shop,
    setShop,
    selected,
    setSelected,
    cartOpen,
    setCartOpen,
    checkout,
    setCheckout,
    auth,
    setAuth,
    post,
    setPost,
    editing,
    setEditing,
    reader,
    setReader,
    toast,
    setToast,
    success,
    setSuccess,
    menu,
    setMenu,
    accountMenu,
    setAccountMenu,
    navigate,
    location,
    notify,
    toggleFavorite,
    openBook,
    addToCart,
    cartItems,
    cartCount,
    total,
    physical,
    cartGroups,
    shippingTotal,
    submitting,
    checkoutError,
    shippingServices,
    shippingError,
    selectedServices,
    setSelectedServices,
    loadShipping,
    refreshCart,
    pendingOrder,
    recoverOrder,
    cardProps,
    requireProfile,
    updateQuantity,
    placeOrder,
    saveBook,
    visibleBooks,
    currentSellerId,
    rememberListings,
    myPage,
    adminPage,
    loadMyPage,
    loadAdminPage,
    featuredSellers,
  } = useBookMarket();
  const unread = useChatUnread(profile);
  const notifications = useNotifications(profile, notify);
  const [chatStarting, setChatStarting] = useState(false);
  const startChat = (target) =>
    requireProfile(async () => {
      if (profile.role === "admin")
        return notify("Hãy dùng tài khoản người dùng để chat với người bán.");
      if (chatStarting) return;
      setChatStarting(true);
      try {
        const data = await chatService.start(target);
        setSelected(null);
        refreshChat();
        navigate(`/tin-nhan/${data.conversation.id}`);
      } catch (error) {
        notify(apiMessage(error));
      } finally {
        setChatStarting(false);
      }
    });
  const checkoutItems = physical
    ? cartItems.filter((item) => ["new", "used"].includes(item.book.type))
    : cartItems;
  const checkoutTotal = checkoutItems.reduce(
    (sum, item) => sum + (item.available ? item.book.price * item.quantity : 0),
    0,
  );
  const sellerArea = isSellerArea(location.pathname);
  const adminArea = location.pathname.startsWith("/quan-tri");
  const ContentRoot = sellerArea || adminArea ? "div" : "main";
  const handleLogout = () => {
    try {
      logout();
      setAccountMenu(false);
      notify("Đã đăng xuất.");
    } catch (error) {
      notify(apiMessage(error));
    }
  };
  const sellerLayout = (children) => (
    <SellerLayout
      profile={profile}
      shop={shop}
      unread={unread.seller}
      notificationUnread={notifications.unread}
      onLogin={() => setAuth("seller")}
      onRegister={() => {
        navigate("/dang-ky-rap-sach");
        setAuth("seller-register");
      }}
      onLogout={handleLogout}
    >
      {children}
    </SellerLayout>
  );
  if (loading) {
    return (
      <main className="shell empty-state">
        <h1>Đang kết nối BookMarket…</h1>
        <p>Đang tải sách và kiểm tra phiên đăng nhập.</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="shell empty-state" role="alert">
        <h1>Chưa kết nối được máy chủ</h1>
        <p>{error}</p>
        <button className="button button-dark" onClick={reloadMarket}>
          Thử lại
        </button>
      </main>
    );
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Đến nội dung chính
      </a>
      {!sellerArea && !adminArea && (
        <MarketplaceHeader
          profile={profile}
          unread={unread.buyer}
          notificationUnread={notifications.unread}
          cartCount={cartCount}
          onCart={() => setCartOpen(true)}
          onLogin={() => setAuth(true)}
          accountMenu={accountMenu}
          setAccountMenu={setAccountMenu}
          menu={menu}
          setMenu={setMenu}
          onLogout={handleLogout}
        />
      )}
      <ContentRoot id={sellerArea ? undefined : "main"}>
        {!sellerArea && !adminArea && pendingOrder && (
          <div className="shell info-box" role="status">
            <p>
              Có lần đặt hàng chưa nhận được kết quả. Kiểm tra lại để tránh đặt
              trùng.
            </p>
            <button
              className="button button-outline button-small"
              disabled={submitting}
              onClick={recoverOrder}
            >
              {submitting ? "Đang kiểm tra…" : "Kiểm tra lần đặt trước"}
            </button>
          </div>
        )}
        <Routes>
          <Route
            path="/"
            element={
              <Home
                books={books}
                sellers={featuredSellers}
                cardProps={cardProps}
                onOpen={openBook}
                onResults={rememberListings}
              />
            }
          />
          {Object.entries(catalogSections).map(([key, t]) => (
            <Route
              key={key}
              path={t.path}
              element={
                <Catalog
                  type={key}
                  info={t}
                  books={visibleBooks}
                  sessionBooks={books}
                  onResults={rememberListings}
                  cardProps={cardProps}
                  library={library}
                  onPost={() =>
                    requireProfile(() =>
                      setPost(key === "physical" ? "used" : key),
                    )
                  }
                />
              }
            />
          ))}
          <Route
            path="/sach-moi"
            element={<LegacyCatalogRedirect type="new" />}
          />
          <Route
            path="/sach-cu"
            element={<LegacyCatalogRedirect type="used" />}
          />
          <Route
            path="/tim-kiem"
            element={
              <Catalog
                type="all"
                info={{
                  label: "Tìm kiếm",
                  eyebrow: "KHÁM PHÁ BOOKMARKET",
                  title: "Tất cả sách",
                  description:
                    "Khám phá sách mới, sách cũ và ebook từ các nhà bán.",
                }}
                books={visibleBooks}
                sessionBooks={books}
                onResults={rememberListings}
                cardProps={cardProps}
                library={library}
              />
            }
          />
          <Route
            path="/tim-kiem-nang-cao"
            element={
              <div className="shell page-content advanced-search-page">
                <div className="page-title">
                  <div>
                    <span className="eyebrow">
                      TÌM ĐÚNG PHIÊN BẢN SÁCH BẠN MUỐN
                    </span>
                    <h1>Tìm kiếm nâng cao</h1>
                    <p>
                      Kết hợp tác giả, tên sách, nhà xuất bản và tình trạng. Bạn
                      có thể để trống những mục chưa biết.
                    </p>
                  </div>
                </div>
                <SearchPanel advanced />
              </div>
            }
          />
          <Route
            path="/nha-ban"
            element={<SellerDirectory books={visibleBooks} />}
          />
          <Route
            path="/nha-ban/:sellerId"
            element={
              <SellerStorefront
                books={books}
                onResults={rememberListings}
                cardProps={cardProps}
                library={library}
                profile={profile}
                onChat={startChat}
                chatStarting={chatStarting}
              />
            }
          />
          <Route
            path="/tin-nhan/:conversationId?"
            element={
              <AccessGate profile={profile} onLogin={() => setAuth(true)}>
                <ChatPage key={profile?.id} profile={profile} unread={unread} />
              </AccessGate>
            }
          />
          <Route
            path="/yeu-thich"
            element={
              <FavoritesPage
                books={books}
                favorites={favorites}
                cardProps={cardProps}
              />
            }
          />
          <Route
            path="/ho-so"
            element={
              <AccessGate profile={profile} onLogin={() => setAuth(true)}>
                <ProfilePage
                  profile={profile}
                  setProfile={setProfile}
                  notify={notify}
                />
              </AccessGate>
            }
          />
          <Route
            path="/thong-bao"
            element={
              <AccessGate profile={profile} onLogin={() => setAuth(true)}>
                <NotificationsPage notifications={notifications} />
              </AccessGate>
            }
          />
          <Route path="/theo-doi" element={<Navigate to="/" replace />} />
          <Route
            path="/thu-vien"
            element={
              <AccessGate profile={profile} onLogin={() => setAuth(true)}>
                <LibraryPage
                  books={ownedBooks}
                  loading={libraryLoading}
                  error={libraryError}
                  onRetry={refreshLibrary}
                  cardProps={cardProps}
                />
              </AccessGate>
            }
          />
          <Route
            path="/don-hang"
            element={
              <AccessGate profile={profile} onLogin={() => setAuth(true)}>
                <OrdersPage
                  key={profile?.id}
                  profile={profile}
                  onPay={setPaymentOrder}
                  services={shippingServices}
                />
              </AccessGate>
            }
          />
          <Route path="/yeu-cau" element={<Navigate to="/" replace />} />
          <Route path="/trao-doi" element={<Navigate to="/" replace />} />
          <Route
            path="/don-hang/:id"
            element={
              profile ? (
                <OrderDetailPage
                  key={profile.id}
                  profile={profile}
                  services={shippingServices}
                />
              ) : (
                <AccessGate profile={profile} onLogin={() => setAuth(true)} />
              )
            }
          />
          <Route
            path="/gian-hang"
            element={<Navigate to="/nguoi-ban" replace />}
          />
          <Route
            path="/dang-ky-rap-sach"
            element={
              <AccessGate profile={profile} onLogin={() => setAuth("seller")}>
                <div className="shell page-content shop-registration-shell">
                  <ShopRegistrationPage
                    key={profile?.id}
                    profile={profile}
                    shop={shop}
                    onRegister={setShop}
                  />
                </div>
              </AccessGate>
            }
          />
          <Route
            path="/nguoi-ban/dang-ky"
            element={<Navigate to="/dang-ky-rap-sach" replace />}
          />
          <Route
            path="/nguoi-ban/don-hang/:id"
            element={sellerLayout(
              <OrderDetailPage
                key={profile?.id}
                profile={profile}
                services={shippingServices}
                seller
              />,
            )}
          />
          <Route
            path="/nguoi-ban/tin-nhan/:conversationId?"
            element={sellerLayout(
              <ChatPage
                key={profile?.id}
                profile={profile}
                seller
                unread={unread}
              />,
            )}
          />
          <Route
            path="/nguoi-ban/*"
            element={sellerLayout(
              <Seller
                key={profile?.id}
                services={shippingServices}
                books={myPage.items}
                pageData={myPage}
                onPage={loadMyPage}
                shop={shop}
                setShop={setShop}
                profile={profile}
                onPost={(type) => {
                  setEditing(null);
                  setPost(type);
                }}
                onEdit={(book) => {
                  setEditing(book);
                  setPost(book.type);
                }}
                onSold={async (id) => {
                  try {
                    await markSold(id);
                    notify("Đã đánh dấu đã bán.");
                  } catch (error) {
                    notify(apiMessage(error));
                  }
                }}
                onVisibility={async (id, hidden) => {
                  try {
                    await setListingVisibility(id, hidden);
                    notify(hidden ? "Đã ẩn tin." : "Đã hiện lại tin.");
                  } catch (error) {
                    notify(apiMessage(error));
                  }
                }}
                onDelete={(id) => {
                  deleteListing(id)
                    .then(() => notify("Đã xóa tin đăng."))
                    .catch((error) => notify(apiMessage(error)));
                }}
              />,
            )}
          />
          <Route
            path="/quan-tri/dang-nhap"
            element={
              <AdminLogin
                onSubmit={async (data) => {
                  const user = await authenticate(data);
                  navigate("/quan-tri");
                  notify("Chào " + user.name + ", mừng bạn trở lại!");
                }}
              />
            }
          />
          <Route
            path="/quan-tri"
            element={
              profile?.role === "admin" ? (
                <Admin
                  key={profile?.id}
                  services={shippingServices}
                  books={adminPage.items}
                  pageData={adminPage}
                  onPage={loadAdminPage}
                  onLogout={() => {
                    handleLogout();
                    navigate("/quan-tri/dang-nhap");
                  }}
                  notify={notify}
                  onModerate={async (id, status) => {
                    try {
                      await moderateListing(id, status);
                      notify("Đã cập nhật tin đăng.");
                    } catch (error) {
                      notify(apiMessage(error));
                    }
                  }}
                />
              ) : (
                <AdminLogin
                  onSubmit={async (data) => {
                    const user = await authenticate(data);
                    notify("Chào " + user.name + ", mừng bạn trở lại!");
                  }}
                />
              )
            }
          />
          <Route
            path="*"
            element={
              <div className="shell page-content">
                <Empty
                  title="Trang sách này chưa được viết"
                  description="Đường dẫn bạn tìm không tồn tại. Cùng trở lại để khám phá một câu chuyện khác nhé."
                  to="/"
                  action="Về trang chủ"
                />
              </div>
            }
          />
        </Routes>
      </ContentRoot>
      {!sellerArea && !adminArea && <MarketplaceFooter />}
      {!sellerArea && !adminArea && (
        <BottomNav
          cartCount={cartCount}
          unread={unread.buyer}
          profile={profile}
          onCart={() => setCartOpen(true)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{toast}</span>
          <button aria-label="Đóng thông báo" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {selected && (
        <BookDetailModal
          selected={selected}
          setSelected={setSelected}
          library={library}
          profile={profile}
          setReader={setReader}
          addToCart={addToCart}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          chatStarting={chatStarting}
          startChat={startChat}
          books={books}
          cardProps={cardProps}
          rememberListings={rememberListings}
          setAuth={setAuth}
        />
      )}
      {cartOpen && (
        <CartModal
          cartItems={cartItems}
          setCart={setCart}
          setCartOpen={setCartOpen}
          cartGroups={cartGroups}
          updateQuantity={updateQuantity}
          total={total}
          physical={physical}
          shippingServices={shippingServices}
          shippingError={shippingError}
          shippingTotal={shippingTotal}
          loadShipping={loadShipping}
          cartCount={cartCount}
          requireProfile={requireProfile}
          setCheckout={setCheckout}
        />
      )}
      {checkout && (
        <CheckoutModal
          setCheckout={setCheckout}
          placeOrder={placeOrder}
          physical={physical}
          profile={profile}
          cartGroups={cartGroups}
          selectedServices={selectedServices}
          setSelectedServices={setSelectedServices}
          shippingServices={shippingServices}
          checkoutItems={checkoutItems}
          shippingTotal={shippingTotal}
          checkoutTotal={checkoutTotal}
          checkoutError={checkoutError}
          submitting={submitting}
          refreshCart={refreshCart}
          setCartOpen={setCartOpen}
          notify={notify}
        />
      )}
      {auth && (
        <Auth
          key={String(auth)}
          admin={auth === "admin"}
          seller={auth === "seller" || auth === "seller-register"}
          initialRegister={auth === "seller-register"}
          onClose={() => setAuth(false)}
          onSubmit={async (data) => {
            const user = await authenticate(data);
            setAuth(false);
            if (
              (auth === "seller" || auth === "seller-register") &&
              data.register
            )
              navigate(user.shop ? "/nguoi-ban" : "/dang-ky-rap-sach");
            notify("Chào " + user.name + ", mừng bạn trở lại!");
          }}
        />
      )}
      {post && (
        <PostForm
          type={post}
          editing={editing}
          shop={shop}
          onClose={() => {
            setPost(null);
            setEditing(null);
          }}
          onSubmit={saveBook}
        />
      )}
      {paymentOrder && (
        <PaymentModal
          order={paymentOrder}
          onClose={() => setPaymentOrder(null)}
          onPaid={finishDigitalOrder}
        />
      )}
      {reader && <Reader book={reader} onClose={() => setReader(null)} />}
      {success && (
        <Modal title="BOOKMARKET" onClose={() => setSuccess(null)}>
          <Success
            title={success.title}
            action={success.action}
            onClose={() => {
              const to = success.to;
              setSuccess(null);
              if (to) {
                navigate(to);
              }
            }}
          >
            {success.text}
          </Success>
        </Modal>
      )}
    </>
  );
}

// Keep saved links while routing both paper-book types into one catalogue.
function LegacyCatalogRedirect({ type }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("type", type);
  return <Navigate to={`/mua-sach?${params.toString()}`} replace />;
}
