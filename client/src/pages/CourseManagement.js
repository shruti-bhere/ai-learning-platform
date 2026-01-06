import React, { useState, useEffect, useCallback, useRef, useMemo, useImperativeHandle, forwardRef } from 'react';
import axios from 'axios';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import Editor from '@monaco-editor/react';
import './CourseManagement.css';

const API_BASE = 'http://localhost:5000/api';

/**
 * Removes CODE_BLOCK placeholders from lesson content and replaces with actual values
 */
const removeCodeBlockPlaceholders = (content) => {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let updatedContent = content;

  // Extract comparison operator and value from code examples (e.g., if (score >= 60))
  let operator = '>=';
  let compareValue = '60';
  const codeBlockMatch = content.match(/if\s*\(\s*\w+\s*(>=|<=|==|>|<|!=)\s*(\d+)\s*\)/);
  if (codeBlockMatch) {
    operator = codeBlockMatch[1];
    compareValue = codeBlockMatch[2];
  }

  // Pattern: score = 95: Condition __CODE_BLOCK_0__ is CODE_BLOCK_1__ → "message"
  // Replace with: score = 95: Condition 95 >= 60 is true → "message"
  updatedContent = updatedContent.replace(
    /(\w+)\s*=\s*(\d+):\s*Condition\s+__?CODE_BLOCK_0__?\s+is\s+__?CODE_BLOCK_1__?\s*→\s*"([^"]+)"\s*prints([^]*?)(boundary case)?/gi,
    (match, varName, value, message, extra, boundary) => {
      const condition = `${value} ${operator} ${compareValue}`;
      
      // Evaluate the condition
      let result = 'true';
      try {
        const left = parseInt(value);
        const right = parseInt(compareValue);
        switch (operator) {
          case '>=':
            result = left >= right ? 'true' : 'false';
            break;
          case '<=':
            result = left <= right ? 'true' : 'false';
            break;
          case '==':
            result = left === right ? 'true' : 'false';
            break;
          case '>':
            result = left > right ? 'true' : 'false';
            break;
          case '<':
            result = left < right ? 'true' : 'false';
            break;
          case '!=':
            result = left !== right ? 'true' : 'false';
            break;
          default:
            result = 'true';
            break;
        }
      } catch (e) {
        // Keep default
      }
      
      const boundaryText = boundary ? ` (boundary case)` : '';
      return `${varName} = ${value}: Condition ${condition} is ${result} → "${message}" prints${boundaryText}`;
    }
  );

  // Also handle patterns without quotes
  updatedContent = updatedContent.replace(
    /(\w+)\s*=\s*(\d+):\s*Condition\s+__?CODE_BLOCK_0__?\s+is\s+__?CODE_BLOCK_1__?\s*→\s*([^\n]+)/gi,
    (match, varName, value, message) => {
      const condition = `${value} ${operator} ${compareValue}`;
      
      // Evaluate
      let result = 'true';
      try {
        const left = parseInt(value);
        const right = parseInt(compareValue);
        switch (operator) {
          case '>=':
            result = left >= right ? 'true' : 'false';
            break;
          case '<=':
            result = left <= right ? 'true' : 'false';
            break;
          case '==':
            result = left === right ? 'true' : 'false';
            break;
          case '>':
            result = left > right ? 'true' : 'false';
            break;
          case '<':
            result = left < right ? 'true' : 'false';
            break;
          case '!=':
            result = left !== right ? 'true' : 'false';
            break;
          default:
            result = 'true';
            break;
        }
      } catch (e) {
        // Keep default
      }
      
      return `${varName} = ${value}: Condition ${condition} is ${result} → ${message}`;
    }
  );

  // Remove any remaining CODE_BLOCK patterns
  updatedContent = updatedContent.replace(/__?CODE_BLOCK_\d+__?/gi, '');

  // Clean up extra spaces
  updatedContent = updatedContent
    .replace(/\s+/g, ' ')
    .replace(/\s*→\s*/g, ' → ')
    .replace(/\s*:\s*/g, ': ')
    .trim();

  return updatedContent;
};

// Memoized Quill modules and formats to prevent re-creation on every render
const QUILL_MODULES_BASIC = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'color': [] }, { 'background': [] }],
    ['link'],
    ['clean']
  ]
};

const QUILL_MODULES_FULL = {
  toolbar: [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'script': 'sub'}, { 'script': 'super' }],
    [{ 'indent': '-1'}, { 'indent': '+1' }],
    [{ 'align': [] }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    ['clean']
  ]
};

const QUILL_FORMATS_FULL = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'list', 'bullet', 'script',
  'indent', 'align', 'blockquote', 'code-block', 'link', 'image'
];

// hideCreate: when true, the CREATE column is hidden (used in embedded dashboards)
const CourseManagement = forwardRef(({ hideCreate = false, hideHeader = false, onCourseUpdate }, ref) => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedLab, setSelectedLab] = useState(null);
  
  const [expandedCourses, setExpandedCourses] = useState(new Set());
  const [expandedTopics, setExpandedTopics] = useState(new Set());
  const [expandedSubtopics, setExpandedSubtopics] = useState(new Set());
  
  const [activeTab, setActiveTab] = useState('course-selector'); // course-selector, topic-selector, subtopic-selector, content-editor, lab-manager
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNewCourseForm, setShowNewCourseForm] = useState(false);
  const fetchingCourseIdRef = useRef(null); // Track which course is currently being fetched
  const lastFetchedCourseIdRef = useRef(null); // Track last successfully fetched course ID
  const autoExpandedCoursesRef = useRef(new Set()); // Track courses that have been auto-expanded
  const lastCourseSignatureRef = useRef(null); // Track course structure signature to detect changes

  // Expose method to trigger new course form from parent
  useImperativeHandle(ref, () => ({
    triggerNewCourse: () => {
      setSelectedCourse(null);
      setSelectedTopic(null);
      setSelectedSubtopic(null);
      setSelectedLesson(null);
      setSelectedLab(null);
      setActiveTab('course-selector');
      setCourseForm({ name: '', description: '', icon: '' });
      setShowNewCourseForm(true);
      // Scroll to editor panel if needed
      setTimeout(() => {
        const editorPanel = document.querySelector('.cms-editor-panel');
        if (editorPanel) {
          editorPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }));

  // Form states
  const [courseForm, setCourseForm] = useState({ name: '', description: '', icon: '' });
  const [topicForm, setTopicForm] = useState({ name: '', description: '', order_index: 0 });
  const [subtopicForm, setSubtopicForm] = useState({ name: '', description: '', order_index: 0 });
  const [lessonForm, setLessonForm] = useState({ 
    code_example: '',
    code_language: 'java', 
    title: '', 
    content: '', 
    difficulty: 'beginner', 
    estimated_time: 20,
    order_index: 0
  });
  const [labForm, setLabForm] = useState({
    title: '',
    description: '',
    instructions: '',
    starter_code: '',
    solution_code: '',
    test_cases: '',
    difficulty: 'beginner',
    estimated_time: 30,
    order_index: 0
  });

  const fetchCourseDetails = useCallback(async (course) => {
    if (!course) return;
    
    const courseId = course.id;
    
    // Prevent concurrent fetches for the same course
    if (fetchingCourseIdRef.current === courseId) {
      return;
    }
    
    fetchingCourseIdRef.current = courseId;
    
    try {

      const topicsResponse = await axios.get(
        `${API_BASE}/admin/courses/${courseId}/topics`
      );
      
      const topics = await Promise.all(
        (topicsResponse.data || []).map(async (topic) => {
          let subtopics = [];
          try {
            const subtopicsResponse = await axios.get(
              `${API_BASE}/admin/topics/${topic.id}/subtopics`
            );
            // Handle both direct array response and wrapped response
            const subtopicsData = Array.isArray(subtopicsResponse.data) 
              ? subtopicsResponse.data 
              : (subtopicsResponse.data?.subtopics || subtopicsResponse.data?.data || []);
            
            subtopics = await Promise.all(
              subtopicsData.map(async (subtopic) => {
                try {
                  // Ensure subtopic has topic_id set correctly
                  const subtopicWithTopicId = { ...subtopic, topic_id: subtopic.topic_id || topic.id };
                  
                  const lessonsResponse = await axios.get(
                    `${API_BASE}/admin/subtopics/${subtopic.id}/lessons`
                  );
                  const lessonsData = Array.isArray(lessonsResponse.data)
                    ? lessonsResponse.data
                    : (lessonsResponse.data?.lessons || lessonsResponse.data?.data || []);
                  return { ...subtopicWithTopicId, lessons: lessonsData };
                } catch (e) {
                  console.error(`Error fetching lessons for subtopic ${subtopic.id}:`, e);
                  return { ...subtopic, topic_id: subtopic.topic_id || topic.id, lessons: [] };
                }
              })
            );
            
            // Subtopics loaded (logging removed for performance)
          } catch (e) {
            console.error(`Error fetching subtopics for topic ${topic.id}:`, e);
            subtopics = [];
          }
          
          let topicLessons = [];
          try {
            const lessonsResponse = await axios.get(
              `${API_BASE}/admin/topics/${topic.id}/lessons`
            );
            topicLessons = Array.isArray(lessonsResponse.data)
              ? lessonsResponse.data
              : (lessonsResponse.data?.lessons || lessonsResponse.data?.data || []);
          } catch (e) {
            console.error(`Error fetching lessons for topic ${topic.id}:`, e);
            topicLessons = [];
          }
          
          return { 
            ...topic, 
            subtopics,
            lessons: topicLessons 
          };
        })
      );
      
      // Fetch ALL lessons for this course (using courseId instead of slug for more reliable results)
      let courseLevelLessons = [];
      try {
        // Try fetching by course ID first
        const lessonsResponse = await axios.get(
          `${API_BASE}/admin/lessons?courseId=${courseId}`
        );
        const lessonsPayload = lessonsResponse.data?.lessons || lessonsResponse.data || [];
        courseLevelLessons = Array.isArray(lessonsPayload) ? lessonsPayload : [];
      } catch (e) {
        // Fallback to slug-based fetch
        try {
          const lessonsResponse = await axios.get(
            `${API_BASE}/admin/lessons?courseSlug=${course.slug}`
          );
          const lessonsPayload = lessonsResponse.data?.lessons || lessonsResponse.data || [];
          courseLevelLessons = Array.isArray(lessonsPayload) ? lessonsPayload : [];
        } catch (e2) {
          console.error(`Error fetching lessons for course ${courseId}:`, e2);
          courseLevelLessons = [];
        }
      }

      // Collect all assigned lesson IDs from topics and subtopics
      const assignedLessonIds = new Set();
      const topicIds = new Set(topics.map(t => t.id));
      const subtopicIds = new Set();
      
      topics.forEach(topic => {
        if (topic.lessons) {
          topic.lessons.forEach(lesson => assignedLessonIds.add(lesson.id));
        }
        if (topic.subtopics) {
          topic.subtopics.forEach(subtopic => {
            subtopicIds.add(subtopic.id);
            if (subtopic.lessons) {
              subtopic.lessons.forEach(lesson => assignedLessonIds.add(lesson.id));
            }
          });
        }
      });

      // Find unassigned lessons: those that either:
      // 1. Have no topic_id/subtopic_id, OR
      // 2. Have topic_id/subtopic_id that don't exist in our fetched topics/subtopics (orphaned)
      const unassignedLessons = courseLevelLessons.filter(
        (l) => {
          if (l.course_id !== courseId) return false;
          if (assignedLessonIds.has(l.id)) return false; // Already assigned and found
          
          // If lesson has topic_id but topic doesn't exist, it's orphaned - show as unassigned
          if (l.topic_id && !topicIds.has(l.topic_id)) return true;
          
          // If lesson has subtopic_id but subtopic doesn't exist, it's orphaned - show as unassigned
          if (l.subtopic_id && !subtopicIds.has(l.subtopic_id)) return true;
          
          // If lesson has no topic_id or subtopic_id, it's unassigned
          return !l.topic_id && !l.subtopic_id;
        }
      );

      const updatedCourse = { ...course, topics, unassignedLessons };
      
      // Debug logging to help identify issues
      console.log(`📚 Course "${course.name}" (ID: ${courseId}) loaded:`, {
        topicsCount: topics.length,
        totalLessonsInTopics: topics.reduce((sum, t) => sum + (t.lessons?.length || 0), 0),
        totalLessonsInSubtopics: topics.reduce((sum, t) => 
          sum + (t.subtopics?.reduce((subSum, st) => subSum + (st.lessons?.length || 0), 0) || 0), 0),
        unassignedLessonsCount: unassignedLessons.length,
        topics: topics.map(t => ({
          name: t.name,
          id: t.id,
          lessonsCount: t.lessons?.length || 0,
          subtopicsCount: t.subtopics?.length || 0,
          subtopics: t.subtopics?.map(st => ({
            name: st.name,
            id: st.id,
            lessonsCount: st.lessons?.length || 0
          })) || []
        }))
      });
      
      setCourses(prev => prev.map(c => 
        c.id === courseId ? updatedCourse : c
      ));
      
      // Also update selectedCourse if it's the same course to ensure UI reflects latest data
      setSelectedCourse(prevSelected => {
        if (prevSelected && prevSelected.id === courseId) {
          return updatedCourse;
        }
        return prevSelected;
      });
      
      // Course details loaded
    } catch (error) {
      console.error('Failed to fetch course details:', error);
    } finally {
      // Clear the fetching flag
      if (fetchingCourseIdRef.current === courseId) {
        fetchingCourseIdRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, []);

  // Track the last active tab to detect tab switches
  const lastActiveTabRef = useRef(null);
  const lastFetchTimeRef = useRef(null); // Track when we last fetched to prevent rapid re-fetches
  
  // Fetch course details when course is selected or when switching to content-editor tab
  useEffect(() => {
    if (!selectedCourse) return;
    
    const courseId = selectedCourse.id;
    const isTabSwitch = lastActiveTabRef.current !== activeTab;
    lastActiveTabRef.current = activeTab;
    
    // Prevent fetching if we just fetched recently (within 1000ms)
    const now = Date.now();
    const recentlyFetched = lastFetchTimeRef.current && 
                           (now - lastFetchTimeRef.current) < 1000 &&
                           lastFetchedCourseIdRef.current === courseId;
    
    // Only fetch if:
    // 1. This is a different course than last fetched, OR
    // 2. We're switching TO content-editor tab (not already on it) AND we haven't fetched recently
    const shouldFetch = 
      !recentlyFetched && (
        lastFetchedCourseIdRef.current !== courseId || 
        (isTabSwitch && activeTab === 'content-editor')
      );
    
    if (shouldFetch) {
      // Use a debounce delay to prevent rapid re-fetches
      const timeoutId = setTimeout(() => {
        // Double-check we're not already fetching this course
        if (fetchingCourseIdRef.current !== courseId && selectedCourse) {
          fetchCourseDetails(selectedCourse);
          lastFetchedCourseIdRef.current = courseId;
          lastFetchTimeRef.current = Date.now();
        }
      }, 200);
      
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse?.id, activeTab]); // Removed fetchCourseDetails from deps - it's stable

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/courses`);
      const coursesWithStructure = await Promise.all(
        response.data.map(async (course) => {
          try {
            const topicsResponse = await axios.get(
              `${API_BASE}/admin/courses/${course.id}/topics`
            );
            
            const topics = await Promise.all(
              (topicsResponse.data || []).map(async (topic) => {
                try {
                  let subtopics = [];
                  try {
                    const subtopicsResponse = await axios.get(
                      `${API_BASE}/admin/topics/${topic.id}/subtopics`
                    );
                    const subtopicsData = Array.isArray(subtopicsResponse.data) 
                      ? subtopicsResponse.data 
                      : (subtopicsResponse.data?.subtopics || subtopicsResponse.data?.data || []);
                    
                    subtopics = await Promise.all(
                      subtopicsData.map(async (subtopic) => {
                        try {
                          // Ensure subtopic has topic_id set correctly
                          const subtopicWithTopicId = { ...subtopic, topic_id: subtopic.topic_id || topic.id };
                          
                  const lessonsResponse = await axios.get(
                            `${API_BASE}/admin/subtopics/${subtopic.id}/lessons`
                  );
                          const lessonsData = Array.isArray(lessonsResponse.data)
                            ? lessonsResponse.data
                            : (lessonsResponse.data?.lessons || lessonsResponse.data?.data || []);
                          return { ...subtopicWithTopicId, lessons: lessonsData };
                } catch (e) {
                          return { ...subtopic, topic_id: subtopic.topic_id || topic.id, lessons: [] };
                }
              })
            );
            
                    // Subtopics loaded (logging removed to reduce console noise)
                  } catch (e) {
                    subtopics = [];
                  }
                  
                  let topicLessons = [];
                  try {
                    const lessonsResponse = await axios.get(
                      `${API_BASE}/admin/topics/${topic.id}/lessons`
                    );
                    topicLessons = Array.isArray(lessonsResponse.data)
                      ? lessonsResponse.data
                      : (lessonsResponse.data?.lessons || lessonsResponse.data?.data || []);
          } catch (e) {
                    topicLessons = [];
                  }
                  
                  return { 
                    ...topic, 
                    subtopics,
                    lessons: topicLessons 
                  };
                } catch (e) {
                  return { ...topic, subtopics: [], lessons: [] };
            }
              })
            );
            
            // Fetch ALL lessons for this course
            let courseLevelLessons = [];
            try {
              // Try fetching by course ID first
              const lessonsResponse = await axios.get(
                `${API_BASE}/admin/lessons?courseId=${course.id}`
              );
              const lessonsPayload = lessonsResponse.data?.lessons || lessonsResponse.data || [];
              courseLevelLessons = Array.isArray(lessonsPayload) ? lessonsPayload : [];
            } catch (e) {
              // Fallback to slug-based fetch
              try {
                const lessonsResponse = await axios.get(
                  `${API_BASE}/admin/lessons?courseSlug=${course.slug}`
                );
                const lessonsPayload = lessonsResponse.data?.lessons || lessonsResponse.data || [];
                courseLevelLessons = Array.isArray(lessonsPayload) ? lessonsPayload : [];
              } catch (e2) {
                console.error(`Error fetching lessons for course ${course.id}:`, e2);
                courseLevelLessons = [];
              }
            }

            // Collect all assigned lesson IDs from topics and subtopics
            const assignedLessonIds = new Set();
            const topicIds = new Set(topics.map(t => t.id));
            const subtopicIds = new Set();
            
            topics.forEach(topic => {
              if (topic.lessons) {
                topic.lessons.forEach(lesson => assignedLessonIds.add(lesson.id));
              }
              if (topic.subtopics) {
                topic.subtopics.forEach(subtopic => {
                  subtopicIds.add(subtopic.id);
                  if (subtopic.lessons) {
                    subtopic.lessons.forEach(lesson => assignedLessonIds.add(lesson.id));
                  }
                });
              }
            });

            // Find unassigned lessons: those that either:
            // 1. Have no topic_id/subtopic_id, OR
            // 2. Have topic_id/subtopic_id that don't exist in our fetched topics/subtopics (orphaned)
            const unassignedLessons = courseLevelLessons.filter(
              (l) => {
                if (l.course_id !== course.id) return false;
                if (assignedLessonIds.has(l.id)) return false; // Already assigned and found
                
                // If lesson has topic_id but topic doesn't exist, it's orphaned - show as unassigned
                if (l.topic_id && !topicIds.has(l.topic_id)) return true;
                
                // If lesson has subtopic_id but subtopic doesn't exist, it's orphaned - show as unassigned
                if (l.subtopic_id && !subtopicIds.has(l.subtopic_id)) return true;
                
                // If lesson has no topic_id or subtopic_id, it's unassigned
                return !l.topic_id && !l.subtopic_id;
              }
            );

            return { ...course, topics, unassignedLessons };
          } catch (e) {
            return { ...course, topics: [], unassignedLessons: [] };
          }
        })
      );
      setCourses(coursesWithStructure);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
      setError('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };


  // Selection handlers
  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    setSelectedTopic(null);
    setSelectedSubtopic(null);
    setSelectedLesson(null);
    setSelectedLab(null);
    setCourseForm({
      name: course.name,
      description: course.description || '',
      icon: course.icon || ''
    });
    setActiveTab('course-selector');
    
    // Auto-expand the selected course to show all content
    const newExpandedCourses = new Set(expandedCourses);
    newExpandedCourses.add(course.id);
    setExpandedCourses(newExpandedCourses);
    
    // Auto-expand all topics in the selected course to show all content
    if (course.topics && course.topics.length > 0) {
      const newExpandedTopics = new Set(expandedTopics);
      const newExpandedSubtopics = new Set(expandedSubtopics);
      course.topics.forEach(topic => {
        newExpandedTopics.add(topic.id);
        // Also expand subtopics to show all lessons
        if (topic.subtopics && topic.subtopics.length > 0) {
          topic.subtopics.forEach(subtopic => {
            newExpandedSubtopics.add(subtopic.id);
          });
        }
      });
      setExpandedTopics(newExpandedTopics);
      setExpandedSubtopics(newExpandedSubtopics);
      // Mark this course as auto-expanded
      autoExpandedCoursesRef.current.add(course.id);
    }
    
    // Fetch fresh course details to ensure all data is loaded
    fetchCourseDetails(course);
  };

  // Auto-expand topics and subtopics when course data is loaded/updated
  useEffect(() => {
    if (selectedCourse && selectedCourse.id && selectedCourse.topics && selectedCourse.topics.length > 0) {
      // Calculate a signature for the course's structure to detect changes
      const courseSignature = `${selectedCourse.id}-${selectedCourse.topics.length}-${selectedCourse.topics.map(t => `${t.id}:${t.subtopics?.length || 0}`).join(',')}`;
      
      // Check if we need to expand (either not expanded yet, or structure changed)
      const needsExpansion = !autoExpandedCoursesRef.current.has(selectedCourse.id) || 
                            lastCourseSignatureRef.current !== courseSignature;
      
      if (needsExpansion) {
        const newExpandedTopics = new Set(expandedTopics);
        const newExpandedSubtopics = new Set(expandedSubtopics);
        let hasChanges = false;
        
        selectedCourse.topics.forEach(topic => {
          if (!newExpandedTopics.has(topic.id)) {
            newExpandedTopics.add(topic.id);
            hasChanges = true;
          }
          // Also expand subtopics to show all lessons
          if (topic.subtopics && topic.subtopics.length > 0) {
            topic.subtopics.forEach(subtopic => {
              if (!newExpandedSubtopics.has(subtopic.id)) {
                newExpandedSubtopics.add(subtopic.id);
                hasChanges = true;
              }
            });
          }
        });
        
        if (hasChanges) {
          setExpandedTopics(newExpandedTopics);
          setExpandedSubtopics(newExpandedSubtopics);
          autoExpandedCoursesRef.current.add(selectedCourse.id);
          lastCourseSignatureRef.current = courseSignature;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse?.id, selectedCourse?.topics?.length]); // Run when course ID or topics count changes

  // Auto-expand topics and subtopics for any expanded course (not just selected)
  useEffect(() => {
    expandedCourses.forEach(courseId => {
      const course = courses.find(c => c.id === courseId);
      if (course && course.topics && course.topics.length > 0) {
        const newExpandedTopics = new Set(expandedTopics);
        const newExpandedSubtopics = new Set(expandedSubtopics);
        let hasChanges = false;
        
        course.topics.forEach(topic => {
          // Always expand topics to show lessons
          if (!newExpandedTopics.has(topic.id)) {
            newExpandedTopics.add(topic.id);
            hasChanges = true;
          }
          // Also expand subtopics to show all lessons
          if (topic.subtopics && topic.subtopics.length > 0) {
            topic.subtopics.forEach(subtopic => {
              if (!newExpandedSubtopics.has(subtopic.id)) {
                newExpandedSubtopics.add(subtopic.id);
                hasChanges = true;
              }
            });
          }
        });
        
        if (hasChanges) {
          setExpandedTopics(newExpandedTopics);
          setExpandedSubtopics(newExpandedSubtopics);
          autoExpandedCoursesRef.current.add(courseId);
          console.log(`✅ Auto-expanded course "${course.name}": ${newExpandedTopics.size} topics, ${newExpandedSubtopics.size} subtopics`);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedCourses, courses]); // Run when courses are expanded or courses data changes

  const handleSelectTopic = (topic) => {
    setSelectedTopic(topic);
    setSelectedSubtopic(null);
    setSelectedLesson(null);
    setSelectedLab(null);
    setTopicForm({
      name: topic.name,
      description: topic.description || '',
      order_index: topic.order_index || 0
    });
    setActiveTab('topic-selector');
  };

  const handleSelectSubtopic = (subtopic) => {
    setSelectedSubtopic(subtopic);
    setSelectedLesson(null);
    setSelectedLab(null);
    setSubtopicForm({
      name: subtopic.name,
      description: subtopic.description || '',
      order_index: subtopic.order_index || 0
    });
    // Reset lesson form for creating new lesson under this subtopic
    setLessonForm({
      title: '',
      content: '',
      difficulty: 'beginner',
      estimated_time: 20,
      order_index: 0,
      code_example: '',
      code_language: 'java'
    });
    // Open Content Editor when clicking a subtopic (similar to clicking a lesson)
    setActiveTab('content-editor');
    
    // Find and set the parent topic if not already set
    if (!selectedTopic || selectedTopic.id !== subtopic.topic_id) {
      const currentCourse = courses.find(c => c.id === selectedCourse?.id) || selectedCourse;
      if (currentCourse?.topics) {
        const parentTopic = currentCourse.topics.find(t => 
          t.id === subtopic.topic_id || 
          (t.subtopics && t.subtopics.some(st => st.id === subtopic.id))
        );
        if (parentTopic) {
          setSelectedTopic(parentTopic);
        }
      }
    }
  };

  const handleSelectLesson = (lesson) => {
    setSelectedLesson(lesson);
    setSelectedLab(null);
    setLessonForm({
      title: lesson.title,
      content: lesson.content || '',
      difficulty: lesson.difficulty || 'beginner',
      estimated_time: lesson.estimated_time || 20,
      order_index: lesson.order_index || 0,
      code_example: lesson.code_example || '',
      code_language: lesson.code_language || 'java'
    });
    // Only switch to content-editor if we're not already there (prevents unnecessary re-fetches)
    if (activeTab !== 'content-editor') {
      setActiveTab('content-editor');
    }
  };

  const handleSelectLab = (lab) => {
    setSelectedLab(lab);
    setLabForm({
      title: lab.title,
      description: lab.description || '',
      instructions: lab.instructions || '',
      starter_code: lab.starter_code || '',
      solution_code: lab.solution_code || '',
      test_cases: typeof lab.test_cases === 'string' ? lab.test_cases : JSON.stringify(lab.test_cases || {}, null, 2),
      difficulty: lab.difficulty || 'beginner',
      estimated_time: lab.estimated_time || 30,
      order_index: lab.order_index || 0
    });
    setActiveTab('lab-manager');
  };

  // Course CRUD
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const response = await axios.post(`${API_BASE}/admin/courses`, courseForm);
      setSuccess('Course created successfully');
      setCourseForm({ name: '', description: '', icon: '' });
      setShowNewCourseForm(false);
      await fetchCourses();
      // Notify parent component to refresh courses list
      if (onCourseUpdate) {
        onCourseUpdate();
      }
      // Select the newly created course after fetching updated courses list
      const createdCourseId = response.data?.course?.id || response.data?.id;
      if (createdCourseId) {
        // Wait a bit for state to update, then find and select the new course
        setTimeout(async () => {
          const updatedCourses = await axios.get(`${API_BASE}/admin/courses`);
          const newCourse = updatedCourses.data?.courses?.find(c => c.id === createdCourseId) || 
                          updatedCourses.data?.find(c => c.id === createdCourseId) ||
                          response.data?.course || response.data;
          if (newCourse) {
            setSelectedCourse(newCourse);
            await fetchCourseDetails(newCourse);
          }
        }, 100);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create course');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCourse = async (e) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.put(`${API_BASE}/admin/courses/${selectedCourse.id}`, courseForm);
      setSuccess('Course updated successfully');
      await fetchCourses();
      // Notify parent component to refresh courses list
      if (onCourseUpdate) {
        onCourseUpdate();
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update course');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to delete this course and all its content?')) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.delete(`${API_BASE}/admin/courses/${courseId}`);
      setSuccess('Course deleted successfully');
      if (selectedCourse?.id === courseId) {
        setSelectedCourse(null);
        setSelectedTopic(null);
        setSelectedSubtopic(null);
        setSelectedLesson(null);
      }
      await fetchCourses();
      // Notify parent component to refresh courses list
      if (onCourseUpdate) {
        onCourseUpdate();
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete course');
    } finally {
      setSaving(false);
    }
  };

  // Topic CRUD
  const handleCreateTopic = async (e) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.post(
        `${API_BASE}/admin/courses/${selectedCourse.id}/topics`,
        topicForm
      );
      setSuccess('Topic created successfully');
      setTopicForm({ name: '', description: '', order_index: 0 });
      // Refresh course details to update hierarchy
      if (selectedCourse) {
        await fetchCourseDetails(selectedCourse);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create topic');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTopic = async (e) => {
    e.preventDefault();
    if (!selectedTopic) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.put(`${API_BASE}/admin/topics/${selectedTopic.id}`, topicForm);
      setSuccess('Topic updated successfully');
      // Refresh course details to update hierarchy
      if (selectedCourse) {
        await fetchCourseDetails(selectedCourse);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update topic');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTopic = async (topicId) => {
    if (!window.confirm('Are you sure you want to delete this topic and all its content?')) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.delete(`${API_BASE}/admin/topics/${topicId}`);
      setSuccess('Topic deleted successfully');
      if (selectedTopic?.id === topicId) {
        setSelectedTopic(null);
        setSelectedSubtopic(null);
        setSelectedLesson(null);
      }
      // Refresh course details to update hierarchy
      if (selectedCourse) {
        await fetchCourseDetails(selectedCourse);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete topic');
    } finally {
      setSaving(false);
    }
  };

  // Subtopic CRUD
  const handleCreateSubtopic = async (e) => {
    e.preventDefault();
    if (!selectedTopic) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.post(
        `${API_BASE}/admin/topics/${selectedTopic.id}/subtopics`,
        subtopicForm
      );
      setSuccess('Subtopic created successfully');
      setSubtopicForm({ name: '', description: '', order_index: 0 });
      // Refresh course details to show the new subtopic in hierarchy
      if (selectedCourse) {
        await fetchCourseDetails(selectedCourse);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create subtopic');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSubtopic = async (e) => {
    e.preventDefault();
    if (!selectedSubtopic) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.put(`${API_BASE}/admin/subtopics/${selectedSubtopic.id}`, subtopicForm);
      setSuccess('Subtopic updated successfully');
      // Refresh course details to update hierarchy
      if (selectedCourse) {
        await fetchCourseDetails(selectedCourse);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update subtopic');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubtopic = async (subtopicId) => {
    if (!window.confirm('Are you sure you want to delete this subtopic and all its content?')) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.delete(`${API_BASE}/admin/subtopics/${subtopicId}`);
      setSuccess('Subtopic deleted successfully');
      if (selectedSubtopic?.id === subtopicId) {
        setSelectedSubtopic(null);
        setSelectedLesson(null);
      }
      // Refresh course details to update hierarchy
      if (selectedCourse) {
        await fetchCourseDetails(selectedCourse);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete subtopic');
    } finally {
      setSaving(false);
    }
  };

  // Lesson CRUD
  const handleCreateLesson = async (e) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      // Clean CODE_BLOCK placeholders before saving
      const cleanedForm = {
        ...lessonForm,
        content: removeCodeBlockPlaceholders(lessonForm.content || '')
      };
      
      let endpoint;
      if (selectedSubtopic && selectedSubtopic.id) {
        endpoint = `${API_BASE}/admin/subtopics/${selectedSubtopic.id}/lessons`;
      } else if (selectedTopic && selectedTopic.id) {
        endpoint = `${API_BASE}/admin/topics/${selectedTopic.id}/lessons`;
      } else {
        endpoint = `${API_BASE}/admin/courses/${selectedCourse.id}/lessons`;
      }
      
      await axios.post(endpoint, cleanedForm);
      setSuccess('Lesson created successfully');
      setLessonForm({
        title: '',
        content: '',
        difficulty: 'beginner',
        code_example: '',
        code_language: 'java',
        estimated_time: 20,
        order_index: 0
      });
      setSelectedLesson(null);
      // Refresh course details to update hierarchy
      if (selectedCourse) {
        await fetchCourseDetails(selectedCourse);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create lesson');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLesson = async (e) => {
    e.preventDefault();
    if (!selectedLesson) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      // Clean CODE_BLOCK placeholders before saving
      const cleanedForm = {
        ...lessonForm,
        content: removeCodeBlockPlaceholders(lessonForm.content || '')
      };
      
      await axios.put(`${API_BASE}/admin/lessons/${selectedLesson.id}`, cleanedForm);
      setSuccess('Lesson updated successfully');
      // Refresh course details to update hierarchy
      if (selectedCourse) {
        await fetchCourseDetails(selectedCourse);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update lesson');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async (lessonId) => {
    if (!window.confirm('Are you sure you want to delete this lesson?')) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.delete(`${API_BASE}/admin/lessons/${lessonId}`);
      setSuccess('Lesson deleted successfully');
      if (selectedLesson?.id === lessonId) {
        setSelectedLesson(null);
      }
      // Refresh course details to update hierarchy
      if (selectedCourse) {
        await fetchCourseDetails(selectedCourse);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete lesson');
    } finally {
      setSaving(false);
    }
  };

  // Lab CRUD
  const handleCreateLab = async (e) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      let testCases = null;
      try {
        testCases = labForm.test_cases ? JSON.parse(labForm.test_cases) : null;
      } catch (e) {
        // Invalid JSON, will be stored as null
      }

      await axios.post(`${API_BASE}/admin/labs`, {
        ...labForm,
        courseId: selectedCourse.id,
        topicId: selectedTopic?.id || null,
        subtopicId: selectedSubtopic?.id || null,
        lessonId: selectedLesson?.id || null,
        test_cases: testCases
      });
      setSuccess('Lab created successfully');
      setLabForm({
        title: '',
        description: '',
        instructions: '',
        starter_code: '',
        solution_code: '',
        test_cases: '',
        difficulty: 'beginner',
        estimated_time: 30,
        order_index: 0
      });
      setSelectedLab(null);
      // Refresh course details to update hierarchy
      if (selectedCourse) {
        await fetchCourseDetails(selectedCourse);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create lab');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLab = async (e) => {
    e.preventDefault();
    if (!selectedLab) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      let testCases = null;
      try {
        testCases = labForm.test_cases ? JSON.parse(labForm.test_cases) : null;
      } catch (e) {
        // Invalid JSON, will be stored as null
      }

      await axios.put(`${API_BASE}/admin/labs/${selectedLab.id}`, {
        ...labForm,
        test_cases: testCases
      });
      setSuccess('Lab updated successfully');
      // Refresh course details to update hierarchy
      if (selectedCourse) {
        await fetchCourseDetails(selectedCourse);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update lab');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLab = async (labId) => {
    if (!window.confirm('Are you sure you want to delete this lab?')) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.delete(`${API_BASE}/admin/labs/${labId}`);
      setSuccess('Lab deleted successfully');
      if (selectedLab?.id === labId) {
        setSelectedLab(null);
      }
      // Refresh course details to update hierarchy
      if (selectedCourse) {
        await fetchCourseDetails(selectedCourse);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete lab');
    } finally {
      setSaving(false);
    }
  };

  // Toggle handlers
  const toggleCourse = (courseId) => {
    const newExpanded = new Set(expandedCourses);
    const isExpanding = !newExpanded.has(courseId);
    
    if (isExpanding) {
      newExpanded.add(courseId);
      // Find the course and fetch its details when expanding
      const course = courses.find(c => c.id === courseId);
      if (course) {
        // Fetch course details to load topics, subtopics, and lessons
        fetchCourseDetails(course);
      }
    } else {
      newExpanded.delete(courseId);
    }
    setExpandedCourses(newExpanded);
  };

  const toggleTopic = (topicId) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  const toggleSubtopic = (subtopicId) => {
    const newExpanded = new Set(expandedSubtopics);
    if (newExpanded.has(subtopicId)) {
      newExpanded.delete(subtopicId);
    } else {
      newExpanded.add(subtopicId);
    }
    setExpandedSubtopics(newExpanded);
  };

  // New item handlers
  const handleNewTopic = (course) => {
    setSelectedCourse(course);
    setSelectedTopic({ id: null });
    setSelectedSubtopic(null);
    setSelectedLesson(null);
    setTopicForm({ name: '', description: '', order_index: 0 });
    setActiveTab('topic-selector');
  };

  const handleNewSubtopic = (topic) => {
    setSelectedTopic(topic);
    setSelectedSubtopic({ id: null });
    setSelectedLesson(null);
    setSubtopicForm({ name: '', description: '', order_index: 0 });
    setActiveTab('subtopic-selector');
  };

  const handleNewLesson = (course, topic, subtopic) => {
    setSelectedCourse(course);
    setSelectedTopic(topic);
    setSelectedSubtopic(subtopic);
    setSelectedLesson({ id: null });
    setLessonForm({
      title: '',
      content: '',
      difficulty: 'beginner',
      estimated_time: 20,
      order_index: 0,
      code_example: '',
      code_language: 'java'
    });
    setActiveTab('content-editor');
  };

  const handleNewLab = (course, topic, subtopic, lesson) => {
    setSelectedCourse(course);
    setSelectedTopic(topic);
    setSelectedSubtopic(subtopic);
    setSelectedLesson(lesson);
    setSelectedLab({ id: null });
    setLabForm({
      title: '',
      description: '',
      instructions: '',
      starter_code: '',
      solution_code: '',
      test_cases: '',
      difficulty: 'beginner',
      estimated_time: 30,
      order_index: 0
    });
    setActiveTab('lab-manager');
  };

  if (loading) {
    return (
      <div className="cms-container">
        <div className="loading-skeleton">
          <div className="skeleton-sidebar"></div>
          <div className="skeleton-content">
            <div className="skeleton-header"></div>
            <div className="skeleton-body"></div>
          </div>
        </div>
      </div>
    );
  }

  // Get the most up-to-date course data from the courses array
  const currentCourse = courses.find(c => c.id === selectedCourse?.id) || selectedCourse;

  // Statistics can be calculated here if needed for display

  return (
    <div className="cms-container">
      {/* Toast notifications - always shown inline */}
      <div className="header-actions-inline">
        {success && <div className="toast success">{success}</div>}
        {error && <div className="toast error">{error}</div>}
      </div>

      {/* Main Section: Sidebar + Editor Panel */}
      <div className="cms-main-layout-redesigned">
        {/* Left Sidebar - Always Visible Tree View */}
        <div className="cms-sidebar-redesigned">
          <div className="sidebar-header">
            <h3>Content Hierarchy</h3>
          </div>

          <div className="tree-view">
            {courses.map((course) => (
              <div key={course.id} className="tree-item">
                <div 
                  className={`tree-node ${selectedCourse?.id === course.id ? 'selected' : ''}`}
                  onClick={() => handleSelectCourse(course)}
                >
                  <button
                    className="tree-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCourse(course.id);
                    }}
                  >
                    {expandedCourses.has(course.id) ? '−' : '+'}
                  </button>
                  <span className="tree-icon">📚</span>
                  <span className="tree-label">{course.name}</span>
                  <span className="tree-badge">
                    {(() => {
                      // Get actual counts from fetched data
                      const topicsCount = course.topics?.length ?? 0;
                      const subtopicsCount = course.topics?.reduce((sum, topic) => 
                        sum + (topic.subtopics?.length || 0), 0) || 0;
                      const courseLessons = course.topics?.reduce((sum, topic) => {
                        const topicLessons = topic.lessons?.length || 0;
                        const subtopicLessons = topic.subtopics?.reduce((subSum, subtopic) => 
                          subSum + (subtopic.lessons?.length || 0), 0) || 0;
                        return sum + topicLessons + subtopicLessons;
                      }, 0) || 0;
                      const unassignedLessonsCount = course.unassignedLessons?.length || 0;
                      const totalLessons = courseLessons + unassignedLessonsCount;
                      
                      // Build display string
                      const parts = [];
                      if (topicsCount > 0) parts.push(`${topicsCount} topic${topicsCount !== 1 ? 's' : ''}`);
                      if (subtopicsCount > 0) parts.push(`${subtopicsCount} subtopic${subtopicsCount !== 1 ? 's' : ''}`);
                      if (totalLessons > 0) parts.push(`${totalLessons} lesson${totalLessons !== 1 ? 's' : ''}`);
                      
                      return parts.length > 0 ? parts.join(', ') : '0 topics, 0 lessons';
                    })()}
                  </span>
                  <button
                    className="btn-add-small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNewTopic(course);
                    }}
                    title="Add Topic"
                  >
                    +
                  </button>
                </div>

                {expandedCourses.has(course.id) && (
                  <div className="tree-children">
                    {/* Lessons without topics/subtopics */}
                    {course.unassignedLessons && course.unassignedLessons.length > 0 && (
                      <div className="tree-children">
                        {course.unassignedLessons.map((lesson) => (
                          <div
                            key={`course-lesson-${lesson.id}`}
                            className={`tree-node lesson-node ${selectedLesson?.id === lesson.id ? 'selected' : ''}`}
                            onClick={() => handleSelectLesson(lesson)}
                          >
                            <span className="tree-icon">📄</span>
                            <span className="tree-label">{lesson.title}</span>
                            <span className="tree-badge-small">{lesson.difficulty}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {course.topics && course.topics.length > 0 ? (
                      course.topics.map((topic) => (
                        <div key={topic.id} className="tree-item">
                          <div
                            className={`tree-node topic-node ${selectedTopic?.id === topic.id ? 'selected' : ''}`}
                            onClick={() => handleSelectTopic(topic)}
                          >
                            <button
                              className="tree-toggle"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTopic(topic.id);
                              }}
                            >
                              {expandedTopics.has(topic.id) ? '−' : '+'}
                            </button>
                            <span className="tree-icon">📖</span>
                            <span className="tree-label">{topic.name}</span>
                            <span className="tree-badge">
                              {topic.subtopics?.length || 0} subtopics, {topic.lessons?.length || 0} lessons
                            </span>
                            <button
                              className="btn-add-small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNewSubtopic(topic);
                              }}
                              title="Add Subtopic"
                            >
                              +
                            </button>
                          </div>

                          {expandedTopics.has(topic.id) && (
                            <div className="tree-children">
                              {/* Subtopics - Display all subtopics under this topic */}
                              {topic.subtopics && Array.isArray(topic.subtopics) && topic.subtopics.length > 0 ? (
                                topic.subtopics
                                  .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                                  .map((subtopic) => (
                                <div key={subtopic.id} className="tree-item">
                                  <div
                                    className={`tree-node subtopic-node ${selectedSubtopic?.id === subtopic.id ? 'selected' : ''}`}
                                    onClick={() => handleSelectSubtopic(subtopic)}
                                  >
                                    <button
                                      className="tree-toggle"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSubtopic(subtopic.id);
                                      }}
                                    >
                                      {expandedSubtopics.has(subtopic.id) ? '−' : '+'}
                                    </button>
                                    <span className="tree-icon">📑</span>
                                    <span className="tree-label">{subtopic.name}</span>
                                    <span className="tree-badge">
                                      {subtopic.lessons?.length || 0} lessons
                                    </span>
                                    <button
                                      className="btn-add-small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleNewLesson(course, topic, subtopic);
                              }}
                              title="Add Lesson"
                            >
                              +
                            </button>
                          </div>

                                  {expandedSubtopics.has(subtopic.id) && subtopic.lessons && subtopic.lessons.length > 0 && (
                            <div className="tree-children">
                                      {subtopic.lessons.map((lesson) => (
                                <div
                                  key={lesson.id}
                                  className={`tree-node lesson-node ${selectedLesson?.id === lesson.id ? 'selected' : ''}`}
                                          onClick={() => handleSelectLesson(lesson)}
                                >
                                  <span className="tree-icon">📄</span>
                                  <span className="tree-label">{lesson.title}</span>
                                          <span className="tree-badge-small">{lesson.difficulty}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                              ) : null}

                              {/* Lessons directly under topic (if no subtopics or additional lessons) */}
                              {topic.lessons && topic.lessons.length > 0 && (
                                <div className="tree-children">
                                  {topic.lessons
                                    .filter(l => !l.subtopic_id)
                                    .map((lesson) => (
                        <div
                          key={lesson.id}
                          className={`tree-node lesson-node ${selectedLesson?.id === lesson.id ? 'selected' : ''}`}
                                      onClick={() => handleSelectLesson(lesson)}
                        >
                          <span className="tree-icon">📄</span>
                          <span className="tree-label">{lesson.title}</span>
                                      <span className="tree-badge-small">{lesson.difficulty}</span>
                        </div>
                                  ))}
                                </div>
                              )}
                            </div>
                    )}
                        </div>
                      ))
                    ) : (
                      <div className="tree-empty">
                        <div>No content yet</div>
                        <button
                          className="btn-add-small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNewTopic(course);
                          }}
                          title="Add Topic"
                          style={{ opacity: 1, marginTop: '8px' }}
                        >
                          + Topic
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Editor */}
        <div className="cms-editor-panel">
          {selectedCourse ? (
            <>
              <div className="editor-header">
                <h2>{selectedCourse.name} {selectedCourse.icon || '📚'}</h2>
                <div className="editor-tabs">
              <button
                className={`tab-button ${activeTab === 'course-selector' ? 'active' : ''}`}
                onClick={() => setActiveTab('course-selector')}
              >
                Course Editor
                  </button>
              <button
                className={`tab-button ${activeTab === 'topic-selector' ? 'active' : ''}`}
                onClick={() => setActiveTab('topic-selector')}
                disabled={!selectedCourse}
              >
                Topic Manager
              </button>
              <button
                className={`tab-button ${activeTab === 'subtopic-selector' ? 'active' : ''}`}
                onClick={() => setActiveTab('subtopic-selector')}
                disabled={!selectedTopic}
              >
                Subtopic Manager
              </button>
              <button
                className={`tab-button ${activeTab === 'content-editor' ? 'active' : ''}`}
                onClick={() => setActiveTab('content-editor')}
                disabled={!selectedCourse}
              >
                Content Editor
              </button>
              <button
                className={`tab-button ${activeTab === 'lab-manager' ? 'active' : ''}`}
                onClick={() => setActiveTab('lab-manager')}
                disabled={!selectedCourse}
              >
                Lab Manager
              </button>
                </div>
              </div>

              <div className="tab-content">
            {activeTab === 'course-selector' && (
              <CourseEditor
                course={selectedCourse}
                courses={courses}
                onSelectCourse={handleSelectCourse}
                form={courseForm}
                setForm={setCourseForm}
                onSave={selectedCourse ? handleUpdateCourse : handleCreateCourse}
                onDelete={selectedCourse ? () => handleDeleteCourse(selectedCourse.id) : null}
              saving={saving}
            />
            )}

            {activeTab === 'topic-selector' && selectedCourse && (
              <TopicManager
                course={currentCourse}
                selectedTopic={selectedTopic}
                onSelect={handleSelectTopic}
                onNew={() => handleNewTopic(selectedCourse)}
                form={topicForm}
                setForm={setTopicForm}
                onSave={selectedTopic?.id ? handleUpdateTopic : handleCreateTopic}
                onDelete={selectedTopic?.id ? () => handleDeleteTopic(selectedTopic.id) : null}
                saving={saving}
              />
            )}

            {activeTab === 'subtopic-selector' && selectedTopic && (
              <SubtopicManager
              topic={selectedTopic}
                selectedSubtopic={selectedSubtopic}
                onSelect={handleSelectSubtopic}
                onNew={() => handleNewSubtopic(selectedTopic)}
                form={subtopicForm}
                setForm={setSubtopicForm}
                onSave={selectedSubtopic?.id ? handleUpdateSubtopic : handleCreateSubtopic}
                onDelete={selectedSubtopic?.id ? () => handleDeleteSubtopic(selectedSubtopic.id) : null}
              saving={saving}
            />
            )}

            {activeTab === 'content-editor' && selectedCourse && (
              <ContentEditor
                course={currentCourse || selectedCourse}
                topic={selectedTopic}
                subtopic={selectedSubtopic}
                selectedLesson={selectedLesson}
                onSelect={handleSelectLesson}
                onNew={() => handleNewLesson(selectedCourse, selectedTopic, selectedSubtopic)}
                form={lessonForm}
                setForm={setLessonForm}
                onSave={selectedLesson?.id ? handleUpdateLesson : handleCreateLesson}
                onDelete={selectedLesson?.id ? () => handleDeleteLesson(selectedLesson.id) : null}
              saving={saving}
            />
            )}

            {activeTab === 'lab-manager' && selectedCourse && (
              <LabManager
                course={currentCourse}
                topic={selectedTopic}
                subtopic={selectedSubtopic}
                lesson={selectedLesson}
                selectedLab={selectedLab}
                onSelect={handleSelectLab}
                onNew={() => handleNewLab(selectedCourse, selectedTopic, selectedSubtopic, selectedLesson)}
                form={labForm}
                setForm={setLabForm}
                onSave={selectedLab?.id ? handleUpdateLab : handleCreateLab}
                onDelete={selectedLab?.id ? () => handleDeleteLab(selectedLab.id) : null}
              saving={saving}
            />
          )}
        </div>
            </>
          ) : (
            <div className="empty-state">
              {showNewCourseForm || activeTab === 'course-selector' ? (
            <CourseEditor
              course={null}
                  courses={courses}
                  onSelectCourse={handleSelectCourse}
              form={courseForm}
              setForm={setCourseForm}
              onSave={handleCreateCourse}
              onDelete={null}
              saving={saving}
                  onCancel={() => {
                    setShowNewCourseForm(false);
                    setActiveTab(null);
                    setCourseForm({ name: '', description: '', icon: '' });
                  }}
                />
              ) : (
                <>
                  <h2>Select a Course</h2>
                  <p>Select a course from the sidebar to start managing its content.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// Course Editor Component
const CourseEditor = ({ course, courses = [], onSelectCourse, form, setForm, onSave, onDelete, saving, compact = false, onCancel }) => {
  // If compact mode, just show the form
  if (compact) {
    return (
      <div className="course-editor-compact">
        <form onSubmit={onSave} className="course-form-compact">
          <div className="form-group">
            <label>Course Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Java Foundations"
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <div className="rich-text-editor-wrapper" style={{ minHeight: '400px' }}>
              <ReactQuill
                theme="snow"
                value={form.description || ''}
                onChange={(content) => setForm({ ...form, description: content })}
                modules={QUILL_MODULES_BASIC}
                placeholder="What will learners achieve in this course? (Rich text supported)"
                style={{ minHeight: '350px' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Icon (emoji or short text)</label>
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="📘"
            />
          </div>

          <div className="form-actions-compact">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : course ? 'Update Course' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Full mode: Only show Add/Edit Course Form (no existing courses list)
  return (
    <div className="detail-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{course ? 'Edit' : 'CREATE'}</p>
          <h2>{course ? 'Edit Course' : 'Create New Course'}</h2>
          <p className="helper-text">
            {course ? `Editing: ${course.name}` : `Total Courses: ${courses.length}`}
          </p>
        </div>
        {course && <div className="status-badge published">Published</div>}
      </div>

      <form onSubmit={onSave} className="detail-form">
        <div className="form-group">
          <label>Course Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Java Foundations"
            required
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <div className="rich-text-editor-wrapper" style={{ minHeight: '400px' }}>
            <ReactQuill
              theme="snow"
              value={form.description || ''}
              onChange={(content) => setForm({ ...form, description: content })}
              modules={QUILL_MODULES_BASIC}
              placeholder="What will learners achieve in this course? (Rich text supported)"
              style={{ minHeight: '350px' }}
          />
          </div>
        </div>

        <div className="form-group">
          <label>Icon (emoji or short text)</label>
          <input
            type="text"
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
            placeholder="📘"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : course ? 'Update Course' : 'Create Course'}
          </button>
          {onCancel && (
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          )}
          {course && onDelete && (
            <button type="button" className="btn-danger" onClick={onDelete} disabled={saving}>
              Delete Course
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

// Topic Manager Component
const TopicManager = ({ course, selectedTopic, onSelect, onNew, form, setForm, onSave, onDelete, saving }) => {
  return (
    <div className="detail-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{selectedTopic?.id ? 'Edit' : 'Create'}</p>
          <h2>{selectedTopic?.id ? 'Edit Topic' : 'Create New Topic'}</h2>
          <p className="helper-text">Under: {course?.name}</p>
        </div>
        <button className="btn-primary" onClick={onNew}>+ New Topic</button>
      </div>

      <div className={`manager-layout ${(course?.topics?.length || 0) === 0 ? 'manager-layout-single' : ''}`}>
        <div className="manager-list">
          <h3>Existing Topics ({course?.topics?.length || 0})</h3>
          {course?.topics && course.topics.length > 0 ? (
            <div className="list-items">
              {course.topics
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                .map((topic) => (
                <div
                  key={topic.id}
                  className={`list-item ${selectedTopic?.id === topic.id ? 'selected' : ''}`}
                  onClick={() => onSelect(topic)}
                >
                  <span className="list-icon">📖</span>
                  <div className="list-item-content">
                    <span className="list-label">
                      {topic.order_index !== undefined && topic.order_index !== null && (
                        <span className="order-badge">#{topic.order_index}</span>
                      )}
                      {topic.name}
                    </span>
                  </div>
                  <span className="list-badge">{topic.subtopics?.length || 0} subtopics</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-list">No topics yet. Create one to get started.</div>
          )}
        </div>

        <div className="manager-form">
      <form onSubmit={onSave} className="detail-form">
        <div className="form-group">
          <label>Topic Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Object-Oriented Programming"
            required
          />
        </div>

        <div className="form-group">
          <label>Description</label>
              <div className="rich-text-editor-wrapper" style={{ minHeight: '120px' }}>
                <ReactQuill
                  theme="snow"
                  value={form.description || ''}
                  onChange={(content) => setForm({ ...form, description: content })}
                  modules={QUILL_MODULES_BASIC}
                  placeholder="Brief description of this topic (Rich text supported)"
                  style={{ minHeight: '100px' }}
          />
              </div>
        </div>

        <div className="form-group">
          <label>Order Index</label>
          <input
            type="number"
            value={form.order_index}
            onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })}
            min="0"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : selectedTopic?.id ? 'Update Topic' : 'Create Topic'}
          </button>
              {selectedTopic?.id && onDelete && (
            <button type="button" className="btn-danger" onClick={onDelete} disabled={saving}>
              Delete Topic
            </button>
          )}
        </div>
      </form>
        </div>
      </div>
    </div>
  );
};

// Subtopic Manager Component
const SubtopicManager = ({ topic, selectedSubtopic, onSelect, onNew, form, setForm, onSave, onDelete, saving }) => {
  return (
    <div className="detail-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{selectedSubtopic?.id ? 'Edit' : 'Create'}</p>
          <h2>{selectedSubtopic?.id ? 'Edit Subtopic' : 'Create New Subtopic'}</h2>
          <p className="helper-text">Under: {topic?.name}</p>
        </div>
        <button className="btn-primary" onClick={onNew}>+ New Subtopic</button>
      </div>

      <div className="manager-layout">
        <div className="manager-list">
          <h3>Existing Subtopics ({topic?.subtopics?.length || 0})</h3>
          {topic?.subtopics && topic.subtopics.length > 0 ? (
            <div className="list-items">
              {topic.subtopics
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                .map((subtopic) => (
                <div
                  key={subtopic.id}
                  className={`list-item ${selectedSubtopic?.id === subtopic.id ? 'selected' : ''}`}
                  onClick={() => onSelect(subtopic)}
                >
                  <span className="list-icon">📑</span>
                  <div className="list-item-content">
                    <span className="list-label">
                      {subtopic.order_index !== undefined && subtopic.order_index !== null && (
                        <span className="order-badge">#{subtopic.order_index}</span>
                      )}
                      {subtopic.name}
                    </span>
                  </div>
                  <span className="list-badge">{subtopic.lessons?.length || 0} lessons</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-list">No subtopics yet. Create one to get started.</div>
          )}
        </div>

        <div className="manager-form">
          <form onSubmit={onSave} className="detail-form">
            <div className="form-group">
              <label>Subtopic Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Classes and Objects"
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <div className="rich-text-editor-wrapper" style={{ minHeight: '120px' }}>
                <ReactQuill
                  theme="snow"
                  value={form.description || ''}
                  onChange={(content) => setForm({ ...form, description: content })}
                  modules={QUILL_MODULES_BASIC}
                  placeholder="Brief description of this subtopic (Rich text supported)"
                  style={{ minHeight: '100px' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Order Index</label>
              <input
                type="number"
                value={form.order_index}
                onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : selectedSubtopic?.id ? 'Update Subtopic' : 'Create Subtopic'}
              </button>
              {selectedSubtopic?.id && onDelete && (
                <button type="button" className="btn-danger" onClick={onDelete} disabled={saving}>
                  Delete Subtopic
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Content Editor Component
// Interactive Code Editor Component with Copy, Run, Reset, Try Yourself, and Analyze buttons
const InteractiveCodeEditor = ({ 
  language = 'java', 
  initialCode = '', 
  onCodeChange, 
  onLanguageChange,
  lessonTitle = '',
  lessonTopic = '',
  readOnly = false 
}) => {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const [running, setRunning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [copied, setCopied] = useState(false);
  const [originalCode, setOriginalCode] = useState(initialCode);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    setCode(initialCode);
    setOriginalCode(initialCode);
    return () => {
      isMountedRef.current = false;
    };
  }, [initialCode]);

  useEffect(() => {
    if (onCodeChange) {
      onCodeChange(code);
    }
  }, [code, onCodeChange]);

  const languageMap = {
    java: 'java',
    python: 'python',
    nodejs: 'javascript',
    golang: 'go',
    javascript: 'javascript',
    go: 'go'
  };

  const editorLanguage = languageMap[language.toLowerCase()] || 'java';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRun = async () => {
    if (!code.trim()) {
      setOutput('Error: No code to execute');
      setShowOutput(true);
      return;
    }

    setRunning(true);
    setShowOutput(true);
    setOutput('Executing code...\n');

    try {
      const response = await axios.post(
        `${API_BASE}/execute/code`,
        {
          code: code,
          language: language.toLowerCase()
        },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!isMountedRef.current) return;

      const result = response.data;
      let outputText = '';

      if (result.success) {
        outputText = result.output || 'Code executed successfully (no output)';
        if (result.error) {
          outputText += '\n\nWarnings:\n' + result.error;
        }
      } else {
        outputText = 'Error executing code:\n' + (result.error || 'Unknown error');
        if (result.output) {
          outputText += '\n\nOutput:\n' + result.output;
        }
      }

      setOutput(outputText);
    } catch (error) {
      if (!isMountedRef.current) return;
      const errorMessage = error.response?.data?.error || error.message || 'Failed to execute code';
      setOutput('Error: ' + errorMessage);
    } finally {
      if (isMountedRef.current) {
        setRunning(false);
      }
    }
  };

  const handleReset = () => {
    setCode(originalCode);
    setOutput('');
    setShowOutput(false);
    setAnalysis('');
    setShowAnalysis(false);
  };

  const handleTryYourself = () => {
    // Clear the code for students to try themselves
    setCode('');
    setOutput('');
    setShowOutput(false);
    setAnalysis('');
    setShowAnalysis(false);
  };

  const handleAnalyze = async () => {
    if (!code.trim()) {
      setAnalysis('Error: No code to analyze');
      setShowAnalysis(true);
      return;
    }

    setAnalyzing(true);
    setShowAnalysis(true);
    setAnalysis('Analyzing code...\n');

    try {
      const response = await axios.post(
        `${API_BASE}/analyze/code`,
        {
          code: code,
          language: language.toLowerCase(),
          lessonTitle: lessonTitle,
          lessonTopic: lessonTopic
        },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!isMountedRef.current) return;

      const result = response.data;
      let analysisText = '';

      if (result.analysis) {
        analysisText = result.analysis;
      } else if (result.feedback) {
        analysisText = result.feedback;
      } else {
        analysisText = JSON.stringify(result, null, 2);
      }

      setAnalysis(analysisText);
    } catch (error) {
      if (!isMountedRef.current) return;
      const errorMessage = error.response?.data?.error || error.message || 'Failed to analyze code';
      setAnalysis('Error: ' + errorMessage);
    } finally {
      if (isMountedRef.current) {
        setAnalyzing(false);
      }
    }
  };

  return (
    <div className="interactive-code-editor-container">
      <div className="code-editor-toolbar">
        <div className="code-editor-toolbar-left">
          <select
            value={language}
            onChange={(e) => {
              if (onLanguageChange) {
                onLanguageChange(e.target.value);
              }
            }}
            className="language-selector"
            disabled={readOnly}
          >
            <option value="java">Java</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="golang">Go</option>
          </select>
          <span className="editor-language-badge">{editorLanguage.toUpperCase()}</span>
        </div>
        <div className="code-editor-toolbar-right">
          <button
            className="btn-code-action"
            onClick={handleCopy}
            title="Copy Code"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
          <button
            className="btn-code-action btn-code-run"
            onClick={handleRun}
            disabled={running || readOnly}
            title="Run Code"
          >
            {running ? '⏳ Running...' : '▶ Run'}
          </button>
          <button
            className="btn-code-action"
            onClick={handleReset}
            disabled={readOnly}
            title="Reset to Original"
          >
            ↻ Reset
          </button>
          <button
            className="btn-code-action btn-code-try"
            onClick={handleTryYourself}
            disabled={readOnly}
            title="Try Yourself - Clear Code"
          >
            ✏️ Try Yourself
          </button>
          <button
            className="btn-code-action btn-code-analyze"
            onClick={handleAnalyze}
            disabled={analyzing || readOnly}
            title="Analyze Code"
          >
            {analyzing ? '⏳ Analyzing...' : '🔍 Analyze'}
          </button>
        </div>
      </div>

      <div className="monaco-editor-wrapper">
        <Editor
          height="400px"
          language={editorLanguage}
          value={code}
          onChange={(value) => {
            if (!readOnly && isMountedRef.current) {
              setCode(value || '');
            }
          }}
          theme="vs-dark"
          loading={<div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>Loading editor...</div>}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            readOnly: readOnly,
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            selectOnLineNumbers: true,
            roundedSelection: false,
            cursorStyle: 'line',
            fontFamily: "'Fira Code', 'Courier New', monospace",
            fontLigatures: true
          }}
        />
      </div>

      {showOutput && (
        <div className="code-output-panel">
          <div className="code-output-header">
            <span>Output</span>
            <button
              className="btn-close-output"
              onClick={() => setShowOutput(false)}
            >
              ×
            </button>
          </div>
          <pre className="code-output-content">{output}</pre>
        </div>
      )}

      {showAnalysis && (
        <div className="code-analysis-panel">
          <div className="code-analysis-header">
            <span>Code Analysis</span>
            <button
              className="btn-close-output"
              onClick={() => setShowAnalysis(false)}
            >
              ×
            </button>
          </div>
          <div className="code-analysis-content">{analysis}</div>
        </div>
      )}
    </div>
  );
};

const ContentEditor = ({ course, topic, subtopic, selectedLesson, onSelect, onNew, form, setForm, onSave, onDelete, saving }) => {
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  
  // Memoize lessons calculation to prevent repeated recalculations on every render
  const lessons = useMemo(() => {
    // If subtopic is selected, show lessons from that subtopic
    if (subtopic && subtopic.lessons) {
      return subtopic.lessons.map(l => ({ ...l, source: `Subtopic: ${subtopic.name}` }));
    }
    
    // If topic is selected, show all lessons from that topic (including subtopic lessons)
    if (topic && topic.lessons) {
      const topicLessons = topic.lessons.filter(l => !l.subtopic_id).map(l => ({ ...l, source: `Topic: ${topic.name}` }));
      
      // Also include lessons from subtopics
      if (topic.subtopics) {
        const subtopicLessons = topic.subtopics.flatMap(st => 
          (st.lessons || []).map(l => ({ ...l, source: `Subtopic: ${st.name}` }))
        );
        return [...topicLessons, ...subtopicLessons];
      }
      
      return topicLessons;
    }
    
    // If course is selected but no topic/subtopic, show ALL lessons from the course
    if (course && course.topics && Array.isArray(course.topics) && course.topics.length > 0) {
      const allLessons = [];
      
      course.topics.forEach(t => {
        // Lessons directly under topic
        if (t.lessons && Array.isArray(t.lessons) && t.lessons.length > 0) {
          t.lessons.filter(l => !l.subtopic_id).forEach(l => {
            allLessons.push({ ...l, source: `Topic: ${t.name}` });
          });
        }
        
        // Lessons from subtopics
        if (t.subtopics && Array.isArray(t.subtopics) && t.subtopics.length > 0) {
          t.subtopics.forEach(st => {
            if (st.lessons && Array.isArray(st.lessons) && st.lessons.length > 0) {
              st.lessons.forEach(l => {
                allLessons.push({ ...l, source: `Subtopic: ${st.name} (${t.name})` });
              });
            }
          });
        }
      });
      
      return allLessons.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    }
    
    return [];
  }, [course, topic, subtopic]); // Only recalculate when these dependencies change

  // Rich Text Editor Configuration - use memoized modules from top of file

  // Determine where the lesson will be created
  const getCreationContext = () => {
    if (subtopic && subtopic.id) {
      return `Creating lesson under: ${subtopic.name} (${topic?.name || 'Unknown Topic'})`;
    } else if (topic && topic.id) {
      return `Creating lesson under: ${topic.name}`;
    } else if (course) {
      return `Creating lesson in: ${course.name} (course level)`;
    }
    return 'Select a course, topic, or subtopic to create a lesson';
  };

  // Generate content using TinyLlama
  const handleGenerateContent = async () => {
    if (!selectedLesson || !selectedLesson.id) {
      alert('Please select a lesson first to generate content.');
      return;
    }

    if (!form.title) {
      alert('Please enter a lesson title first.');
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE}/admin/lessons/${selectedLesson.id}/generate-content`,
        {
          topics: [form.title, topic?.name, subtopic?.name].filter(Boolean),
          difficulty: form.difficulty || 'beginner'
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data && response.data.lesson) {
        // Update the form with generated content
        setForm({
          ...form,
          content: response.data.lesson.content || '',
          difficulty: response.data.lesson.difficulty || form.difficulty
        });
        alert(`Content generated successfully! (${response.data.contentLength} characters)`);
      }
    } catch (error) {
      console.error('Error generating content:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to generate content';
      setGenerateError(errorMessage);
      alert(`Error generating content: ${errorMessage}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="detail-panel">
      <div className="panel-header">
        <div>
          <h2>Content Editor</h2>
          {!selectedLesson && (
            <p className="helper-text" style={{ marginTop: '4px', fontSize: '13px', color: '#6b7280' }}>
              {getCreationContext()}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-primary" onClick={onNew}>+ New Lesson</button>
        </div>
      </div>

      <div className="manager-layout manager-layout-single">
        {/* Section A: Existing Lessons List (shown only when there are lessons) */}
        {lessons.length > 0 && (
          <div className="manager-list">
            <h3>Existing Lessons ({lessons.length})</h3>
            <div className="list-items">
              {lessons
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                .map((lesson) => (
                  <div
                    key={lesson.id}
                    className={`list-item ${selectedLesson?.id === lesson.id ? 'selected' : ''}`}
                    onClick={() => onSelect(lesson)}
                  >
                    <span className="list-icon"></span>
                    <div className="list-item-content">
                      <span className="list-label">
                        {lesson.order_index !== undefined && lesson.order_index !== null && (
                          <span className="order-badge">#{lesson.order_index}</span>
                        )}
                        {lesson.title}
                      </span>
                      {lesson.source && (
                        <span className="list-source">{lesson.source}</span>
                      )}
                    </div>
                    <span className="list-badge">{lesson.difficulty}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="manager-form">
      <form onSubmit={onSave} className="detail-form">
        <div className="form-group">
          <label>Lesson Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., Introduction to Variables"
            required
          />
        </div>

        <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ margin: 0 }}>Content *</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {selectedLesson?.id && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleGenerateContent}
                      disabled={generating || saving}
                      style={{ fontSize: '12px', padding: '4px 12px' }}
                      title="Generate comprehensive lesson content using AI (TinyLlama)"
                    >
                      {generating ? '🔄 Generating...' : '🤖 Generate with AI'}
                    </button>
                  )}
                  <span className="helper-text" style={{ margin: 0, fontSize: '12px' }}>
                    Rich Text Editor with full formatting options
                  </span>
                </div>
              </div>
              <div className="rich-text-editor-wrapper">
                <ReactQuill
                  theme="snow"
            value={form.content}
                  onChange={(content) => setForm({ ...form, content })}
                  modules={QUILL_MODULES_FULL}
                  formats={QUILL_FORMATS_FULL}
                  placeholder="Enter your lesson content here. Use the toolbar to format text, add lists, code blocks, and more..."
                  style={{ minHeight: '400px' }}
                />
              </div>
              <p className="helper-text">
                💡 Tip: Use the toolbar to format text, add headings, lists, code blocks, links, and images.
              </p>
        </div>

        <div className="form-group">
          <label>Code Example (Interactive Code Editor)</label>
          <p className="helper-text" style={{ marginBottom: '12px' }}>
            Add an interactive code example that students can run, modify, and analyze. This follows Geeks for Geeks style content.
          </p>
          <InteractiveCodeEditor
            language={form.code_language || 'java'}
            initialCode={form.code_example || ''}
            onCodeChange={(code) => setForm({ ...form, code_example: code })}
            onLanguageChange={(lang) => setForm({ ...form, code_language: lang })}
            lessonTitle={form.title}
            lessonTopic={topic?.name || subtopic?.name || course?.name}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Difficulty</label>
            <select
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div className="form-group">
            <label>Estimated Time (minutes)</label>
            <input
              type="number"
              value={form.estimated_time}
              onChange={(e) => setForm({ ...form, estimated_time: parseInt(e.target.value) || 20 })}
              min="0"
            />
          </div>

          <div className="form-group">
            <label>Order Index</label>
            <input
              type="number"
              value={form.order_index}
              onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })}
              min="0"
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : selectedLesson?.id ? 'Update Lesson' : 'Create Lesson'}
          </button>
              {selectedLesson?.id && onDelete && (
            <button type="button" className="btn-danger" onClick={onDelete} disabled={saving}>
              Delete Lesson
            </button>
          )}
        </div>
      </form>
        </div>
      </div>
    </div>
  );
};

// Lab Manager Component
const LabManager = ({ course, topic, subtopic, lesson, selectedLab, onSelect, onNew, form, setForm, onSave, onDelete, saving }) => {
  const [labs, setLabs] = useState([]);
  const [loadingLabs, setLoadingLabs] = useState(false);

  const fetchLabs = useCallback(async () => {
    if (!course) return;
    setLoadingLabs(true);
    try {
      const params = new URLSearchParams({ courseId: course.id });
      if (topic?.id) params.append('topicId', topic.id);
      if (subtopic?.id) params.append('subtopicId', subtopic.id);
      if (lesson?.id) params.append('lessonId', lesson.id);

      const response = await axios.get(`${API_BASE}/admin/labs?${params}`);
      setLabs(response.data);
    } catch (error) {
      console.error('Failed to fetch labs:', error);
    } finally {
      setLoadingLabs(false);
    }
  }, [course, topic, subtopic, lesson]);

  useEffect(() => {
    fetchLabs();
  }, [fetchLabs]);

  return (
    <div className="detail-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{selectedLab?.id ? 'Edit' : 'Create'}</p>
          <h2>{selectedLab?.id ? 'Edit Lab' : 'Create New Lab'}</h2>
          <p className="helper-text">
            {lesson ? `For: ${lesson.title}` : subtopic ? `Under: ${subtopic.name}` : topic ? `Under: ${topic.name}` : `In: ${course?.name}`}
          </p>
        </div>
        <button className="btn-primary" onClick={onNew}>+ New Lab</button>
      </div>

      <div className="manager-layout">
        <div className="manager-list">
          <h3>Labs</h3>
          {loadingLabs ? (
            <div className="empty-list">Loading...</div>
          ) : labs.length > 0 ? (
            <div className="list-items">
              {labs.map((lab) => (
                <div
                  key={lab.id}
                  className={`list-item ${selectedLab?.id === lab.id ? 'selected' : ''}`}
                  onClick={() => onSelect(lab)}
                >
                  <span className="list-icon">🧪</span>
                  <span className="list-label">{lab.title}</span>
                  <span className="list-badge">{lab.difficulty}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-list">No labs yet. Create one to get started.</div>
          )}
        </div>

        <div className="manager-form">
          <form onSubmit={onSave} className="detail-form">
            <div className="form-group">
              <label>Lab Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., Build a Calculator"
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of the lab"
                rows={2}
              />
            </div>

            <div className="form-group">
              <label>Instructions</label>
              <textarea
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                placeholder="Step-by-step instructions for the lab"
                rows={4}
              />
            </div>

            <div className="form-group">
              <label>Starter Code</label>
              <textarea
                value={form.starter_code}
                onChange={(e) => setForm({ ...form, starter_code: e.target.value })}
                placeholder="Initial code provided to students"
                rows={8}
                className="content-editor"
              />
            </div>

            <div className="form-group">
              <label>Solution Code</label>
              <textarea
                value={form.solution_code}
                onChange={(e) => setForm({ ...form, solution_code: e.target.value })}
                placeholder="Complete solution code"
                rows={8}
                className="content-editor"
              />
            </div>

            <div className="form-group">
              <label>Test Cases (JSON)</label>
              <textarea
                value={form.test_cases}
                onChange={(e) => setForm({ ...form, test_cases: e.target.value })}
                placeholder='{"test1": {"input": "...", "expected": "..."}}'
                rows={4}
                className="content-editor"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Difficulty</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div className="form-group">
                <label>Estimated Time (minutes)</label>
                <input
                  type="number"
                  value={form.estimated_time}
                  onChange={(e) => setForm({ ...form, estimated_time: parseInt(e.target.value) || 30 })}
                  min="0"
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : selectedLab?.id ? 'Update Lab' : 'Create Lab'}
              </button>
              {selectedLab?.id && onDelete && (
                <button type="button" className="btn-danger" onClick={onDelete} disabled={saving}>
                  Delete Lab
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CourseManagement;
