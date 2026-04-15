import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { resolveCommunity } from "../api";
import { AppShell, EmptyState, TagPill } from "../components";

function formatMoney(value) {
  const num = Number(value || 0);
  return `$${num.toFixed(2)}`;
}

function unitDisplay(unit) {
  return [unit.address_line_1, unit.city, unit.state, unit.zip_code].filter(Boolean).join(", ");
}

function unitSearchText(unit, owners) {
  return [
    unit.unit_number,
    unit.address_line_1,
    unit.address_line_2,
    unit.city,
    unit.state,
    unit.zip_code,
    ...(owners || []).map((owner) => owner.full_name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildOwnersByUnit(people) {
  const map = new Map();

  for (const person of people || []) {
    for (const unit of person.units || []) {
      if (!map.has(unit.id)) {
        map.set(unit.id, []);
      }

      map.get(unit.id).push({
        membership_id: person.membership_id,
        full_name: person.full_name,
        email: person.email,
        phone: person.phone,
        tags: person.tags || [],
      });
    }
  }

  return map;
}

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function Units() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = Boolean(user?.is_admin);

  const [community, setCommunity] = useState({ id: "", name: "" });
  const [units, setUnits] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingPdfs, setDownloadingPdfs] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("address");
  const [selectedUnitIds, setSelectedUnitIds] = useState([]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const communityInfo = await resolveCommunity();
      setCommunity(communityInfo);

      const unitsRes = await api.get(`/communities/${communityInfo.id}/units`);
      setUnits(unitsRes.data || []);

      if (isAdmin) {
        try {
          const peopleRes = await api.get(`/communities/${communityInfo.id}/people`, {
            params: {
              page: 1,
              page_size: 100,
            },
          });

          setPeople(peopleRes.data.items || []);
        } catch (peopleErr) {
          const status = peopleErr?.response?.status;

          if (status === 401 || status === 403) {
            setPeople([]);
          } else {
            throw peopleErr;
          }
        }
      } else {
        setPeople([]);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to load units.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const ownersByUnit = useMemo(() => buildOwnersByUnit(people), [people]);

  const filteredUnits = useMemo(() => {
    const term = search.trim().toLowerCase();

    let rows = [...units];

    if (term) {
      rows = rows.filter((unit) => {
        const owners = ownersByUnit.get(unit.id) || [];
        return unitSearchText(unit, owners).includes(term);
      });
    }

    rows.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      if (sortBy === "city") {
        return (a.city || "").localeCompare(b.city || "");
      }

      return (a.address_line_1 || "").localeCompare(b.address_line_1 || "");
    });

    return rows;
  }, [units, ownersByUnit, search, sortBy]);

  const allVisibleSelected =
    filteredUnits.length > 0 && filteredUnits.every((unit) => selectedUnitIds.includes(unit.id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedUnitIds((prev) => prev.filter((id) => !filteredUnits.some((unit) => unit.id === id)));
      return;
    }

    const next = new Set(selectedUnitIds);
    filteredUnits.forEach((unit) => next.add(unit.id));
    setSelectedUnitIds([...next]);
  }

  function toggleSelectOne(unitId) {
    setSelectedUnitIds((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  }

  async function handleExportCsv() {
    if (!community.id || downloadingCsv) return;

    try {
      setDownloadingCsv(true);
      const response = await api.get(`/communities/${community.id}/units/export/csv`, {
        responseType: "blob",
      });

      downloadBlob(response.data, `units-${community.id}.csv`);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to export CSV.");
    } finally {
      setDownloadingCsv(false);
    }
  }

  async function handleAccountHistoryPdfs() {
    if (!community.id || downloadingPdfs) return;

    try {
      setDownloadingPdfs(true);
      const response = await api.get(`/communities/${community.id}/units/account-history-pdfs`, {
        responseType: "blob",
      });

      downloadBlob(response.data, `unit-account-history-pdfs-${community.id}.zip`);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to generate account history PDFs.");
    } finally {
      setDownloadingPdfs(false);
    }
  }

  return (
    <AppShell communityName={community.name}>
      {error ? <div className="form-error table-error">{error}</div> : null}

      <section className="units-page">
        <div className="units-page-header">
          <div className="units-title-row">
            <h1>Units</h1>
            <span className="units-grid-icon">▦</span>
            <span className="units-count">{filteredUnits.length} unit(s)</span>
          </div>

          {isAdmin ? (
            <div className="units-header-actions">
              <button
                className="unit-header-secondary"
                onClick={handleAccountHistoryPdfs}
                disabled={downloadingPdfs}
              >
                {downloadingPdfs ? "Generating..." : "Account History PDFs"}
              </button>

              <button
                className="unit-header-secondary"
                onClick={handleExportCsv}
                disabled={downloadingCsv}
              >
                {downloadingCsv ? "Exporting..." : "Export CSV"}
              </button>

              <button
                className="table-action-button"
                onClick={() => navigate("/people/new?tab=unit")}
              >
                + Add Units
              </button>
            </div>
          ) : null}
        </div>

        <div className="units-toolbar">
          <input
            className="toolbar-input"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="toolbar-input units-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="address">Sort by</option>
            <option value="address">Address</option>
            <option value="city">City</option>
            <option value="newest">Newest</option>
          </select>

          <label className="units-select-all">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
            <span>Select all units</span>
          </label>

          <div className="toolbar-input disabled">Filter by Unit tags...</div>
          <div className="toolbar-input disabled">Filter by Owner tags...</div>
        </div>

        {loading ? (
          <div className="card">
            <div className="loading-cell">Loading units...</div>
          </div>
        ) : filteredUnits.length === 0 ? (
          <div className="card">
            <EmptyState text="No units matched the current filters." />
          </div>
        ) : (
          <>
            <div className="units-grid">
              {filteredUnits.map((unit) => {
                const owners = ownersByUnit.get(unit.id) || [];
                const ownerNames = owners.map((owner) => owner.full_name).slice(0, 2);
                const extraOwners = Math.max(owners.length - 2, 0);
                const ownerTag = owners.flatMap((owner) => owner.tags || []).find((tag) => /missing/i.test(tag.tag));

                return (
                  <article key={unit.id} className="unit-card">
                    <div className="unit-card-topline">
                      <div className="unit-card-owner-links">
                        {ownerNames.length ? (
                          ownerNames.map((name) => (
                            <span key={`${unit.id}-${name}`} className="unit-card-owner-link">
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="unit-card-owner-link muted">No owner assigned</span>
                        )}
                      </div>
                    </div>

                    <div className="unit-card-meta-top">
                      <button
                        className="unit-card-select"
                        type="button"
                        onClick={() => toggleSelectOne(unit.id)}
                      >
                        <input type="checkbox" checked={selectedUnitIds.includes(unit.id)} readOnly />
                      </button>

                      <div className="unit-card-mini-tags">
                        {ownerTag ? <TagPill label={ownerTag.tag} color="gray" /> : null}
                        <TagPill label={unit.unit_number || "Villa"} color="gray" />
                      </div>
                    </div>

                    <div className="unit-card-image-wrap">
                      {unit.is_rental ? <div className="unit-card-ribbon red">$0.00 Past Due</div> : null}
                      {!unit.is_rental && unit.is_active ? (
                        <div className="unit-card-ribbon green">Autopay Enabled</div>
                      ) : null}

                      <div className="unit-card-image">
                        <div className="unit-card-image-house"></div>
                      </div>
                    </div>

                    <div className="unit-card-body">
                      <div className="unit-card-title">{unit.address_line_1}</div>

                      <div className="unit-card-address-line">{unit.address_line_1}</div>
                      <div className="unit-card-address-line">
                        {[unit.city, unit.state, unit.zip_code].filter(Boolean).join(" ")}
                      </div>

                      <div className="unit-card-financial-row">
                        <div className="unit-card-financial-value">{formatMoney(0)}</div>
                        <div className="unit-card-financial-label">Outstanding Balance</div>
                      </div>

                      <div className="unit-card-financial-row">
                        <div className="unit-card-financial-value">{formatMoney(0)}</div>
                        <div className="unit-card-financial-label">Recurring Charges Monthly</div>
                      </div>

                      <div className="unit-card-owners-row">
                        {owners.length ? (
                          <>
                            <span className="unit-card-owner-footer">{owners[0].full_name}</span>
                            {owners[1] ? (
                              <>
                                <span className="unit-card-owner-sep">|</span>
                                <span className="unit-card-owner-footer">{owners[1].full_name}</span>
                              </>
                            ) : null}
                            {extraOwners > 0 ? (
                              <>
                                <span className="unit-card-owner-sep">|</span>
                                <span className="unit-card-owner-footer">+{extraOwners}</span>
                              </>
                            ) : null}
                          </>
                        ) : (
                          <span className="unit-card-owner-footer muted">No linked owners</span>
                        )}
                      </div>

                      <div className="unit-card-bottom-tags">
                        <TagPill label={unit.unit_number || "Villa"} color="gray" />
                        {unit.is_rental ? <TagPill label="Rental" color="yellow" /> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="table-footer units-footer">
              <div>Items per page: 50</div>
              <div>1 – {filteredUnits.length} of {filteredUnits.length}</div>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}