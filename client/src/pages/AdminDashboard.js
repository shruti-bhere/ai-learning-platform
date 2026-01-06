import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './AdminDashboard.css';
import CourseManagement from './CourseManagement';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [newCourse, setNewCourse] = useState({ name: '', description: '', icon: '' });
  const [newLesson, setNewLesson] = useState({
    title: '',
    content: '',
    difficulty: 'beginner',
    estimated_time: 20,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const courseManagementRef = useRef(null);

  useEffect(() => {
    fetchStats();
    fetchSessions();
    fetchCourses();
    // Refresh stats every 30 seconds for live data
    const statsInterval = setInterval(fetchStats, 30000);
    // Refresh sessions every minute
    const sessionsInterval = setInterval(fetchSessions, 60000);
    return () => {
      clearInterval(statsInterval);
      clearInterval(sessionsInterval);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/admin/dashboard');
      setStats(response.data);
      setError(''); // Clear any previous errors
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
      if (!stats) {
        // Only set error on initial load, not on refresh
        setError('Failed to load dashboard statistics. Please refresh the page.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await axios.get(
        'http://localhost:5000/api/admin/sessions/recent?limit=50'
      );
      setSessions(response.data?.sessions || response.data || []);
    } catch (err) {
      console.error('Failed to fetch admin sessions:', err);
      // Don't show error for sessions as it's not critical
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/courses');
      const coursesData = Array.isArray(response.data) ? response.data : (response.data?.courses || []);
      setCourses(coursesData);
      setError(''); // Clear any previous errors
    } catch (err) {
      console.error('Failed to fetch courses:', err);
      setError('Failed to load courses. Please refresh the page.');
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.post('http://localhost:5000/api/admin/courses', {
        name: newCourse.name,
        description: newCourse.description,
        icon: newCourse.icon,
      });
      setSuccess('Course created successfully');
      setNewCourse({ name: '', description: '', icon: '' });
      await fetchCourses();
    } catch (err) {
      console.error('Failed to create course:', err);
      setError(err.response?.data?.error || 'Failed to create course');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to delete this course and all its lessons?')) {
      return;
    }
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.delete(`http://localhost:5000/api/admin/courses/${courseId}`);
      setSuccess('Course deleted successfully');
      if (selectedCourseId === String(courseId)) {
        setSelectedCourseId('');
      }
      await fetchCourses();
    } catch (err) {
      console.error('Failed to delete course:', err);
      setError(err.response?.data?.error || 'Failed to delete course');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLesson = async (e) => {
    e.preventDefault();
    if (!selectedCourseId) {
      setError('Please select a course before adding a lesson');
      return;
    }
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.post(
        `http://localhost:5000/api/admin/courses/${selectedCourseId}/lessons`,
        newLesson
      );
      setSuccess('Lesson created successfully');
      setNewLesson({
        title: '',
        content: '',
        difficulty: 'beginner',
        estimated_time: 20,
      });
      // Refresh courses to reflect updated lesson counts
      await fetchCourses();
    } catch (err) {
      console.error('Failed to create lesson:', err);
      setError(err.response?.data?.error || 'Failed to create lesson');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async () => {
    const lessonId = window.prompt(
      'Enter the Lesson ID to delete (you can find it from the lesson admin tools or database)'
    );
    if (!lessonId) return;
    if (!window.confirm('Are you sure you want to delete this lesson?')) {
      return;
    }
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.delete(`http://localhost:5000/api/admin/lessons/${lessonId}`);
      setSuccess('Lesson deleted successfully');
      await fetchCourses();
    } catch (err) {
      console.error('Failed to delete lesson:', err);
      setError(err.response?.data?.error || 'Failed to delete lesson');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container">Loading...</div>;
  }

  const totalLessons = courses.reduce(
    (sum, course) => sum + (Number(course.total_lessons) || 0),
    0
  );
  const averageLessons =
    courses.length > 0 ? Math.round((totalLessons / courses.length) * 10) / 10 : 0;
  const selectedCourse =
    courses.find((c) => String(c.id) === String(selectedCourseId)) || null;

  return (
    <div className="container admin-dashboard">
      <div className="page-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="subtitle">Monitor activity and manage courses/lessons</p>
        </div>
        <div className="header-pill">Real-time data</div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Users</h3>
          <div className="value">{stats?.total_users || 0}</div>
        </div>
        <div className="stat-card">
          <h3>Monthly Active Users</h3>
          <div className="value">{stats?.monthly_users || 0}</div>
        </div>
        <div className="stat-card">
          <h3>Daily Active Users</h3>
          <div className="value">{stats?.daily_users || 0}</div>
        </div>
        <div className="stat-card">
          <h3>Live Active Users</h3>
          <div className="value">{stats?.live_users || 0}</div>
        </div>
      </div>

      <div className="card">
        <h2>Recent Activity</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Active Users</th>
              <th>Points Earned</th>
              <th>Topics Completed</th>
            </tr>
          </thead>
          <tbody>
            {stats?.activity_data && stats.activity_data.length > 0 ? (
              stats.activity_data.slice(0, 10).map((activity, index) => (
              <tr key={index}>
                <td>{new Date(activity.activity_date).toLocaleDateString()}</td>
                  <td>{activity.active_users || 0}</td>
                  <td>{activity.total_points || 0}</td>
                  <td>{activity.total_topics || 0}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
                  No activity data available yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Recent Login / Logout Sessions</h2>
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Login Time</th>
              <th>Logout Time</th>
              <th>Duration (hours)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions && sessions.length > 0 ? (
              sessions.map((session) => {
              const durationMinutes = Number(session.duration_minutes) || 0;
              const durationHours = durationMinutes / 60;
              return (
                <tr key={session.id}>
                    <td>{session.username || 'N/A'}</td>
                    <td>{session.email || 'N/A'}</td>
                  <td>{new Date(session.session_start).toLocaleString()}</td>
                  <td>
                    {session.session_end
                      ? new Date(session.session_end).toLocaleString()
                      : '-'}
                  </td>
                  <td>{durationHours.toFixed(2)}</td>
                    <td>
                      <span style={{ 
                        color: session.is_active ? '#0f9d58' : '#6b7280',
                        fontWeight: session.is_active ? 600 : 400
                      }}>
                        {session.is_active ? 'Active' : 'Ended'}
                      </span>
                    </td>
                </tr>
              );
              })
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
                  No session data available yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Compact overview of existing courses with counts */}
      <div className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Browse</p>
            <h2>Existing Courses</h2>
            <p className="section-subtitle">
              Quick overview of each course, including topics and lessons.
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              // Scroll to Course Management section
              const courseManagementSection = document.querySelector('.admin-course-management-wrapper');
              if (courseManagementSection) {
                courseManagementSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
              // Trigger the new course form in CourseManagement
              if (courseManagementRef.current) {
                setTimeout(() => {
                  courseManagementRef.current?.triggerNewCourse();
                }, 300); // Small delay to allow scroll to complete
              }
            }}
            title="Add New Course"
          >
            + Add Course
          </button>
        </div>

        <div className="admin-course-summary-bar">
          <button
            className="admin-course-scroll admin-course-scroll-left"
            type="button"
            onClick={() => {
              const el = document.querySelector('.admin-course-summary-list');
              if (el) el.scrollBy({ left: -400, behavior: 'smooth' });
            }}
            disabled={courses.length === 0}
          >
            ◀
                </button>

          <div className="admin-course-summary-list">
            {courses.length > 0 ? (
              courses.map((course) => {
                const topicsCount = Number(course.total_topics) || 0;
                const lessonsCount = Number(course.total_lessons) || 0;

                return (
                <div
                  key={course.id}
                    className="admin-course-card"
                >
                    <div className="admin-course-card-header">
                      <div className="admin-course-icon">
                        {course.icon || '📚'}
                      </div>
                  <div>
                        <div className="admin-course-name">{course.name}</div>
                        <div className="admin-course-slug">/{course.slug}</div>
                      </div>
                    </div>
                    <div className="admin-course-card-body">
                      <div className="admin-course-stat">
                        <span className="label">Topics</span>
                        <span className="value">{topicsCount}</span>
                      </div>
                      <div className="admin-course-stat">
                        <span className="label">Lessons</span>
                        <span className="value">{lessonsCount}</span>
                      </div>
                    </div>
                    <div className="admin-course-card-actions">
                  <button
                        className="btn-delete-course-card"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCourse(course.id);
                    }}
                        title="Delete Course"
                  >
                    Delete
                  </button>
                </div>
            </div>
                );
              })
            ) : (
              <div className="admin-course-summary-empty">
                No courses found. Create your first course below.
              </div>
            )}
          </div>

            <button
            className="admin-course-scroll admin-course-scroll-right"
              type="button"
            onClick={() => {
              const el = document.querySelector('.admin-course-summary-list');
              if (el) el.scrollBy({ left: 400, behavior: 'smooth' });
            }}
            disabled={courses.length === 0}
            >
            ▶
            </button>
          </div>
        </div>

      {/* Embedded Course Management UI (no extra outer heading) */}
      <div className="admin-course-management-wrapper">
        <CourseManagement 
          ref={courseManagementRef} 
          hideCreate={false}
          onCourseUpdate={fetchCourses}
        />
      </div>
    </div>
  );
};

export default AdminDashboard;

