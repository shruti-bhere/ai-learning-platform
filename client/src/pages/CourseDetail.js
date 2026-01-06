import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CourseDetail.css';

const CourseDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourse();
  }, [slug]);

  const fetchCourse = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/courses/${slug}`);
      setCourse(response.data);
    } catch (error) {
      console.error('Failed to fetch course:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLessonClick = (lessonSlug) => {
    navigate(`/courses/${slug}/lessons/${lessonSlug}`);
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner':
        return '#10b981';
      case 'intermediate':
        return '#f59e0b';
      case 'advanced':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return <div className="container">Loading course...</div>;
  }

  if (!course) {
    return <div className="container">Course not found</div>;
  }

  return (
    <div className="container">
      <div className="course-header">
        <button onClick={() => navigate('/courses')} className="back-button">
          ← Back to Courses
        </button>
        <div className="course-title-section">
          <span className="course-icon-large">{course.icon || '📚'}</span>
          <div>
            <h1>{course.name}</h1>
            <p className="course-description-large">{course.description}</p>
          </div>
        </div>
      </div>

      <div className="lessons-section">
        <h2>Course Lessons</h2>
        <div className="lessons-list">
          {course.lessons && course.lessons.length > 0 ? (
            course.lessons.map((lesson, index) => (
              <div
                key={lesson.id}
                className={`lesson-item ${lesson.completed ? 'completed' : ''}`}
                onClick={() => handleLessonClick(lesson.slug)}
              >
                <div className="lesson-number">{index + 1}</div>
                <div className="lesson-content">
                  <h3>{lesson.title}</h3>
                  <div className="lesson-meta">
                    <span
                      className="difficulty-badge"
                      style={{ backgroundColor: getDifficultyColor(lesson.difficulty) }}
                    >
                      {lesson.difficulty}
                    </span>
                    <span className="lesson-time">⏱️ {lesson.estimated_time} min</span>
                    {lesson.completed && (
                      <span className="completed-badge">✓ Completed</span>
                    )}
                  </div>
                  {lesson.progress_percentage > 0 && !lesson.completed && (
                    <div className="lesson-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${lesson.progress_percentage}%` }}
                        ></div>
                      </div>
                      <span>{lesson.progress_percentage}%</span>
                    </div>
                  )}
                </div>
                <div className="lesson-arrow">→</div>
              </div>
            ))
          ) : (
            <p>No lessons available yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseDetail;

