# 🏏 CricGenius Scorer - Feature Documentation

CricGenius Scorer is a high-performance, mobile-first cricket scoring application designed for precision and ease of use. Below is a comprehensive list of all technical and functional features integrated into the current system.

## 🚀 Core Scoring Capabilities
- **Real-time Innings Tracking**: Dynamic management of runs, wickets, and overs with instantaneous UI updates.
- **Accurate Over Management**: 
    - Full support for partial overs (e.g., 0.3, 1.4).
    - Automatic over completion detection with strike rotation.
    - Automatic prompts for bowler changes at the end of every over.
- **Sophisticated Extra Handling**: 
    - Dedicated input modes for **WIDE**, **NO_BALL**, **BYE**, and **LEG_BYE**.
    - **Intelligent Extra-Runs Modal**: Selecting WIDE or NO_BALL triggers a secondary window to record boundary runs or additional runs taken.
    - Accurate accounting: Wides and No Balls correctly increment the total score and penalize the bowler WITHOUT incrementing the balls-faced count for the batter.
- **Advanced Maiden Logic**: Maiden overs are calculated based on runs off the bat only. Extras (Wides, No Balls, Byes, Leg-Byes) do not prevent a maiden, ensuring statistical accuracy.
- **Precision Roster Setup**:
    - **11-Row Focus View**: The squad input area is calibrated to show exactly 11 players at a time, providing a clear visual confirmation of a full team.
    - **Smart-Sorting on Blur**: Squad lists are automatically cleaned, deduplicated, and alphabetized whenever you stop typing, keeping the pre-match setup professional and organized.
    - **Cursor-Skip Protection**: Advanced input logic prevents annoying cursor jumps during name entry, allowing for rapid and accurate roster builds.

- **Live-Management Cockpit**: 
    - **Mid-Match Renaming**: Instantly fix typos in team names or active player names (Batter/Bowler) by clicking directly on the name in the header or cockpit.
    - **Dynamic Squad Expansion**: Missing a player? Use the **'+ ADD NEW PLAYER'** button within the selection modals to add new players to the squad on the fly without interrupting the match flow.
    - **In-Modal Squad Editing**: Every player in the selection list features an **Edit (✏️)** shortcut for rapid data correction.
- **Wicket Complexity**: Supports multiple dismissal types including Bowled, Caught, LBW, Run Out, and Stumped.
    - **Fielder Tracking**: Automatic prompt for fielder selection on Caught, Stumped, and Run Out dismissals.

- **Ergonomic Single-Page Viewport**:
    - **Zero-Scroll Mandate**: The entire scoring interface (Scoreboard, Commentary, Cockpit, and Keypad) fits perfectly within a single screen, eliminating vertical scrolling and keeping all critical actions at your fingertips.
    - **High-Density Layout**: Optimized spacing and tactile button scaling provide a professional broadcast aesthetic while maximizing operational speed.
    - **Safe Area Support**: Bottom controls respect modern smartphone navigation zones and feature minimized whitespace for better density.
- **Integrated Match Intelligence**:
    - **Run Rate Analytics**: Real-time display of Current Run Rate (CRR) and Required Run Rate (RRR).
    - **Target Chase Equation**: Dynamic display of "Runs needed in XX balls" during the second innings.
- **Full Digital Scorecard**: A comprehensive modal displaying detailed batting stats (4s, 6s, SR) and bowling figures (O, M, R, W, Econ).
- **UI Safety & Security**: The **'Match Cancel'** reset functionality is securely tucked inside the Scoreboard modal to prevent accidental data loss during intense scoring.

## ⚙️ Match Intelligence
- **Configurable Match Length**: Defaulted to **15 overs**, but fully adjustable during setup (1-50 overs).
- **Target Logic**: Automatic calculation of targets after the 1st innings, with victory detection and summary screens.
- **Innings Transition**: Seamless flip from 1st to 2nd innings with team role swapping and data persistence.

## 🛠 Technical Architecture
- **Framework**: Built with **React 19** and **TypeScript** for Type-safety.
- **Styling**: **Tailwind CSS** (via CDN) for high-performance, utility-first styling.
- **Persistence**: Match state is automatically mirrored to `localStorage`, allowing for safe page refreshes without data loss.
- **No-Database Lightweight**: Runs entirely in the client-side browser, making it incredibly fast and deployment-ready via simple static hosting.
