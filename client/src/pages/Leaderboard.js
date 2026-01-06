import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Leaderboard.css';

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [type, setType] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [type]);

  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/leaderboard?type=${type}&limit=100`);
      setLeaderboard(response.data?.leaderboard || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container">Loading...</div>;
  }

  return (
    <div className="container">
      <h1>Leaderboard</h1>
      
      <div className="leaderboard-filters">
        <button
          className={`filter-btn ${type === 'all' ? 'active' : ''}`}
          onClick={() => setType('all')}
        >
          Overall
        </button>
        <button
          className={`filter-btn ${type === 'points' ? 'active' : ''}`}
          onClick={() => setType('points')}
        >
          Points
        </button>
        <button
          className={`filter-btn ${type === 'streak' ? 'active' : ''}`}
          onClick={() => setType('streak')}
        >
          Streak
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Username</th>
              <th>Score</th>
              <th>Points</th>
              <th>Streak</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard && leaderboard.length > 0 ? leaderboard.map((user, index) => (
              <tr key={user.id || user.username || index} className={index < 3 ? `rank-${index + 1}` : ''}>
                <td>
                  {index === 0 && '🥇'}
                  {index === 1 && '🥈'}
                  {index === 2 && '🥉'}
                  {index >= 3 && `#${user.rank}`}
                </td>
                <td>{user.username}</td>
                <td>{Math.round(user.score || 0)}</td>
                <td>{user.total_points || 0}</td>
                <td>🔥 {user.current_streak || 0}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                  No leaderboard data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaderboard;

