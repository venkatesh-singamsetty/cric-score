import React, { useState } from 'react';
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
    const [totalOvers, setTotalOvers] = useState(0);

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
            strikerId: battingOrder[0],
            nonStrikerId: battingOrder[1],
            currentBowlerId: bowlingOrder[0],
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
                />
            )}

            {matchStatus === MatchStatus.COMPLETED && currentInnings && (
                <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
                    <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-lg w-full relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                        <div className="text-7xl mb-6">🏆</div>
                        <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tight italic">Match Ended</h1>
                        <p className="text-2xl font-medium text-blue-600 mb-8">{getWinnerMessage()}</p>

                        <div className="bg-slate-50 rounded-xl p-4 mb-8">
                            <div className="flex justify-between items-center mb-2 text-slate-600 uppercase font-bold text-xs">
                                <span>{previousInnings?.battingTeamName}</span>
                                <span className="font-bold">{previousInnings?.totalRuns}/{previousInnings?.totalWickets}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-800 font-bold text-lg uppercase italic mt-2">
                                <span>{currentInnings.battingTeamName}</span>
                                <span>{currentInnings.totalRuns}/{currentInnings.totalWickets}</span>
                            </div>
                        </div>

                        <button
                            onClick={resetMatch}
                            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl uppercase tracking-widest italic"
                        >
                            Start New Match
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;