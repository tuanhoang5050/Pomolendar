# Pomolendar - Smart Pomodoro & Auto-Scheduling System

Pomolendar is a comprehensive time management and task scheduling application designed to optimize user productivity. It integrates the Pomodoro technique, a dual-metric gamification economy, and an automated scheduling engine. The system operates on a Client-Server architecture utilizing Django REST Framework for the backend and React Native for the frontend.

## Repository Structure & Module Explanations

The repository is divided into two main directories: the backend API and the frontend mobile application.

### Backend (pomolendarapis/)
Built with Python and Django REST Framework, this directory contains the core business logic, database models, and RESTful API endpoints.
* **accounts/**: Manages user authentication (JWT-based), Google OAuth integration, password recovery via OTP, and user profile data.
* **planner/**: The core productivity engine. It handles CRUD operations for Tasks and Fixed Events, contains the auto-scheduling algorithm (utilizing Max-Heap and Fractional Bin Packing concepts), and logs Pomodoro focus sessions.
* **gamification/**: Manages the application's economy. It tracks Knowledge Points for permanent level progression (Bookshelf) and virtual currency (Coins) for purchasing items in the Store. It also powers the Global Leaderboard API.
* **teams/**: Facilitates study groups. It manages group creation, invite code validation, real-time focus status synchronization across members, and group-specific leaderboards.

### Frontend (pomolendarapp/)
Built with React Native and Expo, styled with Tailwind CSS (NativeWind).
* **src/**: Contains the main React Native source code, including screens (Bookshelf, Leaderboard, Calendar), reusable UI components, API service configurations (Axios), and navigation routing.
* **assets/**: Stores static files such as images, icons, and custom fonts.
* **App.js**: The main entry point of the mobile application handling navigation containers and global state providers.

## Tech Stack

* **Backend:** Python, Django, Django REST Framework, MySQL, Cloudinary
* **Frontend:** React Native, Expo, Tailwind CSS, Axios, React Navigation

## Installation & Local Setup

### Prerequisites
* Python 3.10+
* Node.js 18+
* Expo CLI

### 1. Backend Setup
Navigate to the backend directory and set up the Python environment:
```bash
```bash
cd pomolendarapis
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

```

Create a **`.env`** file in the **`pomolendarapis`** directory with your database credentials, Cloudinary keys, and Django secret key, then run the server:

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py runserver

```

The API will be available at **`http://localhost:8000`**.

**2. Frontend Setup**

```bash
cd pomolendarapp
npm install

```

Update your API base URL in **`src/services/api.js`** to point to your local backend IP address, then start the application:

```bash
npx expo run:android

```

*(Use your Android virtual device or USB Debugging)*

**Usage Guide**

* **Authentication:** Create an account via email or Google OAuth. First-time daily logins reward you with bonus Knowledge Points.
* **Task Planning & Auto-Scheduling:** Add your Fixed Events and Tasks. Press the **"Auto-Schedule"** button to allow the Heuristic algorithm to arrange your tasks into your available free time slots.
* **Focus Sessions:** Tap on a scheduled task to start a Pomodoro timer. The app activates Deep Focus mode. Completing a session rewards you with Knowledge Points (for leveling up) and Coins (for store purchases).
* **Gamification & Customization:** Visit the Bookshelf to view your accumulated levels. Use the Store to spend Coins on custom animations or ambient sounds. View your ranking against other users on the Global Leaderboard.
* **Study Groups:** Create a private group or join an existing one using an invite code. When you start a focus session, your status instantly updates to **"Focusing"** for all other group members.

**Credits & Acknowledgements**

This project was built upon the foundation of various open-source technologies and drew inspiration from several outstanding productivity platforms:

* **Application Inspiration:** The core time-management mechanics, gamification concepts, and UI/UX design were heavily inspired by existing productivity applications, notably **Strive** and **Focus To-Do**.
* **Visual Assets:** The vector animations used within the gamification store and the focus timer interfaces are sourced from **LottieFiles** (lottiefiles.com).
* **Open Source Community:** Special thanks to the maintainers of **React Native**, **Expo**, **Django**, and the developers of the numerous open-source libraries that made this system possible.
