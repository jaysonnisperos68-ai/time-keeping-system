import React, { useState } from 'react';
import { useAuth } from '../main.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try { await login(email, password); } catch (err) { setError(err.message); }
  };

  return (
    <form className="card login" onSubmit={submit}>
      <h2>Time Keeping Login</h2>
      {error && <p className="error">{error}</p>}
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      <button type="submit">Sign in</button>
    </form>
  );
}
