# Streamlit Course Management System (CMS)

A Level 3 Hierarchy CMS with Rich Text capabilities built with Streamlit.

## Hierarchy Structure

```
Courses
  └── Lessons
      └── Subtopics (with Rich Text Content)
```

## Features

- ✅ **SQLite Database**: Persistent storage with proper relationships
- ✅ **Level 3 Hierarchy**: Courses → Lessons → Subtopics
- ✅ **Rich Text Editor**: WYSIWYG editor with formatting options
- ✅ **CRUD Operations**: Add, Delete for all levels
- ✅ **Docker Support**: Runs in containerized environment

## Database Schema

### Table 1: Courses
- `id` (PRIMARY KEY)
- `name` (UNIQUE)
- `description`
- `icon`
- `created_at`

### Table 2: Lessons
- `id` (PRIMARY KEY)
- `course_id` (FOREIGN KEY)
- `title`
- `order_index`
- `created_at`

### Table 3: Subtopics
- `id` (PRIMARY KEY)
- `lesson_id` (FOREIGN KEY)
- `title`
- `content` (Rich Text HTML)
- `order_index`
- `created_at`

## Rich Text Editor Features

The editor supports:
- **Bold**, **Italic**, Underline
- Lists (Ordered & Bulleted)
- Code blocks
- Headers (H1-H6)
- Text color & Background color
- Font selection
- Text alignment
- Blockquotes
- Subscript & Superscript
- Indentation

## Installation

### Local Development

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the app:
```bash
streamlit run app.py
```

3. Open browser: http://localhost:8501

### Docker

1. Build the image:
```bash
docker build -t streamlit-cms .
```

2. Run the container:
```bash
docker run -p 8501:8501 -v $(pwd)/cms.db:/app/cms.db streamlit-cms
```

3. Open browser: http://localhost:8501

## Usage

1. **Select or Add Course**: Use the sidebar to choose a course or create a new one
2. **Manage Lessons**: Once a course is selected, add/delete lessons in the main page
3. **Manage Subtopics**: Select a lesson to add/delete subtopics
4. **Edit Content**: Select a subtopic to open the rich text editor
5. **Save**: Click "Save Content" to persist your changes

## File Structure

```
streamlit-cms/
├── app.py              # Main Streamlit application
├── requirements.txt    # Python dependencies
├── Dockerfile          # Docker configuration
├── .dockerignore      # Docker ignore file
├── README.md          # This file
└── cms.db             # SQLite database (created automatically)
```

## Notes

- The database file (`cms.db`) is created automatically on first run
- All deletions cascade properly (deleting a course deletes its lessons and subtopics)
- The rich text content is stored as HTML in the database
- Content preview is shown below the editor

