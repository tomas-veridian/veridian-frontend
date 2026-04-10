import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { resolveCommunity } from "../api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", response.data.access_token);

      const community = await resolveCommunity();

      // Cambiá este endpoint si en tu backend el "me" tiene otro path
      const meResponse = await api.get(`/communities/${community.id}/people/me`);

      localStorage.setItem("user", JSON.stringify({
        membership_id: meResponse.data.membership_id,
        is_admin: meResponse.data.is_admin,
      }));

      if (meResponse.data.is_admin) {
        navigate("/people");
      } else {
        navigate(`/people/${meResponse.data.membership_id}`);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-logo">PAY <span>HOA</span></div>
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Sign In to your account below.</h1>
        <label>
          <span>Email*</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            type="email"
          />
        </label>
        <label>
          <span>Password*</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            type="password"
          />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <button className="login-button" disabled={loading} type="submit">
          {loading ? "Signing In..." : "Log in"}
        </button>
        <div className="forgot-link">Forgot your password?</div>
      </form>
      <div className="signup-copy">
        Don&apos;t have an account? <span>Sign up</span>
      </div>
    </div>
  );
}