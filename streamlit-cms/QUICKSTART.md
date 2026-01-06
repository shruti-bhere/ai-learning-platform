# Streamlit CMS Quick Start Guide

## 🚀 Quick Start

### Option 1: Run Locally (Recommended for Development)

1. **Install dependencies:**
```bash
cd streamlit-cms
pip install -r requirements.txt
```

2. **Run the app:**
```bash
streamlit run app.py
```

Or use the convenience script:
```bash
./run.sh
```

3. **Open browser:** http://localhost:8501

### Option 2: Run with Docker

1. **Start the Streamlit CMS service:**
```bash
# From project root
docker compose up -d streamlit-cms
```

2. **View logs:**
```bash
docker compose logs -f streamlit-cms
```

3. **Open browser:** http://localhost:8501

### Option 3: Build and Run Standalone Docker Container

1. **Build the image:**
```bash
cd streamlit-cms
docker build -t streamlit-cms .
```

2. **Run the container:**
```bash
docker run -p 8501:8501 -v $(pwd):/app streamlit-cms
```

3. **Open browser:** http://localhost:8501

## 📋 Usage Workflow

1. **Sidebar**: Select or create a course
2. **Main Page Top**: Once a course is selected, you'll see its lessons. Add/delete lessons here.
3. **Main Page Middle**: Select a lesson to see its subtopics. Add/delete subtopics here.
4. **Main Page Bottom**: Select a subtopic to open the rich text editor. Edit and save content.

## 🎨 Rich Text Editor Features

The editor supports:
- **Bold**, *Italic*, <u>Underline</u>
- Lists (Ordered & Bulleted)
- Code blocks
- Headers (H1-H6)
- Text color & Background highlighting
- Font selection
- Text alignment
- Blockquotes
- Subscript & Superscript
- Indentation

## 🗄️ Database

The SQLite database (`cms.db`) is created automatically in the `streamlit-cms` directory. It persists your data between sessions.

## 🔧 Troubleshooting

### Package Installation Issues

If `streamlit-quill` installation fails, try:
```bash
pip install streamlit-quill --upgrade
```

If it still fails, you can use an alternative:
```bash
pip install streamlit-ace-editor
```
Then modify `app.py` to use the alternative editor.

### Port Already in Use

If port 8501 is already in use:
```bash
# Kill the process
lsof -ti:8501 | xargs kill -9

# Or use a different port
streamlit run app.py --server.port=8502
```

### Docker Issues

If the container fails to start:
```bash
# Check logs
docker compose logs streamlit-cms

# Rebuild
docker compose build streamlit-cms
docker compose up -d streamlit-cms
```

## 📝 Notes

- The database file is stored in the `streamlit-cms` directory
- All deletions cascade (deleting a course deletes its lessons and subtopics)
- Rich text content is stored as HTML
- Content preview is shown below the editor

