import React, { useState, useEffect } from 'react';
import { InningsState, MatchStatus, TeamData, Player, Bowler } from './types';
import MatchSetup from './components/MatchSetup';
import MatchView from './components/MatchView';

const App: React.FC = () => {
    const [matchStatus, setMatchStatus] = useState<MatchStatus>(MatchStatus.SETUP);
    const [currentInnings, setCurrentInnings] = useState<InningsState | null>(null);
    const [previousInnings, setPreviousInnings] = useState<InningsState | undefined>(undefined);

    // Match Config
    const [teamA, setTeamA] = useState<TeamData | null>(null);
    const [teamB, setTeamB] = useState<TeamData | null>(null);
    const [totalOvers, setTotalOvers] = useState(15);

    // --- Persistence Logic ---
    useEffect(() => {
        const saved = localStorage.getItem('cric-scorer-match-state');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                setMatchStatus(data.matchStatus);
                setTeamA(data.teamA);
                setTeamB(data.teamB);
                setTotalOvers(data.totalOvers);
                setPreviousInnings(data.previousInnings);

                // If there's a live innings saved, MatchView will handle its own internal resume
                if (data.currentInnings) {
                    setCurrentInnings(data.currentInnings);
                }
            } catch (e) {
                console.error("Failed to restore state", e);
            }
        }
    }, []);

    useEffect(() => {
        const stateToSave = {
            matchStatus,
            teamA,
            teamB,
            totalOvers,
            previousInnings,
            currentInnings
        };
        localStorage.setItem('cric-scorer-match-state', JSON.stringify(stateToSave));
    }, [matchStatus, teamA, teamB, totalOvers, previousInnings, currentInnings]);

    // Helper to create an innings
    const createInnings = (
        battingTeam: TeamData,
        bowlingTeam: TeamData,
        inningNumber: 1 | 2,
        target?: number
    ): InningsState => {
        // Initialize Batting Players
        const playersMap: Record<string, Player> = {};
        const battingOrder: string[] = [];
        battingTeam.players.forEach((name, idx) => {
            const id = `bat_${battingTeam.name.replace(/\s/g, '')}_${idx}`;
            playersMap[id] = {
                id,
                name: name,
                runs: 0,
                ballsFaced: 0,
                fours: 0,
                sixes: 0,
                isOut: false
            };
            battingOrder.push(id);
        });

        // Initialize Bowlers (from Bowling Team Squad)
        const bowlersMap: Record<string, Bowler> = {};
        const bowlingOrder: string[] = [];
        bowlingTeam.players.forEach((name, idx) => {
            const id = `bowl_${bowlingTeam.name.replace(/\s/g, '')}_${idx}`;
            bowlersMap[id] = {
                id,
                name: name,
                overs: 0,
                balls: 0,
                maidens: 0,
                runsConceded: 0,
                wickets: 0
            };
            bowlingOrder.push(id);
        });

        return {
            inningNumber,
            target,
            battingTeamName: battingTeam.name,
            bowlingTeamName: bowlingTeam.name,
            totalRuns: 0,
            totalWickets: 0,
            overs: 0,
            balls: 0,
            currentOver: [],
            allBalls: [],
            strikerId: '',
            nonStrikerId: '',
            currentBowlerId: '',
            players: playersMap,
            bowlers: bowlersMap,
            battingOrder,
            bowlingOrder
        };
    };

    const startMatch = (tA: TeamData, tB: TeamData, overs: number, batFirstTeamName: string) => {
        setTeamA(tA);
        setTeamB(tB);
        setTotalOvers(overs);

        const isTeamABatting = tA.name === batFirstTeamName;
        const battingTeam = isTeamABatting ? tA : tB;
        const bowlingTeam = isTeamABatting ? tB : tA;

        const innings1 = createInnings(battingTeam, bowlingTeam, 1);
        setCurrentInnings(innings1);
        setPreviousInnings(undefined);
        setMatchStatus(MatchStatus.LIVE);
    };

    const handleInningsEnd = (completedInnings: InningsState) => {
        if (completedInnings.inningNumber === 1) {
            // Transition to 2nd Innings
            setPreviousInnings(completedInnings);

            if (!teamA || !teamB) return;

            const nextBattingTeam = completedInnings.battingTeamName === teamA.name ? teamB : teamA;
            const nextBowlingTeam = completedInnings.battingTeamName === teamA.name ? teamA : teamB;

            const target = completedInnings.totalRuns + 1;
            const innings2 = createInnings(nextBattingTeam, nextBowlingTeam, 2, target);

            setCurrentInnings(innings2);
            alert(`Innings Break! ${nextBattingTeam.name} needs ${target} runs to win.`);
        } else {
            setCurrentInnings(completedInnings);
            setMatchStatus(MatchStatus.COMPLETED);
        }
    };

    const resetMatch = () => {
        setMatchStatus(MatchStatus.SETUP);
        setCurrentInnings(null);
        setPreviousInnings(undefined);
        localStorage.removeItem('cric-scorer-match-state');
        localStorage.removeItem('cric-scorer-live-innings');
    }

    const getWinnerMessage = () => {
        if (!currentInnings || !previousInnings) return '';

        const target = currentInnings.target || 0;
        if (currentInnings.totalRuns >= target) {
            return `${currentInnings.battingTeamName} won by ${10 - currentInnings.totalWickets} wickets`;
        } else {
            const runDiff = (target - 1) - currentInnings.totalRuns;
            if (runDiff === 0) return "Match Tied!";
            return `${currentInnings.bowlingTeamName} won by ${runDiff} runs`;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            {matchStatus === MatchStatus.SETUP && (
                <MatchSetup onStartMatch={startMatch} />
            )}

            {matchStatus === MatchStatus.LIVE && currentInnings && (
                <MatchView
                    initialState={currentInnings}
                    previousInnings={previousInnings}
                    totalOvers={totalOvers}
                    onInningsEnd={handleInningsEnd}
                    onResetMatch={resetMatch}
                />
            )}

            {matchStatus === MatchStatus.COMPLETED && currentInnings && (
                <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 selection:bg-indigo-500/30">
                    <div className="relative w-full max-w-2xl animate-in zoom-in-95 duration-500">
                        {/* Dramatic Glow Background */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-indigo-600/10 blur-[120px] rounded-full -z-10"></div>

                        <div className="bg-slate-900 border border-white/5 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden backdrop-blur-3xl">
                            {/* Accent Header */}
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>

                            <div className="text-center space-y-8">
                                <div className="space-y-2">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 mb-4">
                                        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500">Official Result</span>
                                    </div>
                                    <div className="text-8xl animate-bounce">🏆</div>
                                    <h1 className="text-6xl font-black text-white uppercase tracking-tighter italic leading-none">
                                        Match<br />Concluded
                                    </h1>
                                </div>

                                <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-3xl p-8 transform hover:scale-[1.02] transition-transform">
                                    <p className="text-4xl font-black text-indigo-400 uppercase tracking-tight italic drop-shadow-2xl">
                                        {getWinnerMessage()}
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">Final Scorecards</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {/* First Innings Summary */}
                                        <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-5 flex justify-between items-center group hover:bg-slate-800 transition-colors">
                                            <div className="text-left">
                                                <span className="text-[10px] font-black text-slate-500 block mb-1 uppercase tracking-widest">Innings 1</span>
                                                <span className="text-xl font-black text-slate-300 uppercase tracking-tight italic">{previousInnings?.battingTeamName}</span>
                                            </div>
                                            <div className="text-4xl font-black text-white tabular-nums">
                                                {previousInnings?.totalRuns}<span className="text-slate-600 mx-1 text-2xl">/</span>{previousInnings?.totalWickets}
                                            </div>
                                        </div>

                                        {/* Second Innings Summary */}
                                        <div className="bg-indigo-600 border border-indigo-400 rounded-2xl p-5 flex justify-between items-center shadow-xl shadow-indigo-600/20">
                                            <div className="text-left">
                                                <span className="text-[10px] font-black text-indigo-100 block mb-1 uppercase tracking-widest">Innings 2</span>
                                                <span className="text-xl font-black text-white uppercase tracking-tight italic">{currentInnings.battingTeamName}</span>
                                            </div>
                                            <div className="text-4xl font-black text-white tabular-nums">
                                                {currentInnings.totalRuns}<span className="text-indigo-300 mx-1 text-2xl">/</span>{currentInnings.totalWickets}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={resetMatch}
                                    className="w-full h-20 bg-white text-slate-900 rounded-[1.5rem] font-black text-xl uppercase tracking-widest italic hover:bg-slate-100 active:scale-[0.98] transition-all shadow-2xl flex items-center justify-center gap-3 mt-12"
                                >
                                    START FRESH MATCH
                                    <span className="text-2xl">⚡</span>
                                </button>
                            </div>
                        </div>

                        {/* Footer Detail */}
                        <p className="mt-8 text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] text-center italic opacity-50">
                            CricGenius Record Log #77291-LIVE
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;