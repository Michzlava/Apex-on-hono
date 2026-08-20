import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import "./login.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await login(form.email, form.password);

    if (!result.success) {
      setError(result.error || "Invalid credentials");
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  }

  return (
    <div className="login-shell">
      <div className="login-brand">
        <Logo width={200} height={62} />
      </div>

      <div className="login-card">
        <p className="login-welcome">Welcome back,</p>
        <h3 className="login-title">Sign in</h3>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}

          <div className="field">
            <div className="field-header">
              <label>Email address</label>
            </div>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={error ? "error-input" : ""}
              required
              autoComplete
