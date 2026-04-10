import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearSession } from "./api";

const NAV_ITEMS = [
  "Dashboard",
  "Units",
  "People",
  "Invoices",
  "Payments",
  "Payables",
  "Vendors",
  "Transactions",
  "Budgets",
  "Reports",
  "Documents",
  "Requests",
  "Violations",
  "Broadcast",
  "Mail Room",
  "Other Tools",
];

export function AppShell({ children, communityName, headerAction }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">VERIDIAN</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((label) => {
            const active = label === "People" && location.pathname.startsWith("/people");
            const clickable = label === "People";
            const content = (
              <span className={`sidebar-item ${active ? "active" : ""}`}>
                <span className="sidebar-icon">•</span>
                <span>{label}</span>
              </span>
            );
            return clickable ? (
              <Link key={label} to="/people" className="sidebar-link">
                {content}
              </Link>
            ) : (
              <span key={label} className="sidebar-link disabled">
                {content}
              </span>
            );
          })}
        </nav>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <button className="primary-top-button">Make a Payment</button>
          <div className="topbar-right">
            <button className="community-switcher" onClick={() => navigate("/people")}>
              <span className="community-dot">◌</span>
              <span>{communityName || "Community"}</span>
            </button>
            <button
              className="logout-link"
              onClick={() => {
                clearSession();
                navigate("/");
              }}
            >
              Logout
            </button>
          </div>
        </header>

        <main className="page-wrap">
          {headerAction ? <div className="header-action-wrap">{headerAction}</div> : null}
          {children}
        </main>
      </div>
    </div>
  );
}

export function Card({ title, actions, children, className = "" }) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || actions) && (
        <div className="card-header">
          <h3>{title}</h3>
          <div className="card-actions">{actions}</div>
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

export function TagPill({ label, color = "gray" }) {
  return <span className={`tag-pill ${color}`}>{label}</span>;
}

export function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}
