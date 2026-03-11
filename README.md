# 🌌 SmartDesk: AI-Powered Support Ecosystem for Intelligent Resource Management

**SmartDesk** is a next-generation Ticket Management System (TMS) designed to bridge the gap between high-volume support demands and agent wellbeing. Unlike traditional ticketing tools that rely on static, "Round-Robin" assignment, SmartDesk uses a **Workload-Aware Routing Engine** and **Real-Time Sentiment Analysis** to ensure every issue is handled by the right person, at the right time, with the right emotional context.

---

## 🚀 The "Agent-First" Vision
SmartDesk is built on the philosophy that enterprise software should be a **Calm Sentinel**, not a source of stress.

*   **Proactive:** The system automatically identifies "Frustrated" customers before an agent even opens the ticket.
*   **Balanced:** No agent is ever "overloaded" while others are idle; the routing engine dynamically balances the burden based on live utility.
*   **Aesthetically Refined:** Leveraging a compact, pastel-based "Apple-style" design system to reduce cognitive load and visual noise during high-pressure shifts.

---

## ✨ Key Features

### ⚖️ 1. Workload-Aware Routing Engine
The heart of SmartDesk. It doesn't just pass tickets to the "next" person. It query-analyzes the live database for active ticket counts across all agents and dynamically assigns new incoming tasks to the individual with the **absolute lowest current burden**.

### 🧠 2. AI Sentiment & Urgency Detection
Powered by **Llama 3 (via Groq API)**, every ticket description is analyzed upon submission.
*   **Emotional Pulse:** Categorizes customer mood as *Satisfied, Neutral, or Frustrated*.
*   **Auto-Priority:** Suggests impact levels (Low, Medium, High) based on linguistic markers of urgency, ensuring mission-critical issues never sit in the queue.

### ✍️ 3. Context-Aware AI Drafting
Eliminate "Template Fatigue." With the **AI Draft** feature, agents can generate professional, personalized, and empathetic responses in seconds. The LLM reads the entire conversation history to provide a draft that feels human and contextually accurate.

### ⏱️ 4. Real-Time SLA Monitoring
A background "Pulse" worker monitors every ticket's lifecycle.
*   **Visual Badges:** Tickets are marked with "SLA Breached" alerts the moment a deadline passes.
*   **Automatic Escalation:** Immediate SMTP email alerts are dispatched to Admins and assigned Agents when a breach is detected.

### 📊 5. The "Pulse" Analytics Dashboard
A dedicated Admin command center featuring:
*   **Traffic Overview:** Real-time line charts showing ticket volume trends.
*   **Agent Utility Map:** Visual breakdown of current ticket distribution.
*   **SLA Compliance Tracking:** High-level metrics on resolved vs. breached performance.

### 🎨 6. Compact Design System
A custom **Pure CSS** architecture built on a 4px grid.
*   **Minimalist Aesthetic:** Subtle glassmorphism, pastel accents (#AFCBFF), and thin-line iconography.
*   **Efficiency-Focused:** 12-14px typography designed for fast scanning of metadata without visual clutter.

---

## 🧠 AI Model Engine & Architecture
SmartDesk utilizes a high-performance **Transformer-based Pipeline** to ensure near-zero latency in intelligence processing.

1. **Sentiment Kernel (The Triage Engine)**
   *   **Model:** Llama 3 70B (via Groq Cloud)
   *   **Role:** Analyzes raw customer text to extract emotional state and urgency scores.
   *   **Latency:** ~200ms for real-time priority suggestions.

2. **Generative Draft Kernel (The Response Engine)**
   *   **Model:** Llama 3 8B (Optimized for Dialogue)
   *   **Role:** Performs "Zero-Shot" response drafting by ingesting the full ticket JSON object and conversation history.

---

## 🛠️ Installation & Local Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Supriyadasari04/Ticket-Management-System.git
cd Ticket-Management-System/backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the `backend` folder:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key
GROQ_API_KEY=your_groq_inference_key
SMTP_USER=your_alerts_email@domain.com
SMTP_PASS=your_email_app_password
```

### 4. Run the Development Server
```bash
npm start
```
The application will be live locally. Open `html/landing_page.html` to enter the portal.

---

## 🗄️ Database Schema (Supabase)
SmartDesk manages complex enterprise relationships with a streamlined PostgreSQL schema:

*   **users:** Managed roles (admin, agent, customer) with JWT authentication.
*   **tickets:** Central data store for TKT-IDs, impact, SLA deadlines, and AI sentiment fields.
*   **ticket_comments:** Persisted conversation threads for audit-ready transparency.
*   **ticket_activity:** Automated "Audit Trail" tracking every status change and assignment.
*   **feedback:** Customer satisfaction (CSAT) ratings and post-resolution logs.

---

## 🤝 Contributors & License
*   **Lead Developer:** Aditya (Aditya Project Collection)
*   **Design Philosophy:** Apple Human Interface Standard (Compact/Pastel)
*   **License:** MIT License

**SmartDesk — Because enterprise support deserves an intelligent heart.**
