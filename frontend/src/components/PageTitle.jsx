// Khối tiêu đề dùng chung cho các trang tài khoản.
export default function PageTitle({ eyebrow, title, description, children }) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
