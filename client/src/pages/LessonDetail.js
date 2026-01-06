import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import MarkdownContent from '../components/MarkdownContent';
import CourseSidebar from '../components/CourseSidebar';
import './LessonDetail.css';
import apiConfig from '../config/api';

const LessonDetail = () => {
  const { courseSlug, lessonSlug } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [contentStructure, setContentStructure] = useState(null);
  const [courseName, setCourseName] = useState('');

  useEffect(() => {
    fetchLesson();
  }, [courseSlug, lessonSlug]);

  // Parse content structure
  useEffect(() => {
    if (lesson && lesson.content) {
      const structure = parseContentStructure(lesson.content);
      setContentStructure(structure);
      // Set intro as default
      if (structure.intro) {
        setSelectedContent(structure.intro);
      } else if (structure.subLessons.length > 0 && structure.subLessons[0]) {
        setSelectedContent(structure.subLessons[0]);
      } else {
        setSelectedContent({ type: 'full', content: lesson.content });
      }
    }
  }, [lesson]);

  const fetchLesson = async () => {
    try {
      const response = await axios.get(
        `${apiConfig.API_BASE}/courses/${courseSlug}/lessons/${lessonSlug}`
      );
      setLesson(response.data);
      setCourseName(response.data.course_name || '');
      setProgress(response.data.progress_percentage || 0);
      setCompleted(response.data.completed || false);
    } catch (error) {
      console.error('Failed to fetch lesson:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (newProgress) => {
    try {
      await axios.post(`${apiConfig.API_BASE}/lessons/${lesson.id}/progress`, {
        progress_percentage: newProgress,
        completed: newProgress === 100
      });
      setProgress(newProgress);
      if (newProgress === 100) {
        setCompleted(true);
      }
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  };

  const handleMarkComplete = () => {
    updateProgress(100);
  };

  const handleNext = () => {
    if (lesson.next_lesson) {
      navigate(`/courses/${courseSlug}/lessons/${lesson.next_lesson.slug}`);
    }
  };

  const handlePrevious = () => {
    if (lesson.previous_lesson) {
      navigate(`/courses/${courseSlug}/lessons/${lesson.previous_lesson.slug}`);
    }
  };

  if (loading) {
    return <div className="container">Loading lesson...</div>;
  }

  if (!lesson) {
    return <div className="container">Lesson not found</div>;
  }

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner':
        return '#0f9d58';
      case 'intermediate':
        return '#f7b733';
      case 'advanced':
        return '#d93025';
      default:
        return '#6b7280';
    }
  };

  const renderBreadcrumbs = () => {
    const parts = [
      { label: 'Home', path: '/' },
      { label: courseName || courseSlug?.replace(/-/g, ' ') || 'Course', path: `/courses/${courseSlug}` },
      { label: lesson?.title || 'Lesson', path: null }
    ];

    return (
      <nav className="breadcrumb">
        {parts.map((part, index) => (
          <span key={part.label} className="breadcrumb-item">
            {part.path ? (
              <button onClick={() => navigate(part.path)}>{part.label}</button>
            ) : (
              <span className="breadcrumb-current">{part.label}</span>
            )}
            {index < parts.length - 1 && <span className="breadcrumb-separator">/</span>}
          </span>
        ))}
      </nav>
    );
  };

  const shouldShowDataTypesTable =
    (courseSlug || '').toLowerCase() === 'java' &&
    (lesson?.title || '').toLowerCase().includes('data type');

  const javaDataTypes = [
    { type: 'byte', size: '8-bit', range: '-128 to 127', defaultValue: '0' },
    { type: 'short', size: '16-bit', range: '-32,768 to 32,767', defaultValue: '0' },
    { type: 'int', size: '32-bit', range: '−2^31 to 2^31−1', defaultValue: '0' },
    { type: 'long', size: '64-bit', range: '−2^63 to 2^63−1', defaultValue: '0L' },
    { type: 'float', size: '32-bit', range: '≈ ±3.4e38 (6-7 digits)', defaultValue: '0.0f' },
    { type: 'double', size: '64-bit', range: '≈ ±1.8e308 (15 digits)', defaultValue: '0.0d' },
    { type: 'char', size: '16-bit', range: '0 to 65,535 (Unicode)', defaultValue: "'\\u0000'" },
    { type: 'boolean', size: '1-bit (virtual)', range: 'true / false', defaultValue: 'false' }
  ];

  // Parse content structure: Intro, Sub-lessons (##), Topics (###)
  const parseContentStructure = (content) => {
    if (!content) return { intro: null, subLessons: [] };

    const lines = content.split('\n');
    const structure = {
      intro: null,
      subLessons: []
    };

    // Find first ## heading (sub-lesson)
    const firstSubLessonIndex = lines.findIndex(line => 
      line.match(/^##\s+(.+)$/) && !line.match(/^###/)
    );

    // Extract intro (everything before first sub-lesson)
    if (firstSubLessonIndex > 0) {
      const introLines = lines.slice(0, firstSubLessonIndex);
      structure.intro = {
        title: 'Introduction',
        type: 'intro',
        content: introLines.join('\n').trim(),
        startIndex: 0,
        endIndex: firstSubLessonIndex
      };
    }

    // Parse sub-lessons (##) and topics (###)
    let currentSubLesson = null;
    let currentTopic = null;

    lines.forEach((line, index) => {
      // Sub-lesson (## heading, not ###)
      const subLessonMatch = line.match(/^##\s+(.+)$/);
      if (subLessonMatch && !line.match(/^###/)) {
        // Save previous sub-lesson if exists
        if (currentSubLesson) {
          if (currentTopic) {
            currentSubLesson.topics.push(currentTopic);
            currentTopic = null;
          }
          structure.subLessons.push(currentSubLesson);
        }
        currentSubLesson = {
          title: subLessonMatch[1].trim(),
          type: 'sublesson',
          topics: [],
          startIndex: index,
          endIndex: lines.length
        };
        currentTopic = null;
        return;
      }

      // Topic (### heading)
      const topicMatch = line.match(/^###\s+(.+)$/);
      if (topicMatch && currentSubLesson) {
        // Save previous topic if exists
        if (currentTopic) {
          currentSubLesson.topics.push(currentTopic);
        }
        currentTopic = {
          title: topicMatch[1].trim(),
          type: 'topic',
          startIndex: index,
          endIndex: lines.length
        };
        return;
      }
    });

    // Save last sub-lesson and topic
    if (currentTopic && currentSubLesson) {
      currentSubLesson.topics.push(currentTopic);
    }
    if (currentSubLesson) {
      structure.subLessons.push(currentSubLesson);
    }

    // Extract content for each section
    const lineArray = content.split('\n');
    
    // Extract intro content
    if (structure.intro) {
      structure.intro.content = lineArray.slice(0, firstSubLessonIndex).join('\n').trim();
    }

    // Extract sub-lesson and topic contents
    structure.subLessons.forEach((subLesson, subIndex) => {
      const nextSubLessonStart = subIndex < structure.subLessons.length - 1
        ? structure.subLessons[subIndex + 1].startIndex
        : lineArray.length;
      
      const subLessonLines = lineArray.slice(subLesson.startIndex, nextSubLessonStart);
      subLesson.content = subLessonLines.join('\n').trim();

      // Extract topic contents
      subLesson.topics.forEach((topic, topicIndex) => {
        const nextTopicStart = topicIndex < subLesson.topics.length - 1
          ? subLesson.topics[topicIndex + 1].startIndex
          : nextSubLessonStart;
        
        const topicLines = lineArray.slice(topic.startIndex, nextTopicStart);
        topic.content = topicLines.join('\n').trim();
      });
    });

    return structure;
  };

  const handleContentSelect = (contentItem) => {
    setSelectedContent(contentItem);
  };

  return (
    <div className="lesson-detail-container">
      <CourseSidebar
        currentLessonSlug={lessonSlug}
        currentSubtopic={selectedContent}
        onSubtopicSelect={handleContentSelect}
      />

      <div className="lesson-main-content">
        <div className="container">
          {renderBreadcrumbs()}
          <div className="lesson-header">
            <button
              onClick={() => navigate(`/courses/${courseSlug}`)}
              className="back-button"
            >
              ← Back to Course
            </button>
            <div className="lesson-title-section">
              <h1>{lesson.title}</h1>
              <div className="lesson-meta-header">
                <span
                  className="difficulty-badge"
                  style={{ backgroundColor: getDifficultyColor(lesson.difficulty) }}
                >
                  {lesson.difficulty}
                </span>
                <span className="lesson-time">⏱️ {lesson.estimated_time} min</span>
                {completed && <span className="completed-badge">✓ Completed</span>}
              </div>
            </div>
          </div>

          <div className="lesson-content-card">
            <div className="lesson-progress-section">
              <div className="progress-info">
                <span>Progress: {progress}%</span>
                {!completed && (
                  <button onClick={handleMarkComplete} className="complete-button">
                    Mark as Complete
                  </button>
                )}
              </div>
              <div className="progress-bar-large">
                <div
                  className="progress-fill-large"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            <div className="lesson-text-content">
              {selectedContent && (
                <>
                  <div className="content-header">
                    <h2 className="content-title">
                      {selectedContent.type === 'intro' && '📚 '}
                      {selectedContent.type === 'sublesson' && '📖 '}
                      {selectedContent.type === 'topic' && '• '}
                      {selectedContent.title}
                    </h2>
                  </div>
                  <div className="content-body">
                    {shouldShowDataTypesTable && (
                      <div className="data-types-table-wrapper">
                        <h3>Java Primitive Data Types</h3>
                        <table className="data-types-table">
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Size</th>
                              <th>Range</th>
                              <th>Default Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {javaDataTypes.map((row) => (
                              <tr key={row.type}>
                                <td>{row.type}</td>
                                <td>{row.size}</td>
                                <td>{row.range}</td>
                                <td>{row.defaultValue}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <MarkdownContent 
                      content={selectedContent.content || lesson.content} 
                      courseSlug={courseSlug}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="lesson-navigation">
              {lesson.previous_lesson && (
                <button onClick={handlePrevious} className="nav-button prev-button">
                  ← Previous: {lesson.previous_lesson.title}
                </button>
              )}
              {lesson.next_lesson ? (
                <button onClick={handleNext} className="nav-button next-button">
                  Next: {lesson.next_lesson.title} →
                </button>
              ) : (
                <button
                  onClick={() => navigate(`/courses/${courseSlug}`)}
                  className="nav-button next-button"
                >
                  Back to Course →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonDetail;

