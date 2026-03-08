import React, { useState, useEffect, useRef } from 'react';
import { InningsState, BallEvent, ExtraType, WicketType } from '../types';
import Scoreboard from './Scoreboard';

interface MatchViewProps {
    initialState: InningsState;
    previousInnings?: InningsState;
    totalOvers: number;
    onInningsEnd: (inningsState: InningsState) => void;
}

type ModalType = 'NONE' | 'WICKET_TYPE' | 'BATTER_SELECT' | 'BOWLER_SELECT' | 'FIELDER_SELECT' | 'EXTRA_RUNS';

const MatchView: React.FC<MatchViewProps> = ({ initialState, previousInnings, totalOvers, onInningsEnd }) => {
    const [innings, setInnings] = useState<InningsState>(initialState);
    const [history, setHistory] = useState<InningsState[]>([]);
    const [lastCommentary, setLastCommentary] = useState<string>("Match started. Waiting for first ball.");
    const [isProcessing, setIsProcessing] = useState(false);
    const [showScoreboard, setShowScoreboard] = useState(false);

    // Scoring State UI controls
    const [pendingExtra, setPendingExtra] = useState<ExtraType>(ExtraType.NONE);
    const [modalView, setModalView] = useState<ModalType>('NONE');
    const [pendingWicketInfo, setPendingWicketInfo] = useState<{ runs: number, wicketType: WicketType } | null>(null);

    const commentaryEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Sync state if initial state changes (e.g. new innings start)
        setInnings(initialState);
        setHistory([]);
        setLastCommentary(initialState.inningNumber === 2 ? "Second innings started!" : "Match started.");
    }, [initialState]);

    useEffect(() => {
        commentaryEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [lastCommentary]);

    const getCurrentStriker = () => innings.players[innings.strikerId];
    const getCurrentNonStriker = () => innings.players[innings.nonStrikerId];
    const getCurrentBowler = () => innings.bowlers[innings.currentBowlerId];

    // Calculate equation for 2nd innings
    const getEquation = () => {
        if (innings.inningNumber !== 2 || !innings.target) return null;
        const runsNeeded = innings.target - innings.totalRuns;
        const ballsRemaining = (totalOvers * 6) - (innings.overs * 6 + innings.balls);
        if (runsNeeded <= 0) return "Target Reached!";
        return `Need ${runsNeeded} runs in ${ballsRemaining} balls`;
    };

    const saveToHistory = () => {
        setHistory(prev => [...prev, JSON.parse(JSON.stringify(innings))]);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previousState = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1));
        setInnings(previousState);
        setModalView('NONE');
        setPendingExtra(ExtraType.NONE);
        setLastCommentary("Last action undone.");
    };

    const generateSimpleCommentary = (ball: BallEvent): string => {
        let msg = `${ball.bowlerName} to ${ball.batterName}, `;
        if (ball.isWicket) {
            msg += `OUT! ${ball.wicketType}.`;
        } else if (ball.extraType !== ExtraType.NONE) {
            msg += `${ball.extraType}! ${ball.runs > 0 ? ball.runs + ' runs.' : ''}`;
        } else if (ball.runs === 0) {
            msg += "no run.";
        } else if (ball.runs === 4) {
            msg += "FOUR! Beautifully played.";
        } else if (ball.runs === 6) {
            msg += "SIX! That's a massive hit.";
        } else {
            msg += `${ball.runs} run${ball.runs > 1 ? 's' : ''}.`;
        }
        return msg;
    };

    const handleSwapEnds = () => {
        saveToHistory();
        setInnings(prev => ({
            ...prev,
            strikerId: prev.nonStrikerId,
            nonStrikerId: prev.strikerId
        }));
    };

    const handleScore = async (runs: number, isWicket = false, wicketType = WicketType.NONE, fielderName?: string) => {
        if (isProcessing && !fielderName) return; // Allow if we are coming back from fielder select

        // Check if we need a fielder first
        if (isWicket && (wicketType === WicketType.CAUGHT || wicketType === WicketType.STUMPED || wicketType === WicketType.RUN_OUT) && !fielderName) {
            setPendingWicketInfo({ runs, wicketType });
            setModalView('FIELDER_SELECT');
            return;
        }

        setIsProcessing(true);
        saveToHistory();

        const isWide = pendingExtra === ExtraType.WIDE;
        const isNoBall = pendingExtra === ExtraType.NO_BALL;
        const isBye = pendingExtra === ExtraType.BYE;
        const isLegBye = pendingExtra === ExtraType.LEG_BYE;

        // Calculate runs added to total score
        let totalRunsToAdd = runs;
        if (isWide || isNoBall) totalRunsToAdd += 1;

        // Calculate runs accredited to batter
        let batterRuns = 0;
        if (!isWide && !isBye && !isLegBye) {
            batterRuns = runs;
        }

        const striker = getCurrentStriker();
        const bowler = getCurrentBowler();

        const newBallEvent: BallEvent = {
            id: Date.now().toString(),
            bowlerName: bowler.name,
            batterName: striker.name,
            runs: batterRuns,
            isExtra: pendingExtra !== ExtraType.NONE,
            extraType: pendingExtra,
            extraRuns: (isWide || isNoBall) ? 1 : 0,
            isWicket,
            wicketType,
            fielderName,
            overNumber: innings.overs,
            ballNumber: innings.balls + 1,
        };

        // --- State Update Logic ---
        const nextInnings = { ...innings };
        const nextStriker = { ...nextInnings.players[nextInnings.strikerId] };
        const nextBowler = { ...nextInnings.bowlers[nextInnings.currentBowlerId] };

        // Update Runs
        nextInnings.totalRuns += totalRunsToAdd;
        nextStriker.runs += batterRuns;
        if (!isWide) {
            nextStriker.ballsFaced += 1;
        }

        if (batterRuns === 4) nextStriker.fours += 1;
        if (batterRuns === 6) nextStriker.sixes += 1;

        // Update Bowler
        if (!isBye && !isLegBye) {
            nextBowler.runsConceded += totalRunsToAdd;
        }

        // Valid Ball Calculation
        const isValidBall = !isWide && !isNoBall;
        let overCompleted = false;

        if (isValidBall) {
            nextInnings.balls += 1;
            nextBowler.balls += 1; // Track ball for bowler

            if (nextBowler.balls === 6) {
                nextBowler.balls = 0;
                nextBowler.overs += 1;
            }

            if (nextInnings.balls === 6) {
                nextInnings.balls = 0;
                nextInnings.overs += 1;
                overCompleted = true;
            }
        }

        // Wicket Logic
        if (isWicket) {
            nextInnings.totalWickets += 1;
            if (!isWide && !isNoBall && wicketType !== WicketType.RUN_OUT && wicketType !== WicketType.RETIRED_HURT && wicketType !== WicketType.RETIRED_OUT) {
                nextBowler.wickets += 1;
            }
            nextStriker.isOut = true;
            nextStriker.wicketType = wicketType;
            nextStriker.wicketBy = bowler.name;
            nextStriker.fielderName = fielderName;
        }

        // Strike Rotation
        if (runs % 2 !== 0) {
            [nextInnings.strikerId, nextInnings.nonStrikerId] = [nextInnings.nonStrikerId, nextInnings.strikerId];
        }

        // End of over strike rotation
        if (overCompleted) {
            [nextInnings.strikerId, nextInnings.nonStrikerId] = [nextInnings.nonStrikerId, nextInnings.strikerId];
        }

        // Commit State Updates
        nextInnings.players[striker.id] = nextStriker;
        nextInnings.allBalls.push(newBallEvent);
        nextInnings.currentOver.push(newBallEvent);
        if (nextInnings.currentOver.length > 6) nextInnings.currentOver.shift();

        // Maiden Over check - ignoring Wides, No Balls, Byes, and Leg-byes per request
        if (overCompleted) {
            const currentOverNumber = newBallEvent.overNumber;
            const overBalls = nextInnings.allBalls.filter(b => b.overNumber === currentOverNumber);

            // A maiden is prevented only if there were runs off the bat
            const runsOffBatInOver = overBalls.reduce((sum, b) => {
                const isExtra = b.extraType !== ExtraType.NONE;
                if (isExtra) return sum;
                return sum + b.runs;
            }, 0);

            if (runsOffBatInOver === 0) {
                nextBowler.maidens += 1;
            }
        }

        nextInnings.bowlers[bowler.id] = nextBowler;

        setInnings(nextInnings);
        setPendingExtra(ExtraType.NONE);
        setPendingWicketInfo(null);

        // Logic for next actions (Modals)
        setModalView('NONE'); // Close wicket type modal if open

        if (isWicket) {
            setModalView('BATTER_SELECT');
        } else if (overCompleted) {
            // If match not over, select next bowler
            if (nextInnings.overs < totalOvers) {
                setModalView('BOWLER_SELECT');
            }
        }

        // Check Match/Innings End Conditions
        const isAllOut = nextInnings.totalWickets >= 10;
        const isOversDone = nextInnings.overs >= totalOvers;
        const isTargetChased = nextInnings.target && nextInnings.totalRuns >= nextInnings.target;

        // Commentary
        let commentary = generateSimpleCommentary(newBallEvent);
        if (overCompleted && !isTargetChased && !isAllOut) {
            commentary += " End of over.";
        }
        setLastCommentary(commentary);

        if (isAllOut || (isOversDone && !overCompleted) || isTargetChased) {
            // Delay slightly so users see the wicket/run
            setTimeout(() => onInningsEnd(nextInnings), 500);
        }

        setIsProcessing(false);
    };

    const handleBatterSelected = (newBatterId: string) => {
        setInnings(prev => {
            const updated = {
                ...prev,
                strikerId: newBatterId
            };
            // Check if bowler needs to be changed after batter selection (e.g. wicket on last ball)
            if (updated.balls === 0 && updated.overs > 0 && updated.overs < totalOvers) {
                setModalView('BOWLER_SELECT');
            } else {
                setModalView('NONE');
            }
            return updated;
        });
    };

    const handleBowlerSelected = (newBowlerId: string) => {
        setInnings(prev => ({
            ...prev,
            currentBowlerId: newBowlerId,
            currentOver: [] // Clear over display once bowler is chosen
        }));
        setModalView('NONE');
    };

    const handleRetire = (type: WicketType) => {
        handleScore(0, true, type);
    };

    const handleFielderSelected = (fielderName: string) => {
        if (pendingWicketInfo) {
            handleScore(pendingWicketInfo.runs, true, pendingWicketInfo.wicketType, fielderName);
        }
    };

    // --- SUB COMPONENTS ---

    const FielderSelectModal = () => {
        let title = "Who took the fielder action?";
        if (pendingWicketInfo?.wicketType === WicketType.CAUGHT) title = "Who took the catch?";
        else if (pendingWicketInfo?.wicketType === WicketType.STUMPED) title = "Who performed the stumping?";
        else if (pendingWicketInfo?.wicketType === WicketType.RUN_OUT) title = "Who performed the run out?";

        return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-slate-900">
                    <div className="p-4 bg-slate-50 border-b border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                    </div>
                    <div className="overflow-y-auto p-2 pb-10">
                        {innings.bowlingOrder.map(id => {
                            const fielder = innings.bowlers[id];
                            return (
                                <button
                                    key={id}
                                    onClick={() => handleFielderSelected(fielder.name)}
                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 rounded-lg flex justify-between items-center group transition-colors border-b border-slate-50 last:border-0"
                                >
                                    <span className="font-medium text-slate-700 group-hover:text-blue-700">{fielder.name}</span>
                                    <span className="text-blue-500 opacity-0 group-hover:opacity-100">Select →</span>
                                </button>
                            );
                        })}
                    </div>
                    <button onClick={() => {
                        setModalView('NONE');
                        setPendingWicketInfo(null);
                        setIsProcessing(false);
                    }} className="p-4 text-sm text-slate-400 hover:text-slate-600 border-t">Cancel</button>
                </div>
            </div>
        );
    };

    const WicketTypeModal = () => (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-in text-slate-900">
                <h3 className="text-xl font-bold mb-6 text-center">Dismissal Type</h3>
                <div className="grid grid-cols-2 gap-3">
                    {[WicketType.BOWLED, WicketType.CAUGHT, WicketType.LBW, WicketType.RUN_OUT, WicketType.STUMPED].map((type) => (
                        <button
                            key={type}
                            onClick={() => handleScore(0, true, type)}
                            className="py-3 px-4 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all uppercase"
                        >
                            {type}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setModalView('NONE')}
                    className="mt-6 w-full py-3 text-slate-500 hover:text-slate-800 font-medium transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );

    const BatterSelectModal = () => {
        const availableBatters = innings.battingOrder.filter(id => {
            const p = innings.players[id];
            return !p.isOut && id !== innings.strikerId && id !== innings.nonStrikerId;
        });

        return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-slate-900">
                    <div className="p-4 bg-slate-50 border-b border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800">Select New Batter</h3>
                    </div>
                    <div className="overflow-y-auto p-2 pb-10">
                        {availableBatters.length === 0 ? (
                            <p className="p-4 text-center text-slate-500">No batters remaining.</p>
                        ) : (
                            availableBatters.map(id => (
                                <button
                                    key={id}
                                    onClick={() => handleBatterSelected(id)}
                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 rounded-lg flex justify-between items-center group transition-colors border-b border-slate-50 last:border-0"
                                >
                                    <span className="font-medium text-slate-700 group-hover:text-blue-700">{innings.players[id].name}</span>
                                    <span className="text-blue-500 opacity-0 group-hover:opacity-100">Select →</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const BowlerSelectModal = () => (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-slate-900">
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">Select Next Bowler</h3>
                    <p className="text-xs text-slate-500">Previous: {getCurrentBowler().name}</p>
                </div>
                <div className="overflow-y-auto p-2 pb-12">
                    {innings.bowlingOrder.map(id => {
                        const bowler = innings.bowlers[id];
                        const isCurrent = id === innings.currentBowlerId;
                        return (
                            <button
                                key={id}
                                onClick={() => handleBowlerSelected(id)}
                                disabled={isCurrent}
                                className={`w-full text-left px-4 py-3 rounded-lg flex justify-between items-center border-b border-slate-50 last:border-0 ${isCurrent ? 'bg-slate-100 opacity-50 cursor-not-allowed' : 'hover:bg-green-50 group cursor-pointer'}`}
                            >
                                <div>
                                    <span className={`font-medium ${isCurrent ? 'text-slate-400' : 'text-slate-700 group-hover:text-green-700'}`}>{bowler.name}</span>
                                    <div className="text-xs text-slate-400">{bowler.overs}.{bowler.balls} overs, {bowler.wickets} wkts</div>
                                </div>
                                {!isCurrent && <span className="text-green-500 opacity-0 group-hover:opacity-100 text-xs">Bowl →</span>}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const ExtraRunsModal = () => (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-in text-center text-slate-900">
                <h3 className="text-xl font-bold mb-2 uppercase tracking-wide">
                    {pendingExtra.replace('_', ' ')}
                </h3>
                <p className="text-slate-500 text-sm mb-6 font-medium">Any additional runs? (e.g. 4 if it went to the boundary)</p>
                <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2, 3, 4, 6].map(r => (
                        <button
                            key={r}
                            onClick={() => handleScore(r)}
                            className={`py-4 rounded-xl font-bold text-xl transition-all active:scale-95 shadow-sm border-b-4 ${r === 4 ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                    r === 6 ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                        'bg-slate-100 text-slate-800 border-slate-200'
                                }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => {
                        setPendingExtra(ExtraType.NONE);
                        setModalView('NONE');
                    }}
                    className="mt-6 w-full py-3 text-slate-400 font-bold uppercase text-xs tracking-widest hover:text-slate-600 transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );

    const striker = getCurrentStriker();
    const nonStriker = getCurrentNonStriker();
    const bowler = getCurrentBowler();
    const equation = getEquation();

    return (
        <div className="min-h-screen bg-slate-100 pb-48 md:pb-56">
            {modalView === 'WICKET_TYPE' && <WicketTypeModal />}
            {modalView === 'BATTER_SELECT' && <BatterSelectModal />}
            {modalView === 'BOWLER_SELECT' && <BowlerSelectModal />}
            {modalView === 'FIELDER_SELECT' && <FielderSelectModal />}
            {modalView === 'EXTRA_RUNS' && <ExtraRunsModal />}

            {showScoreboard && (
                <Scoreboard
                    currentInnings={innings}
                    previousInnings={previousInnings}
                    onClose={() => setShowScoreboard(false)}
                />
            )}

            {/* Header Scoreboard */}
            <div className="bg-slate-900 text-white p-6 shadow-lg sticky top-0 z-[100]">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-blue-200 text-sm font-bold tracking-wider uppercase">{innings.battingTeamName} vs {innings.bowlingTeamName}</h2>
                                <span className="bg-blue-600 text-[10px] px-2 py-0.5 rounded font-bold uppercase">{innings.inningNumber === 1 ? '1st Innings' : '2nd Innings'}</span>
                            </div>
                            <div className="flex items-baseline gap-3 mt-1">
                                <span className="text-5xl font-bold">{innings.totalRuns}/{innings.totalWickets}</span>
                                <span className="text-blue-300 font-mono text-xl">
                                    ({innings.overs}.{innings.balls}/{totalOvers})
                                </span>
                            </div>
                            <div className="text-xs text-blue-300 mt-2 flex gap-4">
                                <span>CRR: {innings.overs > 0 ? (innings.totalRuns / (innings.overs + innings.balls / 6)).toFixed(2) : '0.00'}</span>
                                {innings.target && <span>Target: {innings.target}</span>}
                                {innings.target && innings.inningNumber === 2 && (
                                    <span className="text-yellow-400 font-bold">REQ: {(((innings.target - innings.totalRuns) / ((totalOvers * 6) - (innings.overs * 6 + innings.balls))) * 6).toFixed(2)}</span>
                                )}
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                            <button
                                onClick={() => setShowScoreboard(true)}
                                className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-2 rounded-lg border border-slate-700 transition"
                            >
                                Full Scoreboard
                            </button>
                            {equation && (
                                <div className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded text-xs font-bold border border-yellow-500/30">
                                    {equation}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>


            <div className="max-w-4xl mx-auto p-4 space-y-4">

                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Batting Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden text-slate-900">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">Batting</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400">P'ship: {striker.runs + nonStriker.runs}</span>
                                <button onClick={handleSwapEnds} className="text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase hover:bg-blue-100 transition-colors">⇄ Swap</button>
                            </div>
                        </div>
                        <div className="divide-y divide-slate-100">
                            <div className={`p-4 flex justify-between items-center ${innings.strikerId === striker.id ? 'bg-blue-50/50 border-l-4 border-blue-500' : 'pl-5'}`}>
                                <div>
                                    <button onClick={handleSwapEnds} className="font-bold flex items-center gap-2 text-lg hover:text-blue-600 transition-colors">
                                        {striker.name} <span className="text-blue-600 text-sm">🏏</span>
                                    </button>
                                    <div className="text-xs text-slate-500 font-medium tracking-tight">4S: {striker.fours} // 6S: {striker.sixes}</div>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-bold">{striker.runs}</span>
                                    <span className="text-xs text-slate-500 block font-medium">({striker.ballsFaced})</span>
                                </div>
                            </div>
                            <div className={`p-4 flex justify-between items-center ${innings.strikerId === nonStriker.id ? 'bg-blue-50/50 border-l-4 border-blue-500' : 'pl-5'}`}>
                                <div>
                                    <button onClick={handleSwapEnds} className="font-bold text-slate-400 text-lg hover:text-blue-600 transition-colors">
                                        {nonStriker.name}
                                    </button>
                                    <div className="text-xs text-slate-500 font-medium tracking-tight">4S: {nonStriker.fours} // 6S: {nonStriker.sixes}</div>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-bold text-slate-400">{nonStriker.runs}</span>
                                    <span className="text-xs text-slate-500 block font-medium">({nonStriker.ballsFaced})</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bowling Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col text-slate-900">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Current Bowler</div>
                        <div className="p-4 flex-1 flex flex-col justify-center cursor-pointer hover:bg-slate-50 transition" onClick={() => setModalView('BOWLER_SELECT')}>
                            <div className="flex justify-between items-end mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold flex items-center gap-2 uppercase">
                                        {bowler.name} 🎾
                                    </span>
                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 uppercase font-bold">Change</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-3xl font-bold">{bowler.wickets}</span>
                                    <span className="text-slate-500 text-sm font-medium">-{bowler.runsConceded}</span>
                                </div>
                            </div>
                            <div className="flex gap-1 mb-2 h-2">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className={`flex-1 rounded-full ${i < innings.balls ? 'bg-green-500' : 'bg-slate-200'}`}></div>
                                ))}
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 font-medium uppercase tracking-tight">
                                <span>{bowler.overs}.{bowler.balls} OVERS</span>
                                <span>{bowler.maidens} MAIDENS</span>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Commentary Box */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm min-h-[80px] flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-slate-100 text-slate-500 text-[10px] px-3 py-1 rounded-bl-xl font-bold uppercase tracking-widest">Commentary</div>
                    <p className="text-slate-800 font-medium text-base leading-snug pr-4">
                        <span className="text-blue-500 text-xl mr-2">❝</span>
                        {lastCommentary}
                    </p>
                    <div ref={commentaryEndRef} />
                </div>
            </div>

            {/* Floating Controls */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-4 z-50 pb-8 md:pb-4 safe-area-bottom">
                <div className="max-w-4xl mx-auto">
                    {/* Action Bar (Undo, Swap, etc) */}
                    <div className="flex justify-between gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide text-slate-900">
                        <button
                            onClick={handleUndo}
                            disabled={history.length === 0}
                            className="flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 disabled:opacity-50"
                        >
                            <span className="text-lg">↩</span>
                            <span className="text-[10px] font-bold uppercase tracking-tighter">Undo</span>
                        </button>
                        <button
                            onClick={handleSwapEnds}
                            className="flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-lg bg-slate-50 text-slate-600 border border-slate-200"
                        >
                            <span className="text-lg">⇄</span>
                            <span className="text-[10px] font-bold uppercase tracking-tighter">Swap</span>
                        </button>
                        <button
                            onClick={() => setModalView('BOWLER_SELECT')}
                            className="flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-lg bg-slate-50 text-slate-600 border border-slate-200"
                        >
                            <span className="text-lg">🎾</span>
                            <span className="text-[10px] font-bold uppercase tracking-tighter">Bowler</span>
                        </button>
                        <button
                            onClick={() => handleRetire(WicketType.RETIRED_HURT)}
                            className="flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-lg bg-slate-50 text-slate-600 border border-slate-200"
                        >
                            <span className="text-lg">🚶</span>
                            <span className="text-[10px] font-bold uppercase tracking-tighter">Retire</span>
                        </button>
                    </div>

                    {/* Extras Toggles */}
                    <div className="flex gap-2 mb-4 justify-center">
                        {['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE'].map((type) => {
                            const isActive = pendingExtra === type as ExtraType;
                            return (
                                <button
                                    key={type}
                                    onClick={() => {
                                        const next = isActive ? ExtraType.NONE : type as ExtraType;
                                        setPendingExtra(next);
                                        if (next === ExtraType.WIDE || next === ExtraType.NO_BALL) {
                                            setModalView('EXTRA_RUNS');
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all transform active:scale-95 tracking-wide uppercase italic ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                >
                                    {type.replace('_', ' ')}
                                </button>
                            )
                        })}
                    </div>


                    {/* Keypad */}
                    <div className="grid grid-cols-7 gap-2 md:gap-3">
                        {[0, 1, 2, 3].map(run => (
                            <button key={run} onClick={() => handleScore(run)} className="aspect-square rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xl md:text-2xl shadow-sm border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 transition-all">{run}</button>
                        ))}
                        <button onClick={() => handleScore(4)} className="aspect-square rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold text-xl md:text-2xl shadow-sm border-b-4 border-blue-200 active:border-b-0 active:translate-y-1 transition-all">4</button>
                        <button onClick={() => handleScore(6)} className="aspect-square rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold text-xl md:text-2xl shadow-sm border-b-4 border-purple-200 active:border-b-0 active:translate-y-1 transition-all">6</button>
                        <button onClick={() => setModalView('WICKET_TYPE')} className="aspect-square rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xl md:text-2xl shadow-md border-b-4 border-red-700 active:border-b-0 active:translate-y-1 transition-all text-center">W</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MatchView;