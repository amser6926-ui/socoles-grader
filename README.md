# SOCOLES

SOCOLES is an automated grading system for evaluating SQL statements. It can evaluate Data Query Language (SELECT), Data Definition Language (DDL), and Data Manipulation Language (DML) statements. The system supports 3 types of users:
  - Students
  - Instructors
  - Teaching Assistants 

## ✨ Features
- **DQL, DDL and DML statements**
  Capable of grading DQL(`SELECT`) Queries, DDL statements such as `CREATE`, `ALTER`, `DROP` and DML statements such as `INSERT`, `UPDATE`, `DELETE`.
- **Detailed and constructive feedback**
  Generates feedback at the clause or component level (e.g. pointing out a missing `CASCADE` in a `DROP TABLE`), helping students pinpoint exactly what went wrong. This is possible through the evaluation of each individual clause (e.g. `SELECT`, `FROM`, `WHERE`, `GROUP BY`) in isolation, to generate fine-grained feedback.

- **Query Repair**  
  Auto-corrects minor syntax and semantic mistakes (typos, missing keywords) to help in grading malformed statements.

- **Multiple Submissions**  
  Supports multiple attempts per question, therefore a student a work on an answer until they get it right.

- **Feedback-Linked Manual Review Requests**  
   Allows students to select a specific feedback item or grade and request a manual review when they disagree with the evaluation. Both the teaching assistants and instructors can see these requests.

- **Configurable Grading**  
  Instructors can tune:
  - Which properties to grade (syntax, semantics, results)  
  - Number of outcomes per property  
  - Property priorities  
  - Text/tree-edit distance thresholds



## 🐳 Docker Quick Start

This is the easiest way to get SOCOLES up and running, with PostgreSQL, backend, and frontend all in Docker containers. Make sure you have Docker installed.

### 1. Clone the repo
```bash
git clone https://github.com/berniegach/socoles-grader.git
cd socoles-grader
```

### 2. Create the local environment file
Run:

```bash
cp .env.example .env
```

For a local installation, keep these values in `.env` unchanged, except replace the placeholder passwords and signup code:

```bash
POSTGRES_PASSWORD=choose-a-local-password
SOCOLES_VERSION=1.2.0
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
NEXT_PUBLIC_SOCOLES_API_URL=http://localhost:5000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=choose-a-stable-local-secret
KEYCLOAK_ISSUER=http://keycloak:8080/realms/socoles
KEYCLOAK_ISSUER_PUBLIC=http://localhost:8080/realms/socoles
KEYCLOAK_CLIENT_ID=socoles-frontend
KEYCLOAK_CLIENT_SECRET=change-me
KEYCLOAK_LOGOUT_REDIRECT_URI=http://localhost:3000/
INSTRUCTOR_SIGNUP_CODE=choose-an-instructor-signup-code
```

Do not use the university URL for a local installation. Use `http://localhost:3000` consistently in the browser; do not switch between `localhost` and `127.0.0.1` while signing in.

For a custom HTTPS domain:
```bash
POSTGRES_PASSWORD=your-strong-password
SOCOLES_VERSION=1.2.0
CORS_ORIGINS=https://socoles.example.edu #comma-separated, no spaces
NEXT_PUBLIC_SOCOLES_API_URL=https://socoles.example.edu #what the browser calls
# Internal service URL usually stays as-is for Docker:
SOCOLES_INTERNAL_API_URL=http://backend:5000
```

Notes:
- `NEXT_PUBLIC_SOCOLES_GRADE_PATH` is fixed to `/grade-queries` in `docker-compose.yml` (no need to set it).
- Frontend DB env (PGHOST/PGPORT/PGUSER/PGDATABASE) are defined in `docker-compose.yml` and do not need to be set in `.env`.

### 3. Start everything
```bash
docker compose up -d
```

Wait until the services are running, then verify their status:

```bash
docker compose ps
```

The `db`, `backend`, and `keycloak` services must be running before signing in. If Keycloak is restarting, inspect its startup error:

```bash
docker compose logs --tail=100 keycloak
```

For a fresh local installation where the database was initialized with an earlier configuration, reset the local Docker data and start again. This deletes all local application and Keycloak data:

```bash
docker compose down -v
docker compose up -d
```

### 4. Sign in

Open http://localhost:3000 and select a role. The local Keycloak realm has no predefined users. Select **Register** on the Keycloak login page to create a user.

After signing in as an instructor, enter the `INSTRUCTOR_SIGNUP_CODE` from `.env` to provision the instructor account. Students need to be added to an instructor's course or roster before they can access student work.

Optional: build images locally instead of pulling prebuilt ones:
```bash
docker compose build
docker compose up -d
```

You can now access the webapp at http://localhost:3000 or the custom https://socoles.example.edu



## 📚 Citation

If you use SOCOLES in your research, please cite it as follows:

```bibtex
@software{socoles-autograder,
  author       = {Benard Wanjiru},
  title        = {SOCOLES Grader: An Automated SQL Grading System},
  version      = {v1.2.0},
  url          = {https://github.com/berniegach/socoles-grader},
  year         = {2026},
  month        = {Sep},
  note         = {Accessed: YYYY-MM-DD}
}
```

## Publications

These publications describe the research behind SOCOLES and its grading methodology:

- Wanjiru, B., van Bommel, P., and Hiemstra, D. (2026). *Instant Feedback for SQL Assignments Using Clause-Driven Automated Grading*. In *Proceedings of the 31st ACM Conference on Innovation and Technology in Computer Science Education V. 1 (ITiCSE 2026)*, pp. 576-582. Association for Computing Machinery. https://doi.org/10.1145/3803400.3809341
- Wanjiru, B., van Bommel, P., and Hiemstra, D. (2026). *Clause-Driven Automated Grading of SQL's DDL and DML Statements*. In *Proceedings of the 57th ACM Technical Symposium on Computer Science Education V.1 (SIGCSE TS 2026)*, pp. 1117-1123. Association for Computing Machinery. https://doi.org/10.1145/3770762.3772599
- Wanjiru, B., van Bommel, P., and Hiemstra, D. (2026). *Automated Feedback in Grading: An SQL Clause-Driven Approach*. In K. Daimi and A. Alsadoon (Eds.), *Emerging Trends in Computer Science and Computer Engineering Education*, *Studies in Systems, Decision and Control* (Vol. 672). Springer. https://doi.org/10.1007/978-3-032-23499-5_14
- Wanjiru, B., van Bommel, P., and Hiemstra, D. (2024). *Dynamic and Partial Grading of SQL Queries*. *Journal of Engineering Research and Sciences*, 3(8), 1-14. https://doi.org/10.55708/js0308001
- Wanjiru, B., van Bommel, P., and Hiemstra, D. (2024). *Sensitivity of Automated SQL Grading in Computer Science Courses*. In K. Daimi and A. Al Sadoon (Eds.), *Proceedings of the Third International Conference on Innovations in Computing Research (ICR'24)*, *Lecture Notes in Networks and Systems* (Vol. 1058). Springer. https://doi.org/10.1007/978-3-031-65522-7_26
- Wanjiru, B., van Bommel, P., and Hiemstra, D. (2023). *Towards a Generic Model for Classifying Software into Correctness Levels and its Application to SQL*. In *2023 IEEE/ACM 5th International Workshop on Software Engineering Education for the Next Generation (SEENG)*, pp. 37-40. https://doi.org/10.1109/SEENG59157.2023.00012



