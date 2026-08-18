# LPU Events — Super Admin & Event Organizer Portal

The administrative control center for **LPU Events** — manage events, review submissions, publish notices, oversee sponsorships & advertisements, configure Happening Today marquees, and dispatch outbox notifications.

## 🚀 Features

- **Event Lifecycle Management**: Draft, review, approve, publish, edit, and cancel campus events.
- **Role-Based Access**: Multi-tier admin roles (Department Organizers, Club Admins, Super Admins).
- **Advertisements & Sponsor Control**: Upload and manage active banners and sponsor tiers.
- **Happening Today Configurator**: Configure daily highlighted events and alerts.
- **Outbox Worker**: Built-in background worker for asynchronous email notifications and system outbox processing.
- **Auditing & Telemetry**: Integrated action logging, PostHog, Sentry, and Microsoft Clarity masking.

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Google Material Symbols & Fonts
- **State & Data**: Supabase Client + Row-Level Security (RLS)
- **Icons**: Lucide React + Material Symbols Outlined
- **Worker**: TypeScript Background Worker (`scripts/outbox_worker.ts`)

## 📦 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- npm or pnpm

### 2. Installation
```bash
git clone https://github.com/narnoliapramod561-stack/lpu-events-admin.git
cd lpu-events-admin
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update `.env` with your Supabase credentials:
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key # For outbox worker
```

### 4. Development Server
```bash
npm run dev
```
The Admin Portal will run at `http://localhost:3001`.

### 5. Running the Notification / Outbox Worker
```bash
npm run worker:outbox
# Or to run as a continuous loop:
npm run worker:email
```

### 6. Production Build
```bash
npm run build
npm run preview
```

## 🗄️ Database & Schema
The `supabase/` directory contains all SQL migrations, seed data, and schema definitions for running the backend locally or deploying to Supabase.
