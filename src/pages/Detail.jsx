import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { resolveCommunity } from "../api";
import { AppShell, Card, EmptyState, TagPill } from "../components";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function statusFromComm(item) {
  if (item.opened_at || item.status === "OPENED") return "Opened";
  if (item.clicked_at || item.status === "CLICKED") return "Clicked";
  return (item.status || "Sent").toLowerCase().replace(/^[a-z]/, (m) => m.toUpperCase());
}

export default function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [community, setCommunity] = useState({ id: "", name: "" });
  const [detail, setDetail] = useState(null);
  const [notes, setNotes] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [permissions, setPermissions] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [units, setUnits] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [noteText, setNoteText] = useState("");
  const [tagText, setTagText] = useState("");
  const [assignUnitId, setAssignUnitId] = useState("");
  const [isAssignUnitModalOpen, setIsAssignUnitModalOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState("");
  const [adminRole, setAdminRole] = useState("none");
  const [savingTag, setSavingTag] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [assigningUnit, setAssigningUnit] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const communityInfo = await resolveCommunity();
      setCommunity(communityInfo);

      const [
        detailRes,
        notesRes,
        commRes,
        permsRes,
        matrixRes,
        unitsRes,
      ] = await Promise.allSettled([
        api.get(`/communities/${communityInfo.id}/people/${id}`),
        api.get(`/communities/${communityInfo.id}/people/${id}/notes`),
        api.get(`/communities/${communityInfo.id}/people/${id}/communications`),
        api.get(`/communities/${communityInfo.id}/people/${id}/permissions`),
        api.get(`/communities/${communityInfo.id}/people/${id}/permissions/matrix`),
        api.get(`/units`),
      ]);

      if (detailRes.status !== "fulfilled") {
        throw detailRes.reason;
      }

      setDetail(detailRes.value.data);
      setNotes(notesRes.status === "fulfilled" ? (notesRes.value.data.items || []) : []);
      setCommunications(commRes.status === "fulfilled" ? (commRes.value.data.items || []) : []);
      setPermissions(permsRes.status === "fulfilled" ? permsRes.value.data : null);
      setMatrix(matrixRes.status === "fulfilled" ? matrixRes.value.data : null);
      setAdminRole(
        permsRes.status === "fulfilled" ? (permsRes.value.data.admin_role || "none") : "none"
      );
      setUnits(
        unitsRes.status === "fulfilled"
          ? ((unitsRes.value.data || []).filter((unit) => unit.community_id === communityInfo.id))
          : []
      );
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to load person detail.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const availableUnits = useMemo(() => {
    if (!detail) return units;
    const current = new Set((detail.units || []).map((unit) => unit.id));
    return units.filter((unit) => !current.has(unit.id));
  }, [detail, units]);

  const filteredAvailableUnits = useMemo(() => {
    const term = unitSearch.trim().toLowerCase();
    if (!term) return availableUnits;

    return availableUnits.filter((unit) => {
      const haystack = [
        unit.unit_number,
        unit.address_line_1,
        unit.address_line_2,
        unit.city,
        unit.state,
        unit.zip_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [availableUnits, unitSearch]);

  async function addNote() {
    const content = noteText.trim();
    if (!content || !community.id || savingNote) return;

    try {
      setSavingNote(true);
      setError("");

      await api.post(`/communities/${community.id}/people/${id}/notes`, {
        body: content,
      });

      setNoteText("");
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to add note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function saveTag() {
    const tag = tagText.trim();
    if (!tag || !community.id || savingTag) return;

    try {
      setSavingTag(true);
      setError("");

      await api.post(`/communities/${community.id}/people/${id}/tags`, {
        tag,
      });

      setTagText("");
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to add tag.");
    } finally {
      setSavingTag(false);
    }
  }

  async function removeTag(label) {
    try {
      setError("");
      await api.delete(`/communities/${community.id}/people/${id}/tags/${encodeURIComponent(label)}`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to remove tag.");
    }
  }

  async function updatePermissions() {
    try {
      setError("");
      await api.patch(`/communities/${community.id}/people/${id}/permissions`, {
        admin_role: adminRole,
      });
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to update permissions.");
    }
  }

  async function archivePerson(archived) {
    try {
      setError("");
      await api.patch(`/communities/${community.id}/people/${id}/archive`, { archived });
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to update archive status.");
    }
  }

  function openAssignUnitModal() {
    setAssignUnitId("");
    setUnitSearch("");
    setIsAssignUnitModalOpen(true);
  }

  function closeAssignUnitModal() {
    if (assigningUnit) return;
    setIsAssignUnitModalOpen(false);
    setAssignUnitId("");
    setUnitSearch("");
  }

  async function assignUnit() {
    if (!assignUnitId || assigningUnit) return;

    try {
      setAssigningUnit(true);
      setError("");

      const role = detail?.person_type === "tenant" ? "tenant" : "owner";

      await api.post(`/communities/${community.id}/people/${id}/units`, {
        unit_id: assignUnitId,
        role: role.toLowerCase(),
        is_primary: !(detail?.units || []).length,
      });

      closeAssignUnitModal();
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to assign unit.");
    } finally {
      setAssigningUnit(false);
    }
  }

  if (loading) {
    return (
      <AppShell communityName={community.name}>
        <Card>
          <div className="loading-cell">Loading...</div>
        </Card>
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell communityName={community.name}>
        <Card>
          <EmptyState text={error || "Person not found."} />
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell communityName={community.name}>
      {error ? <div className="form-error detail-error">{error}</div> : null}

      <div className="detail-grid-top">
        <Card
          title="Owner Information"
          actions={
            <>
              <button className="mini-button" onClick={updatePermissions}>Permissions</button>
              <button className="mini-button">My Account</button>
              <button className="table-action-button" onClick={() => navigate("/people/new")}>Edit</button>
            </>
          }
        >
          <div className="profile-header">
            <div className="avatar-circle">◉</div>
            <div className="profile-name">{detail.full_name}</div>
            <div className="profile-sub">{detail.membership_id}</div>
            <TagPill label={detail.status === "active" ? "Active" : detail.status} color="green" />
          </div>

          <div className="info-list">
            <div className="info-row">
              <span>{detail.email || "No email on file"}</span>
              <span className="linkish">Send an Email</span>
            </div>
            <div className="info-row">
              <span>{detail.phone || "No phone on file"}</span>
              <span className="linkish">Add a phone number</span>
            </div>
            <div className="info-row">
              <span>{detail.address1 || "No address on file"}</span>
              <span></span>
            </div>
            <div className="info-row">
              <span>{detail.autopay_enabled ? "Autopay Enabled" : "Autopay Disabled"}</span>
              <span className="linkish">Click to Enable</span>
            </div>
            <div className="info-row">
              <span>Last Login</span>
              <span>{formatDate(detail.last_login)}</span>
            </div>
          </div>

          <div className="detail-button-row">
            <button className="mini-button">More info</button>
            <button className="mini-button">Send activation email</button>
          </div>

          <div className="detail-controls-grid">
            <label>
              <span>Admin Role</span>
              <select value={adminRole} onChange={(e) => setAdminRole(e.target.value)}>
                <option value="none">none</option>
                <option value="read_only_admin">read_only_admin</option>
                <option value="people_admin">people_admin</option>
                <option value="community_admin">community_admin</option>
                <option value="super_admin">super_admin</option>
              </select>
            </label>

            <div className="archive-controls">
              <button className="mini-button" onClick={() => archivePerson(true)}>Archive</button>
              <button className="mini-button" onClick={() => archivePerson(false)}>Restore</button>
            </div>
          </div>
        </Card>

        <Card
          title="Owner's Units"
          actions={
            matrix?.actions?.can_assign_units ? (
              <button className="table-action-button" onClick={openAssignUnitModal}>
                Add Unit
              </button>
            ) : null
          }
        >
          <table className="people-table compact-table">
            <thead>
              <tr>
                <th>IMAGE</th>
                <th>NAME</th>
                <th>BALANCE</th>
                <th>ADDRESS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {detail.units?.length ? (
                detail.units.map((unit) => (
                  <tr key={unit.id}>
                    <td><div className="unit-mini-thumb" /></td>
                    <td>{unit.unit_number || unit.address_line_1}</td>
                    <td>$0.00</td>
                    <td>{unit.address_line_1}</td>
                    <td>—</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">
                    <EmptyState text="No units linked to this person." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Communication Log">
        <table className="people-table compact-table">
          <thead>
            <tr>
              <th>SENDER</th>
              <th>TYPE</th>
              <th>SENT TO</th>
              <th>SUBJECT</th>
              <th>CATEGORY</th>
              <th>STATUS</th>
              <th>DATE</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {communications.length ? (
              communications.map((item) => (
                <tr key={item.id}>
                  <td>{item.sender_name || "Veridian Support"}</td>
                  <td>{item.communication_type}</td>
                  <td>{detail.email || "—"}</td>
                  <td>{item.subject || "—"}</td>
                  <td>{item.category || "—"}</td>
                  <td><TagPill label={statusFromComm(item)} color="green" /></td>
                  <td>{formatDate(item.sent_at || item.created_at)}</td>
                  <td className="linkish">View</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8">
                  <EmptyState text="No communications to display." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="detail-grid-bottom">
        <Card title="Tags">
          <div className="tag-editor-row">
            <input
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              placeholder="Owner Tags..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  saveTag();
                }
              }}
            />
            <button
              className="mini-button"
              onClick={saveTag}
              disabled={savingTag || !tagText.trim()}
            >
              {savingTag ? "Adding..." : "Add Tag"}
            </button>
          </div>

          <div className="tag-stack large-gap">
            {(detail.tags || []).map((tag) => (
              <button
                key={tag.id || tag.tag}
                className="tag-button"
                onClick={() => removeTag(tag.tag)}
                type="button"
                title={`Remove ${tag.tag}`}
              >
                <TagPill label={tag.tag} />
              </button>
            ))}
          </div>
        </Card>

        <Card title="Notes">
          <div className="notes-copy">Notes are not visible to owners.</div>

          <div className="note-editor">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add Note"
            />
            <button
              className="mini-button"
              onClick={addNote}
              disabled={savingNote || !noteText.trim()}
            >
              {savingNote ? "Adding..." : "Add Note"}
            </button>
          </div>

          {notes.length ? (
            <div className="notes-list">
              {notes.map((note) => (
                <div key={note.id} className="note-item">
                  <div>{note.content || note.body}</div>
                  <div className="note-date">{formatDate(note.created_at)}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No notes to display." />
          )}
        </Card>
      </div>

      <Card title="Effective Permissions">
        <div className="permissions-grid">
          {(permissions?.effective_permissions || []).map((perm) => (
            <TagPill key={perm} label={perm} color="blue" />
          ))}
          {!permissions?.effective_permissions?.length ? (
            <EmptyState text="No effective permissions found." />
          ) : null}
        </div>

        {matrix ? (
          <div className="matrix-copy">
            View: {String(matrix.actions.can_view)} | Edit: {String(matrix.actions.can_edit)} | Archive: {String(matrix.actions.can_archive)} | Manage permissions: {String(matrix.actions.can_manage_permissions)} | Assign units: {String(matrix.actions.can_assign_units)}
          </div>
        ) : null}
      </Card>

      {isAssignUnitModalOpen ? (
        <div className="modal-backdrop" onClick={closeAssignUnitModal}>
          <div className="modal-card large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Units</h3>
              <button className="mini-button" onClick={closeAssignUnitModal}>✕</button>
            </div>

            <div className="toolbar-row compact">
              <input
                className="toolbar-input"
                placeholder="Search..."
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
              />
            </div>

            <div className="table-wrap unit-picker-table-wrap">
              <table className="people-table compact-table">
                <thead>
                  <tr>
                    <th style={{ width: "48px" }}></th>
                    <th>TITLE</th>
                    <th>ADDRESS</th>
                    <th>BALANCE</th>
                    <th>OWNERS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAvailableUnits.length ? (
                    filteredAvailableUnits.map((unit) => (
                      <tr
                        key={unit.id}
                        className={assignUnitId === unit.id ? "selected-row" : ""}
                        onClick={() => setAssignUnitId(unit.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <input
                            type="radio"
                            checked={assignUnitId === unit.id}
                            onChange={() => setAssignUnitId(unit.id)}
                          />
                        </td>
                        <td>{unit.unit_number || unit.address_line_1}</td>
                        <td>
                          {[unit.address_line_1, unit.city, unit.state, unit.zip_code]
                            .filter(Boolean)
                            .join(", ")}
                        </td>
                        <td>$0.00</td>
                        <td>—</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5">
                        <EmptyState text="No available units found." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-footer">
              <button className="mini-button" onClick={closeAssignUnitModal}>
                Cancel
              </button>
              <button
                className="table-action-button"
                disabled={!assignUnitId || assigningUnit}
                onClick={assignUnit}
              >
                {assigningUnit ? "Adding..." : "Add Unit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}