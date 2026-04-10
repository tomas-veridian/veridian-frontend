import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { resolveCommunity } from "../api";
import { AppShell, Card, EmptyState, TagPill } from "../components";

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

function unitDisplay(unit) {
  return [unit.address_line_1, unit.city, unit.state, unit.zip_code].filter(Boolean).join(", ");
}

export default function New() {
  const navigate = useNavigate();
  const [community, setCommunity] = useState({ id: "", name: "" });
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [form, setForm] = useState({
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

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const communityInfo = await resolveCommunity();
        setCommunity(communityInfo);
        const unitResponse = await api.get("/units");
        const filtered = (unitResponse.data || []).filter((unit) => unit.community_id === communityInfo.id);
        setUnits(filtered);
        if (filtered.length) {
          setSelectedUnitId(filtered[0].id);
        }
      } catch (err) {
        setError(err?.response?.data?.detail || err.message || "Failed to load form data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const selectedUnit = useMemo(() => units.find((item) => item.id === selectedUnitId), [selectedUnitId, units]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        person_type: "owner",
        has_separate_mailing_address: form.has_separate_mailing_address,
        ...(form.has_separate_mailing_address
          ? {
              mailing_address1: form.mailing_address1,
              mailing_address2: form.mailing_address2 || null,
              mailing_city: form.mailing_city,
              mailing_state: form.mailing_state,
              mailing_zip_code: form.mailing_zip_code,
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
      setSaving(false);
    }
  }

  return (
    <AppShell communityName={community.name}>
      <div className="subtabs">
        <button className="subtab">ADD SINGLE UNIT</button>
        <button className="subtab active">ADD SINGLE OWNER</button>
        <button className="subtab">IMPORT OWNERS AND UNITS</button>
      </div>

      <form onSubmit={handleSave}>
        <Card title="Owner Information">
          {error ? <div className="form-error">{error}</div> : null}
          <div className="form-grid two-col">
            <label>
              <span>FIRST NAME: *</span>
              <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            </label>
            <label>
              <span>LAST NAME: *</span>
              <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
            </label>
            <label>
              <span>EMAIL</span>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email..." />
            </label>
            <label>
              <span>PHONE</span>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone..." />
            </label>
          </div>

          <label className="checkbox-line owner-checkbox">
            <input
              type="checkbox"
              checked={form.has_separate_mailing_address}
              onChange={(e) => setForm({ ...form, has_separate_mailing_address: e.target.checked })}
            />
            <span>Is the mailing address different than the unit address?</span>
          </label>

          {form.has_separate_mailing_address ? (
            <div className="form-grid mailing-grid">
              <label className="full-row">
                <span>ADDRESS *</span>
                <input
                  value={form.mailing_address1}
                  onChange={(e) => setForm({ ...form, mailing_address1: e.target.value })}
                  placeholder="Address ..."
                  required
                />
              </label>
              <label>
                <span>ADDRESS 2</span>
                <input
                  value={form.mailing_address2}
                  onChange={(e) => setForm({ ...form, mailing_address2: e.target.value })}
                  placeholder="optional"
                />
              </label>
              <label>
                <span>CITY *</span>
                <input value={form.mailing_city} onChange={(e) => setForm({ ...form, mailing_city: e.target.value })} placeholder="City ..." required />
              </label>
              <label>
                <span>STATE *</span>
                <select value={form.mailing_state} onChange={(e) => setForm({ ...form, mailing_state: e.target.value })} required>
                  <option value="">– Select –</option>
                  {STATES.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>ZIP *</span>
                <input value={form.mailing_zip_code} onChange={(e) => setForm({ ...form, mailing_zip_code: e.target.value })} placeholder="ZIP ..." required />
              </label>
            </div>
          ) : null}
        </Card>

        <Card title="Unit">
          <div className="checkbox-group-title">DO THEY OWN ANY PROPERTY?*</div>
          <div className="yes-no-row">
            <label className="checkbox-line"><input type="radio" checked readOnly /> <span>YES</span></label>
            <label className="checkbox-line"><input type="radio" readOnly /> <span>NO</span></label>
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
                  <tr><td colSpan="7" className="loading-cell">Loading units...</td></tr>
                ) : !units.length ? (
                  <tr><td colSpan="7"><EmptyState text="No units were returned by the API for this community." /></td></tr>
                ) : (
                  units.slice(0, 8).map((unit) => (
                    <tr key={unit.id} className={selectedUnitId === unit.id ? "selected-row" : ""} onClick={() => setSelectedUnitId(unit.id)}>
                      <td className="checkbox-col"><input type="radio" checked={selectedUnitId === unit.id} readOnly /></td>
                      <td>
                        <div className="house-thumb">
                          <div className="house-thumb-label">HOUSE</div>
                        </div>
                      </td>
                      <td><span className="name-link">{unit.address_line_1}</span></td>
                      <td>{unitDisplay(unit)}</td>
                      <td>{selectedUnitId === unit.id ? "Selected Owner" : "—"}</td>
                      <td>—</td>
                      <td><TagPill label={unit.unit_number || "Villa"} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {selectedUnit ? <div className="selection-note">Selected unit: {unitDisplay(selectedUnit)}</div> : null}

        <div className="form-submit-row">
          <button className="table-action-button" disabled={saving} type="submit">{saving ? "Saving..." : "Save Owner"}</button>
        </div>
      </form>
    </AppShell>
  );
}
