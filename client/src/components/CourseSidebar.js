import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CourseSidebar.css';

const CourseSidebar = ({ currentLessonSlug, currentSubtopic, onSubtopicSelect }) => {
  const { courseSlug } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [expandedLessons, setExpandedLessons] = useState(new Set());
  const [lessonStructures, setLessonStructures] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourseData();
  }, [courseSlug]);

  useEffect(() => {
    // Expand current lesson by default
    if (currentLessonSlug && lessons.length > 0) {
      const currentLesson = lessons.find(l => l.slug === currentLessonSlug);
      if (currentLesson) {
        setExpandedLessons(prev => new Set([...prev, currentLesson.id]));
        fetchLessonStructure(currentLesson.id, currentLesson.slug);
      }
    }
  }, [currentLessonSlug, lessons]);

  const fetchCourseData = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/courses/${courseSlug}`);
      setCourse(response.data);
      setLessons(response.data.lessons || []);
    } catch (error) {
      console.error('Failed to fetch course:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLessonStructure = async (lessonId, lessonSlug) => {
    if (lessonStructures[lessonId]) return; // Already fetched

    try {
      const response = await axios.get(
        `http://localhost:5000/api/courses/${courseSlug}/lessons/${lessonSlug}`
      );
      const structure = parseLessonStructure(response.data.content || '');
      setLessonStructures(prev => ({
        ...prev,
        [lessonId]: structure
      }));
    } catch (error) {
      console.error('Failed to fetch lesson structure:', error);
    }
  };

  const parseLessonStructure = (content) => {
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

  const toggleLesson = async (lessonId, lessonSlug) => {
    const newExpanded = new Set(expandedLessons);
    if (newExpanded.has(lessonId)) {
      newExpanded.delete(lessonId);
    } else {
      newExpanded.add(lessonId);
      await fetchLessonStructure(lessonId, lessonSlug);
    }
    setExpandedLessons(newExpanded);
  };

  const handleLessonClick = (lessonSlug) => {
    navigate(`/courses/${courseSlug}/lessons/${lessonSlug}`);
  };

  const handleSubtopicClick = (lessonId, subtopic) => {
    if (onSubtopicSelect) {
      onSubtopicSelect(subtopic);
    }
  };

  if (loading) {
    return <div className="course-sidebar loading">Loading...</div>;
  }

  return (
    <div className="course-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-content">
          <div className="course-icon-wrapper">
            <span className="course-icon">{course?.icon || '📚'}</span>
          </div>
          <div className="course-info">
            <h3 className="course-title">{course?.name || 'Course'}</h3>
            <div className="course-meta">
              <span className="lesson-count">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                {lessons.length} {lessons.length === 1 ? 'Lesson' : 'Lessons'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="sidebar-content">
        {lessons.length === 0 ? (
          <div className="sidebar-empty">
            <p>No lessons available</p>
          </div>
        ) : (
          <div className="lessons-list">
            {lessons.map((lesson, index) => {
              const isExpanded = expandedLessons.has(lesson.id);
              const structure = lessonStructures[lesson.id];
              const isCurrentLesson = lesson.slug === currentLessonSlug;
              const hasContent = structure && (structure.intro || structure.subLessons.length > 0);

              return (
                <div
                  key={lesson.id}
                  className={`sidebar-lesson ${isCurrentLesson ? 'current' : ''} ${isExpanded ? 'expanded' : ''}`}
                >
                  <div
                    className="sidebar-lesson-header"
                    onClick={() => {
                      handleLessonClick(lesson.slug);
                      toggleLesson(lesson.id, lesson.slug);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleLessonClick(lesson.slug);
                        toggleLesson(lesson.id, lesson.slug);
                      }
                    }}
                  >
                    <div className="lesson-number-wrapper">
                      <span className="lesson-number">{index + 1}</span>
                      {lesson.completed && (
                        <span className="lesson-completed-badge" title="Completed">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="lesson-info">
                      <span className="lesson-title">{lesson.title}</span>
                      {lesson.estimated_time && (
                        <span className="lesson-time">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          {lesson.estimated_time} min
                        </span>
                      )}
                    </div>
                    {hasContent && (
                      <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`} aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </span>
                    )}
                  </div>

                  {isExpanded && structure && hasContent && (
                    <div className="sidebar-lesson-content">
                      {structure.intro && (
                        <button
                          className={`sidebar-item sidebar-intro ${
                            currentSubtopic?.type === 'intro' && isCurrentLesson ? 'active' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubtopicClick(lesson.id, structure.intro);
                          }}
                          type="button"
                        >
                          <span className="item-icon intro-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 1-3-3H2z"></path>
                              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 0 3 3h7z"></path>
                            </svg>
                          </span>
                          <span className="item-title">{structure.intro.title}</span>
                        </button>
                      )}

                      {structure.subLessons.map((subLesson, subIndex) => (
                        <div key={subIndex} className="sidebar-sublesson">
                          <button
                            className="sidebar-sublesson-header"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSubtopicClick(lesson.id, subLesson);
                            }}
                            type="button"
                          >
                            <span className="sublesson-icon">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                              </svg>
                            </span>
                            <span className="sublesson-title">
                              <span className="sublesson-number">{subIndex + 1}.</span>
                              {subLesson.title}
                            </span>
                          </button>

                          {subLesson.topics && subLesson.topics.length > 0 && (
                            <div className="sidebar-topics">
                              {subLesson.topics.map((topic, topicIndex) => (
                                <button
                                  key={topicIndex}
                                  className={`sidebar-item sidebar-topic ${
                                    currentSubtopic?.title === topic.title && isCurrentLesson
                                      ? 'active'
                                      : ''
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSubtopicClick(lesson.id, topic);
                                  }}
                                  type="button"
                                >
                                  <span className="item-icon topic-icon">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                      <circle cx="12" cy="12" r="10"></circle>
                                    </svg>
                                  </span>
                                  <span className="item-title">{topic.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseSidebar;

