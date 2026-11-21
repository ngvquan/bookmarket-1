import { Component } from "react";

// Hiện thông báo khi render lỗi để người dùng không gặp trang trắng.
export default class ErrorBoundary extends Component {
  state = {
    failed: false,
  };
  static getDerivedStateFromError() {
    return {
      failed: true,
    };
  }
  componentDidCatch(error) {
    console.error("BookMarket render error:", error);
  }
  render() {
    if (this.state.failed) {
      return (
        <main className="shell empty-state" role="alert">
          <h1>Chưa mở được trang này</h1>
          <p>Dữ liệu hiện tại vẫn được giữ. Bạn có thể tải lại để thử tiếp.</p>
          <button
            className="button button-dark"
            onClick={() => window.location.reload()}
          >
            Tải lại trang
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
