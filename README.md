# Frustration → Tasks App

A web application that transforms unstructured frustrations into actionable task lists, designed for different energy states.

## Features

### Dual Interface Design

- **Vent Mode**: Low-energy interface for expressing frustrations freely
- **Action Mode**: High-energy interface for managing and completing tasks

### Intelligent Text Processing

The app uses pattern recognition to identify common frustration types and convert them into actionable tasks:

- **Learning gaps**: "I can't do X" → "Learn how to do X"
- **Action items**: "I need to/should/must do X" → Prioritized tasks
- **Problem areas**: "I'm frustrated with X" → "Address issues with X"
- **Complexity issues**: "It's too hard to X" → "Simplify X"
- **Memory issues**: "I keep forgetting X" → "Set up reminder for X"

### Task Management

- Task completion tracking with checkboxes
- Priority levels (High/Medium/Low) with color coding
- Categories (Learning, Action, Problem Solving, etc.)
- Filter tasks by status (All/Pending/Completed)
- Progress statistics and completion rates

### Local Storage

- Automatic saving of all data in browser storage
- Recent vents history (last 10 entries)
- Auto-save of current input while typing
- Export functionality for backup

## How to Use

1. **Open `index.html` in your browser**

2. **In Vent Mode (Low Energy)**:

   - Write freely about what's bothering you
   - No structure needed - just brain dump
   - Click "Transform into Tasks" to process
   - Recent vents are saved and clickable to reload

3. **In Action Mode (High Energy)**:
   - View generated tasks with priorities
   - Check off completed tasks
   - Filter by completion status
   - Track your progress with stats
   - Export your data when needed

## Example Transformations

**Input**: "I'm so frustrated with my messy desk and I can't find anything. I need to organize it but it's too overwhelming and I keep forgetting to clean it up."

**Generated Tasks**:

- Address issues with messy desk (HIGH priority)
- Organize it (MEDIUM priority)
- Simplify this process (MEDIUM priority)
- Set up reminder for clean it up (MEDIUM priority)

## Technical Details

- Pure HTML/CSS/JavaScript (no dependencies)
- Responsive design for mobile and desktop
- Uses CSS Grid and Flexbox for layout
- Local storage for data persistence
- Pattern matching with regex for text analysis

## Browser Compatibility

Works in all modern browsers that support:

- ES6+ JavaScript features
- CSS Grid and Flexbox
- Local Storage API

Just open `index.html` in your browser to start using the app!
