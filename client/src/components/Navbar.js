import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          📚 Learning Platform
        </Link>
        <div className="navbar-links">
          {user ? (
            <>
              <Link to="/courses">Courses</Link>
              <Link to="/progress">Progress</Link>
              <Link to="/leaderboard">Leaderboard</Link>
              {user.email === process.env.REACT_APP_ADMIN_EMAIL && (
                <Link to="/admin">Admin</Link>
              )}
              <div className="navbar-user">
                <span>👤 {user.username}</span>
                <span className="currency">💰 {user.currency || 0}</span>
                <button onClick={handleLogout} className="btn-logout">
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

