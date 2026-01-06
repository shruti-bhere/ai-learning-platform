import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CourseSelector.css';
import apiConfig from '../config/api';

const CourseSelector = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await axios.get(`${apiConfig.API_BASE}/courses`);
      setCourses(response.data);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCourseClick = (slug) => {
    navigate(`/courses/${slug}`);
  };

  if (loading) {
    return <div className="container">Loading courses...</div>;
  }

  return (
    <div className="container">
      <div className="course-selector-header">
        <h1>Choose Your Learning Path</h1>
        <p>Select a course to start your learning journey</p>
      </div>

      <div className="courses-grid">
        {courses.map((course) => (
          <div
            key={course.id}
            className="course-card"
            onClick={() => handleCourseClick(course.slug)}
          >
            <div className="course-icon">{course.icon || '📚'}</div>
            <h2>{course.name}</h2>
            <p className="course-description">{course.description}</p>
            <div className="course-stats">
              <span>📖 {course.total_lessons} Lessons</span>
              {course.completed_lessons > 0 && (
                <span className="completed">
                  ✓ {course.completed_lessons} Completed
                </span>
              )}
            </div>
            <div className="course-progress-bar">
              <div
                className="course-progress-fill"
                style={{
                  width: `${course.total_lessons > 0 ? (course.completed_lessons / course.total_lessons) * 100 : 0}%`
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CourseSelector;

