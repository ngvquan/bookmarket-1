import useRemoteMarket from "./useRemoteMarket.js";
import useEbookLibrary from "./useEbookLibrary.js";
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useStored from "./useStored.js";
import { groupCart, isAvailable } from "../utils/marketplace.js";
import useShippingServices from "./useShippingServices.js";
import useFavorites from "./useFavorites.js";
import useListingEditor from "./useListingEditor.js";
import useSavedListings from "./useSavedListings.js";
import useCheckout from "./useCheckout.js";
import useBookActions from "./useBookActions.js";
// Giỏ lưu trên trình duyệt; đơn hàng và quyền sở hữu ebook lấy từ API.
export default function useBookMarket() {
  const remote = useRemoteMarket();
  const {
    books,
    setBooks,
    profile,
    setProfile,
    shop,
    loading,
    error,
    reloadMarket,
    authenticate,
    logout,
    saveShop: setShop,
    saveListing,
    deleteListing,
    markSold,
    setListingVisibility,
    moderateListing,
    rememberListings,
    myPage,
    adminPage,
    loadMyPage,
    loadAdminPage,
    featuredSellers,
  } = remote;
  const [cart, setCart] = useStored("cart", []);
  const { ownedBooks, refreshLibrary, libraryLoading, libraryError } =
    useEbookLibrary(profile);
  const library = ownedBooks.map((book) => book.id);
  const [paymentOrder, setPaymentOrder] = useState(null);
  useEffect(() => {
    // Quyền từ API chứng minh đã trả tiền; dọn giỏ cả khi người mua từng đóng QR.
    if (library.length)
      setCart((old) => old.filter((item) => !library.includes(item.id)));
  }, [library.join(",")]);
  const [selected, setSelected] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const {
    shippingServices,
    shippingError,
    selectedServices,
    setSelectedServices,
    loadShipping,
  } = useShippingServices();
  const [auth, setAuth] = useState(false);
  const [post, setPost] = useState(null);
  const [editing, setEditing] = useState(null);
  const [reader, setReader] = useState(null);
  const [toast, setToast] = useState("");
  const [success, setSuccess] = useState(null);
  const [menu, setMenu] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  useEffect(() => {
    setSelected(null);
    setPost(null);
    setEditing(null);
    setReader(null);
    setPaymentOrder(null);
    setCheckout(false);
    setSelectedServices({});
  }, [profile?.id]);
  const navigate = useNavigate(),
    location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    setMenu(false);
    setAccountMenu(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const notify = (text) => setToast(text);
  const { favorites, toggleFavorite } = useFavorites({
    profile,
    setProfile,
    notify,
  });
  const { openReader, finishDigitalOrder, openBook, addToCart } =
    useBookActions({
      profile,
      library,
      ownedBooks,
      refreshLibrary,
      setReader,
      setSelected,
      setCart,
      setPaymentOrder,
      setCheckout,
      setCartOpen,
      rememberListings,
      navigate,
      notify,
    });
  const currentSellerId = profile?.id || "guest";
  const cartItems = cart.map((item) => {
    const book = books.find((b) => b.id === item.id);
    return {
      ...item,
      book: book ||
        item.snapshot || {
          id: item.id,
          title: "Tin đã gỡ",
          author: "",
          shop: "Người bán",
          sellerId: "unavailable",
          style: "peace",
          hidden: true,
        },
      available: isAvailable(book),
    };
  });
  useSavedListings({
    cart,
    favorites,
    library,
    cartOpen,
    pathname: location.pathname,
    setBooks,
    rememberListings,
  });
  const total = cartItems.reduce(
    (sum, item) => sum + (item.available ? item.quantity * item.book.price : 0),
    0,
  );
  const cartCount = cartItems.reduce(
    (count, item) => count + (item.available ? item.quantity : 0),
    0,
  );
  const physical = cartItems.some(
    (item) => item.available && item.book.type !== "digital",
  );
  const cartGroups = groupCart(cartItems, shippingServices, selectedServices);
  const shippingTotal = cartGroups.reduce(
    (sum, group) => sum + group.shipping,
    0,
  );
  const cardProps = {
    allBooks: books,
    favorites,
    toggleFavorite,
    onOpen: openBook,
    onAdd: addToCart,
    onRead: openReader,
  };
  const requireProfile = (action) => {
    if (!profile) {
      setAuth(true);
      notify("Đăng nhập để tiếp tục.");
      return;
    }
    action();
  };
  const updateQuantity = (id, change) =>
    setCart((old) =>
      old.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: Math.max(
                1,
                Math.min(
                  item.quantity + change,
                  books.find((b) => b.id === id)?.stock || 1,
                ),
              ),
            }
          : item,
      ),
    );
  const {
    submitting,
    checkoutError,
    pendingOrder,
    refreshCart,
    recoverOrder,
    placeOrder,
  } = useCheckout({
    profile,
    setProfile,
    cart,
    setCart,
    cartItems,
    cartGroups,
    setBooks,
    rememberListings,
    selectedServices,
    shippingServices,
    shippingError,
    setCheckout,
    setCartOpen,
    setSuccess,
    notify,
    finishDigitalOrder,
    setPaymentOrder,
  });

  const saveBook = useListingEditor({
    editing,
    saveListing,
    rememberListings,
    loadMyPage,
    setPost,
    setEditing,
    notify,
  });
  const visibleBooks = books.filter(isAvailable);
  return {
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
    submitting,
    pendingOrder,
    recoverOrder,
    checkoutError,
    shippingServices,
    shippingError,
    selectedServices,
    setSelectedServices,
    loadShipping,
    refreshCart,
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
    cardProps,
    requireProfile,
    updateQuantity,
    placeOrder,
    saveBook,
    visibleBooks,
    currentSellerId,
    featuredSellers,
    rememberListings,
    myPage,
    adminPage,
    loadMyPage,
    loadAdminPage,
  };
}
