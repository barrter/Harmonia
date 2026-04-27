import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GroupPage from './pages/GroupPage';
import CallbackPage from './pages/CallbackPage';
import './App.css';

function RequireAuth({ children }) {
  const userId = localStorage.getItem('harmonia_user_id');
  return userId ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Login />} />
        <Route path="/callback"  element={<CallbackPage />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/group/:id" element={<RequireAuth><GroupPage /></RequireAuth>} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
