#Investment Purchase Tracker | Full-Stack Web App

# a secure, multi-user investment tracking web application using JavaScript (Node.js/Express) and SQLite

# Implements user authentication with Argon2id password hashing, secure session cookies, and CSRF protection to ensure strict data privacy and authorization.

#I designed a relational database schema with parameterized queries to prevent SQL injection and maintain persistent records and built a responsive frontend interface with dynamic form handling, asynchronous API requests (fetch), and robust server-side input validation.# Investment Purchase Tracker - PA2

#below are class instructions with my solutions and implementations

## Part 1: Add Purchase Action Flow
1. **Browser Event**: The user submits the purchase form; JavaScript intercepts the submission via `submit` event listener and calls `event.preventDefault()`.
2. **JSON Request**: The `api()` helper sends an HTTP `POST` request to `/api/purchases` with a JSON body and `X-CSRF-Token` header.
3. **Middleware**: Express parses the JSON body, session cookie authentication checks user login status, and the CSRF middleware validates the request origin and CSRF token.
4. **Route**: The `/api/purchases` route handler receives the request, runs server-side validation on the input fields, and extracts the authenticated `owner_id` from `req.session.userId`.
5. **SQL Statement**: A parameterized prepared SQLite statement (`INSERT INTO purchases ...`) safely writes the record without SQL injection risks.
6. **JSON Response**: The server queries the newly created record with a SQL `JOIN` across categories and returns `201 Created` with the complete record JSON.
7. **UI Refresh**: The client receives the response, reloads the authoritative purchase list from the server, clears inputs, and re-renders the summary and history.
 
## Runtime Roles
- **Node.js**: The JavaScript runtime environment executing server-side logic and managing network sockets.
- **npm**: The package manager used to install third-party dependencies (Express, better-sqlite3, argon2, dotenv, express-session).
- **package-lock.json**: Records the exact tree versions of installed dependencies to guarantee reproducible builds across environments.

## Asynchronous Execution (`async/await`)
`async/await` allows JavaScript to pause execution of an asynchronous function while waiting for I/O promises (such as network `fetch` calls) to resolve. Because JavaScript is single-threaded, this non-blocking design prevents network latency from freezing the entire Node.js server thread, enabling concurrent request handling.

## Part 2: Database Schema & NoSQL Comparison
- **Primary Key (`id`)**: Uniquely identifies each record in a table, ensuring fast indexed lookups and referential integrity.
- **Foreign-Key Relationships (`owner_id` & `category_id`)**: Link purchases to specific users and categories, enforcing referential integrity so orphan records cannot exist.
- **CHECK Constraints**: Ensure data validity at the database engine level (e.g., quantity between 1 and 10,000, non-empty trimmed names).
- **Relational vs. NoSQL (Document-Style)**: Relational databases store structured tabular data across normalized tables with strict schema enforcement and atomic transactions (ACID). Document-style NoSQL stores hierarchical JSON-like collections where related data (such as categories and user accounts) may be embedded inside document trees. Relational storage fits this application well due to strict relational constraints, foreign keys, and normalized categories.

## Part 6: Authentication vs. Authorization & Validation
- **Authentication vs. Authorization**: Authentication verifies *who* the user is (e.g., logging in with email and password to establish a session). Authorization determines *what* resources that user is allowed to access (e.g., the two-user test ensures User A can never view, edit, or delete User B's purchases).
- **Client-Side vs. Server-Side Validation**: Client-side validation improves user experience by giving instant feedback, but can easily be bypassed using API tools like Postman or `curl`. Server-side validation is authoritative and mandatory for security and data integrity.
