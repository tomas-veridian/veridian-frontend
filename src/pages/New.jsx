import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api, { resolveCommunity } from "../api";
import { AppShell, Card, EmptyState, TagPill } from "../components";

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];

function unitDisplay(unit) {
  return [unit.address_line_1, unit.city, unit.state, unit.zip_code].filter(Boolean).join(", ");
}

export default function New() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = Boolean(user?.is_admin);

  const activeTab = isAdmin ? (searchParams.get("tab") || "owner") : "owner";

  const [community, setCommunity] = useState({ id: "", name: "" });
  const [units, setUnits] = useState([]);
  const [peopleRows, setPeopleRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [savingOwner, setSavingOwner] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);
  const [error, setError] = useState("");

  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [selectedOwnerIds, setSelectedOwnerIds] = useState([]);

  const [ownerForm, setOwnerForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip_code: "",
    has_separate_mailing_address: true,
    mailing_address1: "",
    mailing_address2: "",
    mailing_city: "",
    mailing_state: "",
    mailing_zip_code: "",
  });

  const [unitForm, setUnitForm] = useState({
    title: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip_code: "",
    starting_balance: "0.00",
    balance_as_of: new Date().toISOString().slice(0, 10),
    lease_start: "",
    lease_end: "",
    parking_attendant_passcode: "",
    include_street_view_image: true,
  });

  useEffect(() => {
    if (!isAdmin && searchParams.get("tab") === "unit") {
      setSearchParams({ tab: "owner" }, { replace: true });
    }
  }, [isAdmin, searchParams, setSearchParams]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const communityInfo = await resolveCommunity();
        setCommunity(communityInfo);

        const [unitResponse, peopleResponse] = await Promise.all([
          api.get(`/communities/${communityInfo.id}/units`),
          api.get(`/communities/${communityInfo.id}/people`, {
          params: {
            page: 1,
            page_size: 100,
          },
        }),
        ]);

        const fetchedUnits = unitResponse.data || [];
        setUnits(fetchedUnits);

        if (fetchedUnits.length) {
          setSelectedUnitId(fetchedUnits[0].id);
        }

        setPeopleRows(peopleResponse.data.items || []);
      } catch (err) {
        setError(err?.response?.data?.detail || err.message || "Failed to load form data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const selectedUnit = useMemo(
    () => units.find((item) => item.id === selectedUnitId),
    [selectedUnitId, units]
  );

  const ownerCandidates = useMemo(() => {
    const term = ownerSearch.trim().toLowerCase();

    const rows = [...peopleRows]
      .filter((person) => person.person_type === "owner" || person.is_admin)
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

    if (!term) return rows;

    return rows.filter((person) =>
      [person.full_name, person.email, person.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [peopleRows, ownerSearch]);

  function changeTab(tab) {
    setSearchParams({ tab });
  }

  async function handleSaveOwner(e) {
    e.preventDefault();
    setSavingOwner(true);
    setError("");

    try {
      const payload = {
        first_name: ownerForm.first_name,
        last_name: ownerForm.last_name,
        email: ownerForm.email || null,
        phone: ownerForm.phone || null,
        person_type: "owner",
        has_separate_mailing_address: ownerForm.has_separate_mailing_address,
        ...(ownerForm.has_separate_mailing_address
          ? {
              mailing_address1: ownerForm.mailing_address1,
              mailing_address2: ownerForm.mailing_address2 || null,
              mailing_city: ownerForm.mailing_city,
              mailing_state: ownerForm.mailing_state,
              mailing_zip_code: ownerForm.mailing_zip_code,
            }
          : {}),
        unit_ids: selectedUnitId ? [selectedUnitId] : [],
        unit_role: selectedUnitId ? "owner" : null,
      };

      const response = await api.post(`/communities/${community.id}/people`, payload);
      navigate(`/people/${response.data.membership_id}`);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to create person.");
    } finally {
      setSavingOwner(false);
    }
  }

  function toggleOwnerSelection(membershipId) {
    setSelectedOwnerIds((prev) =>
      prev.includes(membershipId)
        ? prev.filter((id) => id !== membershipId)
        : [...prev, membershipId]
    );
  }

  async function handleSaveUnit(e) {
    e.preventDefault();
    setSavingUnit(true);
    setError("");

    try {
      const unitPayload = {
        community_id: community.id,
        address_line_1: unitForm.address1,
        address_line_2: unitForm.address2 || null,
        city: unitForm.city || null,
        state: unitForm.state || null,
        zip_code: unitForm.zip_code || null,
        unit_number: unitForm.title || null,
        unit_type_id: null,
        is_rental: false,
        is_active: true,
      };

      const createdUnitResponse = await api.post(`/communities/${community.id}/units`, unitPayload);
      const createdUnit = createdUnitResponse.data;

      for (let index = 0; index < selectedOwnerIds.length; index += 1) {
        const membershipId = selectedOwnerIds[index];

        await api.post(`/communities/${community.id}/people/${membershipId}/units`, {
          unit_id: createdUnit.id,
          role: "owner",
          is_primary: index === 0,
        });
      }

      navigate("/units");
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to create unit.");
    } finally {
      setSavingUnit(false);
    }
  }

  return (
    <AppShell communityName={community.name}>
      <div className="subtabs">
        {isAdmin ? (
          <button
            className={`subtab ${activeTab === "unit" ? "active" : ""}`}
            onClick={() => changeTab("unit")}
            type="button"
          >
            ADD SINGLE UNIT
          </button>
        ) : null}

        <button
          className={`subtab ${activeTab === "owner" ? "active" : ""}`}
          onClick={() => changeTab("owner")}
          type="button"
        >
          ADD SINGLE OWNER
        </button>

        <button
          className={`subtab ${activeTab === "import" ? "active" : ""}`}
          onClick={() => changeTab("import")}
          type="button"
        >
          IMPORT OWNERS AND UNITS
        </button>
      </div>

      {activeTab === "owner" ? (
        <form onSubmit={handleSaveOwner}>
          <Card title="Owner Information">
            {error ? <div className="form-error">{error}</div> : null}

            <div className="form-grid two-col">
              <label>
                <span>FIRST NAME: *</span>
                <input
                  value={ownerForm.first_name}
                  onChange={(e) => setOwnerForm({ ...ownerForm, first_name: e.target.value })}
                  required
                />
              </label>

              <label>
                <span>LAST NAME: *</span>
                <input
                  value={ownerForm.last_name}
                  onChange={(e) => setOwnerForm({ ...ownerForm, last_name: e.target.value })}
                  required
                />
              </label>

              <label>
                <span>EMAIL</span>
                <input
                  value={ownerForm.email}
                  onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })}
                  placeholder="Email..."
                />
              </label>

              <label>
                <span>PHONE</span>
                <input
                  value={ownerForm.phone}
                  onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })}
                  placeholder="Phone..."
                />
              </label>
            </div>

            <label className="checkbox-line owner-checkbox">
              <input
                type="checkbox"
                checked={ownerForm.has_separate_mailing_address}
                onChange={(e) =>
                  setOwnerForm({ ...ownerForm, has_separate_mailing_address: e.target.checked })
                }
              />
              <span>Is the mailing address different than the unit address?</span>
            </label>

            {ownerForm.has_separate_mailing_address ? (
              <div className="form-grid mailing-grid">
                <label className="full-row">
                  <span>ADDRESS *</span>
                  <input
                    value={ownerForm.mailing_address1}
                    onChange={(e) => setOwnerForm({ ...ownerForm, mailing_address1: e.target.value })}
                    placeholder="Address ..."
                    required
                  />
                </label>

                <label>
                  <span>ADDRESS 2</span>
                  <input
                    value={ownerForm.mailing_address2}
                    onChange={(e) => setOwnerForm({ ...ownerForm, mailing_address2: e.target.value })}
                    placeholder="optional"
                  />
                </label>

                <label>
                  <span>CITY *</span>
                  <input
                    value={ownerForm.mailing_city}
                    onChange={(e) => setOwnerForm({ ...ownerForm, mailing_city: e.target.value })}
                    placeholder="City ..."
                    required
                  />
                </label>

                <label>
                  <span>STATE *</span>
                  <select
                    value={ownerForm.mailing_state}
                    onChange={(e) => setOwnerForm({ ...ownerForm, mailing_state: e.target.value })}
                    required
                  >
                    <option value="">– Select –</option>
                    {STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>ZIP *</span>
                  <input
                    value={ownerForm.mailing_zip_code}
                    onChange={(e) => setOwnerForm({ ...ownerForm, mailing_zip_code: e.target.value })}
                    placeholder="ZIP ..."
                    required
                  />
                </label>
              </div>
            ) : null}
          </Card>

          <Card title="Unit">
            <div className="checkbox-group-title">DO THEY OWN ANY PROPERTY?*</div>

            <div className="yes-no-row">
              <label className="checkbox-line">
                <input type="radio" checked readOnly />
                <span>YES</span>
              </label>

              <label className="checkbox-line">
                <input type="radio" readOnly />
                <span>NO</span>
              </label>
            </div>

            <div className="toolbar-row compact">
              <input className="toolbar-input" placeholder="Search..." />
              <div className="toolbar-input disabled">Search by field</div>
              <div className="toolbar-input disabled">Filter by Unit tags...</div>
              <div className="toolbar-input disabled">Filter by Owner tags...</div>
              <button type="button" className="toolbar-columns">Columns</button>
            </div>

            <div className="table-wrap unit-picker-table-wrap">
              <table className="people-table unit-picker-table">
                <thead>
                  <tr>
                    <th className="checkbox-col"></th>
                    <th>IMAGE</th>
                    <th>TITLE ↑</th>
                    <th>ADDRESS</th>
                    <th>OWNERS</th>
                    <th>EMAIL</th>
                    <th>UNIT TAGS</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="loading-cell">Loading units...</td>
                    </tr>
                  ) : !units.length ? (
                    <tr>
                      <td colSpan="7">
                        <EmptyState text="No units were returned by the API for this community." />
                      </td>
                    </tr>
                  ) : (
                    units.slice(0, 8).map((unit) => (
                      <tr
                        key={unit.id}
                        className={selectedUnitId === unit.id ? "selected-row" : ""}
                        onClick={() => setSelectedUnitId(unit.id)}
                      >
                        <td className="checkbox-col">
                          <input type="radio" checked={selectedUnitId === unit.id} readOnly />
                        </td>

                        <td>
                          <div className="house-thumb">
                            <div className="house-thumb-label">HOUSE</div>
                          </div>
                        </td>

                        <td>
                          <span className="name-link">{unit.address_line_1}</span>
                        </td>

                        <td>{unitDisplay(unit)}</td>
                        <td>{selectedUnitId === unit.id ? "Selected Owner" : "—"}</td>
                        <td>—</td>
                        <td>
                          <TagPill label={unit.unit_number || "Villa"} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {selectedUnit ? (
            <div className="selection-note">
              Selected unit: {unitDisplay(selectedUnit)}
            </div>
          ) : null}

          <div className="form-submit-row">
            <button className="table-action-button" disabled={savingOwner} type="submit">
              {savingOwner ? "Saving..." : "Save Owner"}
            </button>
          </div>
        </form>
      ) : null}

      {activeTab === "unit" && isAdmin ? (
        <form onSubmit={handleSaveUnit}>
          {error ? <div className="form-error">{error}</div> : null}

          <div className="unit-form-grid">
            <Card title="Unit Information" className="unit-form-main-card">
              <div className="form-grid unit-form-two-col">
                <label className="full-row">
                  <span>TITLE OF UNIT</span>
                  <input
                    value={unitForm.title}
                    onChange={(e) => setUnitForm({ ...unitForm, title: e.target.value })}
                    placeholder="Unit title"
                    required
                  />
                </label>

                <label className="full-row">
                  <span>ADDRESS *</span>
                  <input
                    value={unitForm.address1}
                    onChange={(e) => setUnitForm({ ...unitForm, address1: e.target.value })}
                    placeholder="Street address"
                    required
                  />
                </label>

                <label className="full-row">
                  <span>&nbsp;</span>
                  <input
                    value={unitForm.address2}
                    onChange={(e) => setUnitForm({ ...unitForm, address2: e.target.value })}
                    placeholder="Apt, suite, bldg, etc. (optional)"
                  />
                </label>

                <label className="full-row">
                  <span>CITY *</span>
                  <input
                    value={unitForm.city}
                    onChange={(e) => setUnitForm({ ...unitForm, city: e.target.value })}
                    required
                  />
                </label>

                <label>
                  <span>STATE *</span>
                  <select
                    value={unitForm.state}
                    onChange={(e) => setUnitForm({ ...unitForm, state: e.target.value })}
                    required
                  >
                    <option value="">– Select –</option>
                    {STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>ZIP CODE *</span>
                  <input
                    value={unitForm.zip_code}
                    onChange={(e) => setUnitForm({ ...unitForm, zip_code: e.target.value })}
                    required
                  />
                </label>
              </div>
            </Card>

            <Card title="Images" className="unit-form-image-card">
              <div className="unit-image-dropzone">
                <div className="unit-image-icon">🖼️</div>
                <div>Drag & drop image here or upload a file</div>
                <div className="unit-image-copy">Upload up to 9 images</div>
              </div>

              <label className="checkbox-line unit-street-view-toggle">
                <span>INCLUDE STREET VIEW IMAGE?</span>
                <input
                  type="checkbox"
                  checked={unitForm.include_street_view_image}
                  onChange={(e) =>
                    setUnitForm({
                      ...unitForm,
                      include_street_view_image: e.target.checked,
                    })
                  }
                />
              </label>
            </Card>
          </div>

          <Card title="Starting Balance">
            <div className="form-grid unit-form-balance-grid">
              <label>
                <span>STARTING BALANCE</span>
                <input
                  value={unitForm.starting_balance}
                  onChange={(e) => setUnitForm({ ...unitForm, starting_balance: e.target.value })}
                />
              </label>

              <label>
                <span>BALANCE AS OF DATE</span>
                <input
                  type="date"
                  value={unitForm.balance_as_of}
                  onChange={(e) => setUnitForm({ ...unitForm, balance_as_of: e.target.value })}
                />
              </label>
            </div>

            <div className="unit-helper-copy">
              Enter a credit balance with a negative number.
            </div>
          </Card>

          <Card title="Tags">
            <div className="unit-disabled-line">Add Unit Tags...</div>
          </Card>

          <Card title="Custom Fields">
            <div className="form-grid unit-form-custom-grid">
              <label>
                <span>LEASE END</span>
                <input
                  type="date"
                  value={unitForm.lease_end}
                  onChange={(e) => setUnitForm({ ...unitForm, lease_end: e.target.value })}
                />
              </label>

              <label>
                <span>LEASE START</span>
                <input
                  type="date"
                  value={unitForm.lease_start}
                  onChange={(e) => setUnitForm({ ...unitForm, lease_start: e.target.value })}
                />
              </label>

              <label className="full-row">
                <span>PARKING ATTENDANT PASSCODE</span>
                <input
                  value={unitForm.parking_attendant_passcode}
                  onChange={(e) =>
                    setUnitForm({ ...unitForm, parking_attendant_passcode: e.target.value })
                  }
                />
              </label>
            </div>
          </Card>

          <Card
            title={`Associate the unit with owner(s) (optional)`}
            actions={<span className="unit-selection-counter">{selectedOwnerIds.length} people selected</span>}
          >
            <div className="unit-owner-picker-toolbar">
              <input
                className="toolbar-input"
                placeholder="Find a person..."
                value={ownerSearch}
                onChange={(e) => setOwnerSearch(e.target.value)}
              />
            </div>

            <div className="unit-owner-picker-list">
              {loading ? (
                <div className="loading-cell">Loading owners...</div>
              ) : ownerCandidates.length === 0 ? (
                <EmptyState text="No people available to associate." />
              ) : (
                <div className="unit-owner-grid">
                  {ownerCandidates.map((person) => (
                    <label key={person.membership_id} className="unit-owner-option">
                      <input
                        type="checkbox"
                        checked={selectedOwnerIds.includes(person.membership_id)}
                        onChange={() => toggleOwnerSelection(person.membership_id)}
                      />
                      <span>{person.full_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="unit-owner-picker-footer">
              Can&apos;t find a person on the list? <span className="name-link">Create new person</span>
            </div>
          </Card>

          <div className="form-submit-row">
            <button className="table-action-button" disabled={savingUnit} type="submit">
              {savingUnit ? "Creating..." : "Create New Unit"}
            </button>
          </div>
        </form>
      ) : null}

      {activeTab === "import" ? (
        <Card title="Import Owners and Units">
          <EmptyState text="This tab is rendered so the navigation matches the design. The import workflow is not wired yet." />
        </Card>
      ) : null}
    </AppShell>
  );
}