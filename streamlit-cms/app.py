import streamlit as st
import sqlite3
import os
from datetime import datetime
from streamlit_quill import st_quill

# Database file path
DB_PATH = "cms.db"

# Initialize database
def init_db():
    """Initialize SQLite database with required tables"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Table 1: Courses
    c.execute('''
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            icon TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Table 2: Lessons
    c.execute('''
        CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            order_index INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            UNIQUE(course_id, title)
        )
    ''')
    
    # Table 3: Subtopics
    c.execute('''
        CREATE TABLE IF NOT EXISTS subtopics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            order_index INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
            UNIQUE(lesson_id, title)
        )
    ''')
    
    conn.commit()
    conn.close()

# Database helper functions
def get_connection():
    """Get database connection"""
    return sqlite3.connect(DB_PATH)

# Course operations
def get_courses():
    """Get all courses"""
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM courses ORDER BY name')
    courses = c.fetchall()
    conn.close()
    return courses

def add_course(name, description, icon):
    """Add a new course"""
    conn = get_connection()
    c = conn.cursor()
    try:
        c.execute('INSERT INTO courses (name, description, icon) VALUES (?, ?, ?)',
                 (name, description, icon))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def delete_course(course_id):
    """Delete a course (cascades to lessons and subtopics)"""
    conn = get_connection()
    c = conn.cursor()
    c.execute('DELETE FROM courses WHERE id = ?', (course_id,))
    conn.commit()
    conn.close()

# Lesson operations
def get_lessons(course_id):
    """Get all lessons for a course"""
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index, title',
              (course_id,))
    lessons = c.fetchall()
    conn.close()
    return lessons

def add_lesson(course_id, title, order_index):
    """Add a new lesson"""
    conn = get_connection()
    c = conn.cursor()
    try:
        c.execute('INSERT INTO lessons (course_id, title, order_index) VALUES (?, ?, ?)',
                 (course_id, title, order_index))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def delete_lesson(lesson_id):
    """Delete a lesson (cascades to subtopics)"""
    conn = get_connection()
    c = conn.cursor()
    c.execute('DELETE FROM lessons WHERE id = ?', (lesson_id,))
    conn.commit()
    conn.close()

# Subtopic operations
def get_subtopics(lesson_id):
    """Get all subtopics for a lesson"""
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM subtopics WHERE lesson_id = ? ORDER BY order_index, title',
              (lesson_id,))
    subtopics = c.fetchall()
    conn.close()
    return subtopics

def add_subtopic(lesson_id, title, order_index):
    """Add a new subtopic"""
    conn = get_connection()
    c = conn.cursor()
    try:
        c.execute('INSERT INTO subtopics (lesson_id, title, content, order_index) VALUES (?, ?, ?, ?)',
                 (lesson_id, title, '', order_index))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def update_subtopic_content(subtopic_id, content):
    """Update subtopic content"""
    conn = get_connection()
    c = conn.cursor()
    c.execute('UPDATE subtopics SET content = ? WHERE id = ?', (content, subtopic_id))
    conn.commit()
    conn.close()

def delete_subtopic(subtopic_id):
    """Delete a subtopic"""
    conn = get_connection()
    c = conn.cursor()
    c.execute('DELETE FROM subtopics WHERE id = ?', (subtopic_id,))
    conn.commit()
    conn.close()

def get_subtopic(subtopic_id):
    """Get a single subtopic by ID"""
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM subtopics WHERE id = ?', (subtopic_id,))
    subtopic = c.fetchone()
    conn.close()
    return subtopic

# Initialize database on startup
init_db()

# Page configuration
st.set_page_config(
    page_title="Course Management System",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better styling
st.markdown("""
    <style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        color: #1f77b4;
        margin-bottom: 1rem;
    }
    .section-header {
        font-size: 1.5rem;
        font-weight: bold;
        color: #2c3e50;
        margin-top: 2rem;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid #3498db;
    }
    .stButton>button {
        width: 100%;
        border-radius: 5px;
    }
    </style>
""", unsafe_allow_html=True)

# Initialize session state
if 'selected_course_id' not in st.session_state:
    st.session_state.selected_course_id = None
if 'selected_lesson_id' not in st.session_state:
    st.session_state.selected_lesson_id = None
if 'selected_subtopic_id' not in st.session_state:
    st.session_state.selected_subtopic_id = None

# Sidebar - Course Selection
st.sidebar.markdown("<h1 class='main-header'>📚 CMS</h1>", unsafe_allow_html=True)
st.sidebar.markdown("### Select or Add Course")

# Get all courses
courses = get_courses()

# Course selection dropdown
if courses:
    course_options = {f"{course[1]} (ID: {course[0]})": course[0] for course in courses}
    selected_course_name = st.sidebar.selectbox(
        "Choose a course:",
        options=list(course_options.keys()),
        index=0 if st.session_state.selected_course_id else 0
    )
    st.session_state.selected_course_id = course_options[selected_course_name]
else:
    st.sidebar.info("No courses yet. Create one below!")
    st.session_state.selected_course_id = None

# Add New Course Form in Sidebar
st.sidebar.markdown("---")
st.sidebar.markdown("### ➕ Add New Course")

with st.sidebar.form("add_course_form", clear_on_submit=True):
    course_name = st.text_input("Course Name *", placeholder="e.g., Java Fundamentals")
    course_description = st.text_area("Description", placeholder="Course description...")
    course_icon = st.text_input("Icon (emoji)", placeholder="📘", value="📘")
    
    submitted = st.form_submit_button("Add Course", use_container_width=True)
    
    if submitted:
        if course_name:
            if add_course(course_name, course_description, course_icon):
                st.sidebar.success(f"✅ Course '{course_name}' added!")
                st.rerun()
            else:
                st.sidebar.error("❌ Course name already exists!")
        else:
            st.sidebar.error("❌ Course name is required!")

# Main Page
st.markdown("<h1 class='main-header'>Course Management System</h1>", unsafe_allow_html=True)

# Main Page Top - Lessons Section
if st.session_state.selected_course_id:
    # Get course info
    selected_course = next((c for c in courses if c[0] == st.session_state.selected_course_id), None)
    
    if selected_course:
        st.markdown(f"<div class='section-header'>📖 Lessons in: {selected_course[1]} {selected_course[3] if selected_course[3] else ''}</div>", 
                   unsafe_allow_html=True)
        
        # Get lessons for selected course
        lessons = get_lessons(st.session_state.selected_course_id)
        
        # Display lessons in columns
        if lessons:
            cols = st.columns(3)
            for idx, lesson in enumerate(lessons):
                with cols[idx % 3]:
                    with st.container():
                        st.markdown(f"**{lesson[2]}** (Order: {lesson[3]})")
                        if st.button(f"Select", key=f"select_lesson_{lesson[0]}"):
                            st.session_state.selected_lesson_id = lesson[0]
                            st.session_state.selected_subtopic_id = None
                            st.rerun()
                        if st.button(f"🗑️ Delete", key=f"delete_lesson_{lesson[0]}"):
                            delete_lesson(lesson[0])
                            if st.session_state.selected_lesson_id == lesson[0]:
                                st.session_state.selected_lesson_id = None
                            st.success(f"Lesson '{lesson[2]}' deleted!")
                            st.rerun()
        
        # Add New Lesson Form
        st.markdown("---")
        with st.form("add_lesson_form", clear_on_submit=True):
            col1, col2 = st.columns([3, 1])
            with col1:
                lesson_title = st.text_input("Lesson Title *", placeholder="e.g., Introduction to Variables")
            with col2:
                lesson_order = st.number_input("Order", min_value=0, value=0, step=1)
            
            submitted = st.form_submit_button("➕ Add Lesson", use_container_width=True)
            
            if submitted:
                if lesson_title:
                    if add_lesson(st.session_state.selected_course_id, lesson_title, lesson_order):
                        st.success(f"✅ Lesson '{lesson_title}' added!")
                        st.rerun()
                    else:
                        st.error("❌ Lesson with this title already exists in this course!")
                else:
                    st.error("❌ Lesson title is required!")
    else:
        st.warning("Course not found!")
else:
    st.info("👈 Please select a course from the sidebar to view lessons.")

# Main Page Middle - Subtopics Section
if st.session_state.selected_lesson_id:
    st.markdown("<div class='section-header'>📑 Subtopics</div>", unsafe_allow_html=True)
    
    # Get subtopics for selected lesson
    subtopics = get_subtopics(st.session_state.selected_lesson_id)
    
    # Display subtopics
    if subtopics:
        cols = st.columns(3)
        for idx, subtopic in enumerate(subtopics):
            with cols[idx % 3]:
                with st.container():
                    st.markdown(f"**{subtopic[2]}** (Order: {subtopic[4]})")
                    if st.button(f"Select", key=f"select_subtopic_{subtopic[0]}"):
                        st.session_state.selected_subtopic_id = subtopic[0]
                        st.rerun()
                    if st.button(f"🗑️ Delete", key=f"delete_subtopic_{subtopic[0]}"):
                        delete_subtopic(subtopic[0])
                        if st.session_state.selected_subtopic_id == subtopic[0]:
                            st.session_state.selected_subtopic_id = None
                        st.success(f"Subtopic '{subtopic[2]}' deleted!")
                        st.rerun()
    
    # Add New Subtopic Form
    st.markdown("---")
    with st.form("add_subtopic_form", clear_on_submit=True):
        col1, col2 = st.columns([3, 1])
        with col1:
            subtopic_title = st.text_input("Subtopic Title *", placeholder="e.g., Variable Declaration")
        with col2:
            subtopic_order = st.number_input("Order", min_value=0, value=0, step=1, key="subtopic_order")
        
        submitted = st.form_submit_button("➕ Add Subtopic", use_container_width=True)
        
        if submitted:
            if subtopic_title:
                if add_subtopic(st.session_state.selected_lesson_id, subtopic_title, subtopic_order):
                    st.success(f"✅ Subtopic '{subtopic_title}' added!")
                    st.rerun()
                else:
                    st.error("❌ Subtopic with this title already exists in this lesson!")
            else:
                st.error("❌ Subtopic title is required!")
else:
    if st.session_state.selected_course_id:
        st.info("👆 Please select a lesson above to view subtopics.")

# Main Page Bottom - Rich Text Editor
if st.session_state.selected_subtopic_id:
    st.markdown("<div class='section-header'>✏️ Rich Text Editor</div>", unsafe_allow_html=True)
    
    # Get subtopic details
    subtopic = get_subtopic(st.session_state.selected_subtopic_id)
    
    if subtopic:
        st.markdown(f"**Editing:** {subtopic[2]}")
        
        # Rich Text Editor with streamlit-quill
        # Configure toolbar options
        toolbar_options = [
            ['bold', 'italic', 'underline'],
            ['blockquote', 'code-block'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'script': 'sub'}, { 'script': 'super' }],
            [{ 'indent': '-1'}, { 'indent': '+1' }],
            [{ 'header': [1, 2, 3, 4, 5, 6, False] }],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'font': [] }],
            [{ 'align': [] }],
            ['clean']
        ]
        
        # Get current content or empty string
        current_content = subtopic[3] if subtopic[3] else ""
        
        # Rich text editor
        content = st_quill(
            value=current_content,
            html=True,
            toolbar=toolbar_options,
            key=f"editor_{subtopic[0]}",
            height=400
        )
        
        # Save button
        col1, col2 = st.columns([1, 4])
        with col1:
            if st.button("💾 Save Content", use_container_width=True, type="primary"):
                update_subtopic_content(st.session_state.selected_subtopic_id, content)
                st.success("✅ Content saved successfully!")
                st.rerun()
        
        # Display current content preview
        if content:
            st.markdown("---")
            st.markdown("### Preview:")
            st.markdown(content, unsafe_allow_html=True)
    else:
        st.error("Subtopic not found!")
else:
    if st.session_state.selected_lesson_id:
        st.info("👆 Please select a subtopic above to edit content.")
    elif st.session_state.selected_course_id:
        st.info("👆 Please select a lesson to manage subtopics.")

