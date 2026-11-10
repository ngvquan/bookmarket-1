// Trạng thái, tiêu đề và thông báo dùng chung cho các trang.
import { ArrowUpRight, BookOpen, Check } from "lucide-react";

import { Link } from "react-router-dom";

export function Empty({
  icon: Icon = BookOpen,
  title,
  description,
  action = "Khám phá sách",
  to = "/mua-sach",
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={33} strokeWidth={1.3} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <Link className="button button-dark" to={to}>
          {action}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, link, to }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {link && (
        <Link className="text-link" to={to}>
          {link}
          <ArrowUpRight size={17} />
        </Link>
      )}
    </div>
  );
}

export function Status({ children, tone = "green" }) {
  return (
    <span className={`status status-${tone}`}>
      <span />
      {children}
    </span>
  );
}

export function Success({
  title,
  children,
  onClose,
  action = "Tiếp tục khám phá",
}) {
  return (
    <div className="success-content">
      <div className="success-icon">
        <Check size={32} />
      </div>
      <h2>{title}</h2>
      <p>{children}</p>
      <button className="button button-dark" onClick={onClose}>
        {action}
        <ArrowUpRight size={16} />
      </button>
    </div>
  );
}
