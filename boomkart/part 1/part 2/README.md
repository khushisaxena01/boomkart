## Boom Kart – Web-Based 3D Multiplayer Racing Game

A browser-based 3D racing experience built with WebGL, Three.js, and real-time WebRTC multiplayer.

Boom Kart is a fully interactive 3D multiplayer racing game that runs directly in the browser — no downloads, no installations, no plugins required. Built using Three.js, PeerJS, WebRTC, and modern HTML5 APIs, it delivers a complete arcade-style racing experience with smooth physics, responsive controls, dynamic effects, and peer-to-peer multiplayer.

This project was developed as part of the Major Project for B.Tech CSE (KIIT University, 2025–2026).

## Features
### Core Gameplay

3D kart racing with smooth, frame-rate–independent physics

Six unique race tracks with themed visuals

1–3 lap race modes

Kart selection & difficulty customization

Accurate lap counting, timing system, and checkpoint validation

Power-ups, boost pads, mud zones & obstacles

👥 Multiplayer (WebRTC Peer-to-Peer)

Host–Guest architecture using 4-digit room codes

Real-time synchronization of position, angle, speed & race status

Low-latency networking using PeerJS

No server required — direct peer-to-peer gameplay

🌟 Visual & Audio Effects

Dynamic particle effects (dust trails, sparks, power-up bursts, weather)

Day–night lighting cycle

Spatial audio using Howler.js

Smooth camera follow system

Responsive UI styled for desktop & mobile

📊 Leaderboards & Progression

Local leaderboard with best lap & total time tracking

Track-wise high scores

Persistent localStorage-based data

🛠️ Technology Stack

Three.js (r128) – 3D rendering

WebGL – GPU-accelerated graphics

PeerJS (WebRTC) – multiplayer P2P networking

Howler.js – cross-browser spatial sound

HTML5 / CSS3 / JavaScript (ES5/ES6)

LocalStorage – persistent leaderboard storage

🧠 System Architecture

Modular, component-based structure:

Presentation Layer – UI, menus, HUD

Game Layer – physics, controls, collisions, particles

Networking Layer – PeerJS/WebRTC

Infrastructure Layer – rendering, audio, storage

🧪 Testing & Performance

Runs smoothly at 45–60 FPS on mid-range devices

Tracks load within 3–5 seconds

Multiplayer sync rate: 100–200 ms update interval

Tested on Chrome, Firefox, Edge, Safari

Mobile-optimized with touch controls

🧩 Future Scope

AI-controlled opponents

Advanced power-ups

4–8 player multiplayer with dedicated servers

New tracks & procedural generation

Track editor

Career mode & cloud-synced leaderboards

Mobile app / PWA support

VR compatibility
