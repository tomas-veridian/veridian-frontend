import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api, { resolveCommunity } from "../api";
import { AppShell, Card, EmptyState, TagPill } from "../components";
import { formatAdminRole } from "../permissions";

function formatDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function prettyPersonType(value) {
  if (!value) return "Other";
  return value
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function autoTagColor(tag) {
  if (/property manager/i.test(tag)) return "yellow";
  if (/missing/i.test(tag) || /never/i.test(tag)) return "gray";
  return "blue";
}

export default function People() {
  const [rows, setRows] = useState([]);
  const [community, setCommunity] = useState({ id: "", name: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [ownerTagFilter, setOwnerTagFilter] = useState(searchParams.get("tag") || "");
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, pageSize: 25 });

  const tab = searchParams.get("tab") || "active";

  async function loadPeople(activeTab = tab, currentSearch = search, currentTag = ownerTagFilter) {
    setLoading(true);
    setError("");
    try {
      const communityInfo = await resolveCommunity();
      setCommunity(communityInfo);
      if (activeTab === "new") {
        setRows([]);
        setPageInfo({ total: 0, page: 1, pageSize: 25 });
        return;
      }

      const response = await api.get(`/communities/${communityInfo.id}/people`, {
        params: {
          archived: activeTab === "archived",
          search: currentSearch || undefined,
          tag: currentTag || undefined,
          page: 1,
          page_size: 25,
        },
      });
      setRows(response.data.items || []);
      setPageInfo({
        total: response.data.total || 0,
        page: response.data.page || 1,
        pageSize: response.data.page_size || 25,
      });
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to load people.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");

    if (!user) return;

    if (!user.is_admin) {
      navigate(`/people/${user.membership_id}`, { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    loadPeople();
  }, [tab]);

  function updateQuery(nextTab = tab, nextSearch = search, nextTag = ownerTagFilter) {
    const next = new URLSearchParams();
    next.set("tab", nextTab);
    if (nextSearch) next.set("search", nextSearch);
    if (nextTag) next.set("tag", nextTag);
    setSearchParams(next);
  }

  const summaryText = useMemo(() => {
    if (tab === "new") return "New registrations are not exposed by the current API.";
    if (!rows.length) return "No people found.";
    const start = 1;
    const end = rows.length;
    return `${start} – ${end} of ${pageInfo.total}`;
  }, [pageInfo.total, rows.length, tab]);

  return (
    <AppShell
      communityName={community.name}
      headerAction={<Link className="table-action-button" to="/people/new">Add Owners</Link>}
    >
      <Card className="people-page-card">
        <div className="tab-strip">
          {[
            ["active", "Active"],
            ["archived", "Archived"],
            ["new", "New Registrations"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`tab-button ${tab === key ? "active" : ""}`}
              onClick={() => {
                updateQuery(key, search, ownerTagFilter);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="toolbar-row">
          <input
            className="toolbar-input"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateQuery(tab, search, ownerTagFilter);
                loadPeople(tab, search, ownerTagFilter);
              }
            }}
          />
          <input
            className="toolbar-input"
            placeholder="Filter Owner Tags..."
            value={ownerTagFilter}
            onChange={(e) => setOwnerTagFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateQuery(tab, search, ownerTagFilter);
                loadPeople(tab, search, ownerTagFilter);
              }
            }}
          />
          <div className="toolbar-input disabled">Filter Unit Tags...</div>
          <button
            className="toolbar-apply"
            onClick={() => {
              updateQuery(tab, search, ownerTagFilter);
              loadPeople(tab, search, ownerTagFilter);
            }}
          >
            Apply
          </button>
          <button className="toolbar-columns">Columns</button>
        </div>

        {error ? <div className="form-error table-error">{error}</div> : null}

        <div className="table-wrap">
          <table className="people-table">
            <thead>
              <tr>
                <th className="checkbox-col"><input type="checkbox" readOnly /></th>
                <th>NAME ↑</th>
                <th>EMAIL</th>
                <th>OWNER STATUS</th>
                <th>PERMISSIONS</th>
                <th>LAST LOGIN</th>
                <th>UNITS</th>
                <th>TAGS</th>
                <th>PHONE NUMBER</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="loading-cell">Loading...</td>
                </tr>
              ) : tab === "new" ? (
                <tr>
                  <td colSpan="9">
                    <EmptyState text="The current API does not expose registration-request endpoints yet, so this tab is rendered but intentionally disabled." />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="9">
                    <EmptyState text="No records matched the current filters." />
                  </td>
                </tr>
              ) : (
                rows.map((person) => (
                  <tr key={person.membership_id}>
                    <td className="checkbox-col"><input type="checkbox" readOnly /></td>
                    <td>
                      <Link className="name-link" to={`/people/${person.membership_id}`}>
                        {person.full_name}
                      </Link>
                    </td>
                    <td>{person.email || "–"}</td>
                    <td>{prettyPersonType(person.person_type)}</td>
                    <td>{formatAdminRole(person.admin_role, person.locked, person.is_admin)}</td>
                    <td>{formatDate(person.last_login)}</td>
                    <td>
                      {person.units?.length ? (
                        <div className="unit-links">
                          {person.units.map((unit) => (
                            <span key={unit.id} className="unit-link">
                              {unit.address_line_1}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td>
                      <div className="tag-stack">
                        {(person.tags || []).map((tag) => (
                          <TagPill key={tag.id} label={tag.tag} color={autoTagColor(tag.tag)} />
                        ))}
                      </div>
                    </td>
                    <td>{person.phone || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <div>Items per page: {pageInfo.pageSize}</div>
          <div>{summaryText}</div>
        </div>
      </Card>
    </AppShell>
  );
}
