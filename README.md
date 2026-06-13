# HEBG Ministry Backend

This project now has a Node.js backend for admin-only sermon uploads.

## Setup

1. Install Node.js from https://nodejs.org if `node --version` does not work in your terminal.
2. Open this project folder in the terminal.
3. Install dependencies:

```bash
npm install
```

4. Create your private environment file:

```bash
copy .env.example .env
```

5. Open `.env` and change these values:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-admin-password
SESSION_SECRET=use-a-long-random-secret-here
PORT=3000
```

6. Start the website and backend:

```bash
npm start
```

7. Visit these pages:

- Public website: http://localhost:3000/index.html
- Sermons page: http://localhost:3000/sermons.html
- Admin upload page: http://localhost:3000/admin.html

## Upload Types

The admin can upload:

- Audio sermons: `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`
- PDF books or notes: `.pdf`
- Video sermons: `.mp4`, `.webm`, `.ogv`, `.mov`

Uploaded files are stored in `uploads/`, and sermon records are stored in `data/sermons.json`.
