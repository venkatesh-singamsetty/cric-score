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

## 👥 Player & Team Management
- **Automatic Roster Sorting**: Whether using the default squad or custom entries, player lists are automatically sorted alphabetically upon match start.
- **Persistent Global Uppercase**: All team names and player names are automatically normalized to uppercase for a consistent, professional look.
- **Dynamic Strike Management**: 
    - Automatic strike rotation based on odd/even runs.
    - Manual **'Swap Ends'** functionality for mid-over tactical changes or corrections.
- **Interactive Player Selection**: 
    - Dedicated modals for selecting the next batter after a wicket.
    - Ability to switch bowlers at any point via the dedicated **'Change Bowler'** action.
- **Wicket Complexity**: Supports multiple dismissal types including Bowled, Caught, LBW, Run Out, and Stumped.
    - **Fielder Tracking**: Automatic prompt for fielder selection on Caught, Stumped, and Run Out dismissals.

## 📱 User Experience & Interface
- **Responsive Mobile-First Design**:
    - **Thumb-Optimized Keypad**: Scoring controls are pinned to the bottom for effortless one-handed use.
    - **Safe Area Support**: Bottom controls respect modern smartphone navigation zones.
- **Interactive Dashboard**:
    - **Live Commentary**: Auto-scrolling, human-readable commentary for every delivery (e.g., "SUNIL to RAJU, FOUR! Beautifully played.").
    - **Run Rate Analytics**: Real-time display of Current Run Rate (CRR) and Required Run Rate (RRR) for second innings.
    - **Target Chase Equation**: Dynamic display of "Runs needed in XX balls" during the second innings.
- **Full Digital Scorecard**: A comprehensive modal displaying detailed batting stats (4s, 6s, SR) and bowling figures (O, M, R, W, Econ) for both current and previous innings.
- **Multi-Level Undo**: Deep state history tracking allows for reversing any scoring mistake ball-by-ball.

## ⚙️ Match Intelligence
- **Configurable Match Length**: Defaulted to **15 overs**, but fully adjustable during setup (1-50 overs).
- **Target Logic**: Automatic calculation of targets after the 1st innings, with victory detection and summary screens.
- **Innings Transition**: Seamless flip from 1st to 2nd innings with team role swapping and data persistence.

## 🛠 Technical Architecture
- **Framework**: Built with **React 19** and **TypeScript** for Type-safety.
- **Styling**: **Tailwind CSS** (via CDN) for high-performance, utility-first styling.
- **Icons & Visuals**: Accessible emoji-based iconography (🏏, 🎾, 🚶, 🏆) integrated into the design.
- **No-Database Lightweight**: Runs entirely in the client-side browser, making it incredibly fast and deployment-ready via simple static hosting (AWS S3, Vercel, etc.).
