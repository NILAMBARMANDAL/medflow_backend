# MedFlow — Backend

A REST API for a medical appointment platform, built with Node.js, Express, and MongoDB. MedFlow connects patients with verified doctors: patients book appointments and manage their medical records, doctors manage consultations and issue digital prescriptions, and admins verify doctor credentials before they go live.

This repository is the backend (API server). The frontend lives in a separate repository: [medflow_frontend](https://github.com/NILAMBARMANDAL/medflow_frontend).

## Tech Stack

- **Runtime:** Node.js (ES Modules)
- **Framework:** Express 5
- **Database:** MongoDB with Mongoose (ODM)
- **Authentication:** JWT (access + refresh tokens) stored in httpOnly cookies
- **Password security:** bcrypt hashing
- **File storage:** Cloudinary (avatars, certificates, medical documents)
- **File uploads:** Multer (multipart/form-data handling)

## Core Features

### Authentication & Authorization
- **JWT access + refresh token strategy.** Short-lived access tokens are sent on every request; a long-lived refresh token, stored server-side, silently issues new access tokens without forcing re-login. Logout revokes the refresh token in the database.
- **Secure token storage.** Tokens are delivered as `httpOnly`, `secure` cookies, mitigating XSS-based token theft and enforcing HTTPS-only transmission.
- **Passwords are never stored in plain text** — hashed with bcrypt via a Mongoose pre-save hook (with a guard that avoids re-hashing on unrelated updates).
- **Three tiers of authorization:**
  - *Role-based* — patient / doctor / admin permissions.
  - *Ownership-based* — e.g. a doctor can only modify appointments assigned to them.
  - *Relationship-based* — a doctor can only view the medical records of patients who have booked an appointment with them.

### Appointments
- Patients book appointments with verified doctors.
- **Double-booking prevention** via a unique partial database index on `(doctor, appointmentDate)` for active appointments, making the constraint atomic and race-condition-safe — the database rejects concurrent double-bookings rather than relying on a check-then-act pattern.
- Doctors approve, cancel, or complete appointments. Completing an appointment requires prescription notes and automatically generates a medical record for the patient.

### Doctor Profiles & Verification
- Doctors submit profiles with specialization, fees, qualifications, availability, and a registration certificate (uploaded to Cloudinary).
- Admins review and approve/reject doctor verification; rejection cleanly reverts the account.
- **Analytics dashboard** powered by a MongoDB aggregation pipeline that computes total consultations, unique patients, and total earnings per doctor in a single query.

### Medical Records & Reviews
- Patients maintain a personal medical-record locker with multi-file attachments.
- Patients can review a doctor only after a *completed* appointment, one review per appointment. Submitting a review automatically recalculates the doctor's average rating via a Mongoose post-save hook + aggregation.

## Architecture

The codebase follows a layered structure with clear separation of concerns:

```
src/
├── controllers/    # Business logic for each resource
├── models/         # Mongoose schemas (data layer)
├── routes/         # URL-to-controller mapping, versioned under /api/v1
├── middlewares/    # JWT auth verification, file-upload handling
├── utils/          # asyncHandler, ApiError, ApiResponse, Cloudinary helper
├── db/             # Database connection
├── app.js          # Express app configuration (middleware, routes, error handler)
└── index.js        # Server bootstrap (connects DB, then starts listening)
```

- **Consistent API responses.** All responses use a standard `{ statusCode, data, message, success }` envelope (`ApiResponse`), and all errors use a custom `ApiError` class carrying the correct HTTP status code, surfaced by a central error-handling middleware.
- **Clean async handling.** An `asyncHandler` higher-order function wraps controllers so errors are forwarded to the error middleware without repetitive try/catch.
- **Versioned API.** All routes are mounted under `/api/v1/` to allow future breaking changes without disrupting existing clients.

## API Overview

Base URL: `/api/v1`

| Resource | Routes |
|----------|--------|
| **Users** | `POST /users/register`, `POST /users/login`, `POST /users/logout`, `POST /users/refresh-token`, `GET /users/current-user`, `GET /users/doctors` (search), `PATCH /users/update-account`, `POST /users/change-password`, `PATCH /users/avatar`, `GET /users/pending-doctors` (admin), `PATCH /users/verify-doctor` (admin) |
| **Appointments** | `POST /appointments/book`, `GET /appointments/my-appointments`, `PATCH /appointments/update-status` |
| **Doctor Profiles** | `GET /doctor-profiles/profile`, `POST /doctor-profiles/profile`, `GET /doctor-profiles/analytics` |
| **Medical Records** | `POST /medical-records/upload`, `GET /medical-records/timeline`, `GET /medical-records/patient/:patientId` (doctor) |
| **Reviews** | `POST /reviews/add`, `GET /reviews/doctor/:doctorId` |

Protected routes require a valid access token (sent automatically via httpOnly cookie).

## Getting Started

### Prerequisites
- Node.js (v18+)
- A MongoDB database (e.g. MongoDB Atlas)
- A Cloudinary account (for file uploads)

### Installation

```bash
# Clone the repository
git clone https://github.com/NILAMBARMANDAL/medflow_backend.git
cd medflow_backend

# Install dependencies
npm install

# Create a .env file (see .env.example for the required variables)
cp .env.example .env
# then fill in your own values

# Start the development server
npm run dev
```

The server runs on `http://localhost:8000` by default.

### Environment Variables

See `.env.example` for the full list. You will need to provide your own MongoDB URI, JWT secrets, Cloudinary credentials, and CORS origin.

## Notes & Future Work

- The booking model currently uses exact-datetime slots; a production version would support configurable time-window slots.
- Planned: rate limiting on auth endpoints and schema-level request validation.

---

Built by Nilambar Mandal.