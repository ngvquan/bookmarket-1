import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Nhớ thứ tự modal mở để chỉ modal trên cùng xử lý phím và khóa cuộn.
const stack = [];
let originalOverflow;
export default function Modal({
  children,
  title,
  onClose,
  wide = false,
  className = "",
}) {
  const ref = useRef(null);
  // Ref luôn trỏ tới callback mới nhất, tránh đóng bằng dữ liệu cũ.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const node = ref.current;
    const previous = document.activeElement;
    if (!stack.length) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    stack.push(node);
    const selectors =
      'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),iframe,[tabindex="0"]';
    node.querySelector(selectors)?.focus();
    const handle = (event) => {
      if (stack.at(-1) !== node) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const items = [...node.querySelectorAll(selectors)].filter(
        (el) => el.offsetParent !== null,
      );
      const first = items[0],
        last = items.at(-1);
      if (!first) {
        event.preventDefault();
        node.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !node.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !node.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      const index = stack.indexOf(node);
      if (index >= 0) {
        stack.splice(index, 1);
      }
      if (!stack.length) {
        document.body.style.overflow = originalOverflow;
      }
      document.removeEventListener("keydown", handle);
      if (
        previous?.isConnected &&
        (!stack.length || stack.at(-1).contains(previous))
      ) {
        previous.focus();
      }
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget &&
        stack.at(-1) === ref.current &&
        close.current()
      }
    >
      <section
        ref={ref}
        tabIndex={-1}
        className={`modal ${wide ? "modal-wide" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <span>{title}</span>
          <button
            className="icon-button"
            aria-label="Đóng"
            onClick={() => close.current()}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
