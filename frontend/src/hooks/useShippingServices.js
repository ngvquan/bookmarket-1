// Hook này tải dịch vụ giao hàng và chỉ retry các yêu cầu GET an toàn.
import { useEffect, useRef, useState } from "react";
import { apiMessage, shippingService } from "../services/api.js";

export default function useShippingServices() {
  const [services, setServices] = useState([]);
  const [error, setError] = useState("");
  const [selectedServices, setSelectedServices] = useState({});
  const loading = useRef(false);

  async function loadShipping() {
    if (loading.current) {
      return;
    }

    loading.current = true;
    setError("");
    try {
      // Không retry thao tác đặt hàng vì có thể tạo đơn trùng.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          setServices(await shippingService.list());
          return;
        } catch (requestError) {
          const cannotRetry =
            requestError.status &&
            requestError.status < 500 &&
            !requestError.retryable;
          if (attempt === 2 || cannotRetry) {
            throw requestError;
          }
          await new Promise((resolve) =>
            setTimeout(resolve, (attempt + 1) * 1000),
          );
        }
      }
    } catch (requestError) {
      setServices([]);
      setError("Không tải được phí giao. " + apiMessage(requestError));
    } finally {
      loading.current = false;
    }
  }

  useEffect(() => {
    loadShipping();
  }, []);

  useEffect(() => {
    if (!error) {
      return undefined;
    }

    const recover = () => {
      if (document.visibilityState === "visible") {
        loadShipping();
      }
    };
    window.addEventListener("online", recover);
    window.addEventListener("focus", recover);
    return () => {
      window.removeEventListener("online", recover);
      window.removeEventListener("focus", recover);
    };
  }, [error]);

  return {
    shippingServices: services,
    shippingError: error,
    selectedServices,
    setSelectedServices,
    loadShipping,
  };
}
