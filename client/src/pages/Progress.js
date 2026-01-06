import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Progress.css';

const Progress = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('courses'); // 'courses', 'lessons', 'topics'

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

  if (loading) {
    return <div className="container">Loading...</div>;
  }

  const totalLessons = progress?.courses?.reduce((sum, course) => sum + (parseInt(course.total_lessons) || 0), 0) || 0;
  const completedLessons = progress?.courses?.reduce((sum, course) => sum + (parseInt(course.lessons_completed) || 0), 0) || 0;

  return (
    <div className="container">
      <h1>Your Progress</h1>
      
      <div className="progress-summary">
        <div className="summary-card">
          <h3>Total Courses</h3>
          <div className="summary-value">{progress?.courses?.length || 0}</div>
        </div>
        <div className="summary-card">
          <h3>Lessons Completed</h3>
          <div className="summary-value">{completedLessons} / {totalLessons}</div>
        </div>
        <div className="summary-card">
          <h3>Total Points</h3>
          <div className="summary-value">{progress?.total_points || 0}</div>
        </div>
        <div className="summary-card">
          <h3>Completion Rate</h3>
          <div className="summary-value">
            {totalLessons > 0
              ? Math.round((completedLessons / totalLessons) * 100)
              : 0}%
          </div>
        </div>
      </div>

      <div className="progress-tabs">
        <button
          className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          Courses
        </button>
        <button
          className={`tab-btn ${activeTab === 'lessons' ? 'active' : ''}`}
          onClick={() => setActiveTab('lessons')}
        >
          Lessons
        </button>
        <button
          className={`tab-btn ${activeTab === 'topics' ? 'active' : ''}`}
          onClick={() => setActiveTab('topics')}
        >
          Topics
        </button>
      </div>

      {activeTab === 'courses' && (
        <div className="card">
          <h2>Course Progress</h2>
          {progress?.courses && progress.courses.length > 0 ? (
            <div className="courses-list">
              {progress.courses.map((course) => {
                const completionRate = course.total_lessons > 0
                  ? Math.round((course.lessons_completed / course.total_lessons) * 100)
                  : 0;
                
                return (
                  <div key={course.id} className="course-progress-item">
                    <div className="course-header">
                      <Link to={`/courses/${course.slug}`} className="course-link">
                        <h3>{course.name}</h3>
                      </Link>
                      <span className="course-points">💰 {course.course_points || 0} pts</span>
                    </div>
                    <div className="course-stats">
                      <span>Lessons: {course.lessons_completed} / {course.total_lessons} completed</span>
                      <span>Started: {course.lessons_started || 0}</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${completionRate}%` }}
                      ></div>
                    </div>
                    <div className="progress-text">{completionRate}% Complete</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p>No course progress yet. <Link to="/courses">Browse courses</Link> to get started!</p>
          )}
        </div>
      )}

      {activeTab === 'lessons' && (
        <div className="card">
          <h2>Lesson Progress</h2>
          {progress?.lessons && progress.lessons.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Lesson</th>
                  <th>Difficulty</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Points</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {progress.lessons.map((lesson) => (
                  <tr key={lesson.lesson_id}>
                    <td>
                      <Link to={`/courses/${lesson.course_slug}`}>
                        {lesson.course_name}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/courses/${lesson.course_slug}/lessons/${lesson.lesson_slug}`}>
                        {lesson.lesson_title}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge badge-${lesson.difficulty}`}>
                        {lesson.difficulty}
                      </span>
                    </td>
                    <td>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${lesson.progress_percentage}%` }}
                        ></div>
                      </div>
                      <span className="progress-text">{lesson.progress_percentage}%</span>
                    </td>
                    <td>
                      {lesson.completed ? (
                        <span className="badge badge-success">Completed</span>
                      ) : (
                        <span className="badge badge-warning">In Progress</span>
                      )}
                    </td>
                    <td>{lesson.points_earned || 0}</td>
                    <td>
                      {lesson.completed_at
                        ? new Date(lesson.completed_at).toLocaleDateString()
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No lesson progress yet. Start a lesson to see your progress here!</p>
          )}
        </div>
      )}

      {activeTab === 'topics' && (
        <div className="card">
          <h2>Topic Details</h2>
          {progress?.topics && progress.topics.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Points</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {progress.topics.map((topic, index) => (
                  <tr key={index}>
                    <td>{topic.topic}</td>
                    <td>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${topic.progress_percentage}%` }}
                        ></div>
                      </div>
                      <span className="progress-text">{topic.progress_percentage}%</span>
                    </td>
                    <td>
                      {topic.completed ? (
                        <span className="badge badge-success">Completed</span>
                      ) : (
                        <span className="badge badge-warning">In Progress</span>
                      )}
                    </td>
                    <td>{topic.points_earned || 0}</td>
                    <td>
                      {topic.completed_at
                        ? new Date(topic.completed_at).toLocaleDateString()
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No topic progress yet. Start learning to see your progress here!</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Progress;

