Django backend for ROPA project

This folder contains a starter Django project using MySQL for the database and JWT authentication.

To run locally:
- Create a Python virtualenv and install requirements
- Configure MySQL database credentials in .env or settings
- Run migrations and create superuser

I will generate the project files and essential apps next.

## Hybrid Similarity (Local + Winston AI)

The similarity endpoint now supports hybrid scoring:

- Local cosine similarity over existing project metadata
- Optional Winston AI score (when API key is configured)
- Final score uses `40% local + 60% Winston` when Winston is available

### Environment variables

Set these in `backend/backend_project/.env`:

- `WINSTON_AI_API_KEY=your_winston_api_key`
- `WINSTON_AI_API_URL=https://api.gowinston.ai/v2/plagiarism` (optional override)

If `WINSTON_AI_API_KEY` is missing, the API automatically falls back to local-only similarity.

### Endpoint

- `POST /api/check-similarity/`
- Accepts file upload (`pdf`/`docx`) and/or `title_text` + `abstract_text`
- Returns `similarity_score`, `top_matches`, `method`, `components`, and Winston status fields
