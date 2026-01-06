import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="home">
      <div className="hero">
        <h1>Welcome to Learning Platform</h1>
        <p className="subtitle">Master new skills, track your progress, and climb the leaderboard</p>
        {!user ? (
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary">
              Get Started
            </Link>
            <Link to="/login" className="btn btn-secondary">
              Login
            </Link>
          </div>
        ) : (
          <div className="hero-actions">
            <Link to="/courses" className="btn btn-primary">
              Browse Courses
            </Link>
          </div>
        )}
      </div>

      <div className="features">
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <h3>Track Progress</h3>
          <p>Monitor your learning journey with detailed progress tracking</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🔥</div>
          <h3>Streak System</h3>
          <p>Build daily learning streaks and maintain consistency</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🏆</div>
          <h3>Leaderboard</h3>
          <p>Compete with others and see where you rank</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">💰</div>
          <h3>Earn Rewards</h3>
          <p>Earn currency and points as you complete topics</p>
        </div>
      </div>
    </div>
  );
};

export default Home;

