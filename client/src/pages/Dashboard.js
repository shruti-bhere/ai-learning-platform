import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/progress');
      setProgress(response.data);
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (topic, percentage) => {
    try {
      const points = percentage === 100 ? 10 : 0;
      await axios.post('http://localhost:5000/api/progress/update', {
        topic,
        progress_percentage: percentage,
        points_earned: points
      });
      fetchProgress();
      // Refresh user data
      window.location.reload();
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  };

  if (loading) {
    return <div className="container">Loading...</div>;
  }

  return (
    <div className="container">
      <h1>Welcome, {user?.username}!</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Points</h3>
          <div className="value">{user?.total_points || 0}</div>
        </div>
        <div className="stat-card">
          <h3>Currency</h3>
          <div className="value">💰 {user?.currency || 0}</div>
        </div>
        <div className="stat-card">
          <h3>Current Streak</h3>
          <div className="value">🔥 {user?.current_streak || 0} days</div>
        </div>
        <div className="stat-card">
          <h3>Completed Topics</h3>
          <div className="value">{progress?.completed_topics || 0}</div>
        </div>
      </div>

      <div className="card">
        <h2>Learning Topics</h2>
        <div className="topics-list">
          {['Node.js', 'Database Design', 'API Development'].map((topic) => {
            const topicProgress = progress?.topics?.find(p => p.topic === topic);
            const percentage = topicProgress?.progress_percentage || 0;
            
            return (
              <div key={topic} className="topic-item">
                <div className="topic-header">
                  <h3>{topic}</h3>
                  <span className="progress-percentage">{percentage}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${percentage}%` }}></div>
                </div>
                <div className="topic-actions">
                  <button
                    onClick={() => updateProgress(topic, Math.min(percentage + 25, 100))}
                    className="btn btn-primary"
                    disabled={percentage === 100}
                  >
                    {percentage === 100 ? 'Completed ✓' : 'Add Progress'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

