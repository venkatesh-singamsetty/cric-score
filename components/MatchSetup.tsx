import React, { useState } from 'react';
import { TeamData } from '../types';

interface MatchSetupProps {
    onStartMatch: (teamA: TeamData, teamB: TeamData, overs: number, batFirstTeam: string) => void;
}

const MatchSetup: React.FC<MatchSetupProps> = ({ onStartMatch }) => {
    const [teamAName, setTeamAName] = useState('CHICAGO SPARTANS A');
    const [teamASquad, setTeamASquad] = useState('DONNY, JIGAR, RAJU, SANDY, SHOBS, SHYAM, SUNIL, SURENDRA, VAMSI DESPLANES, VAMSI NAPERVILLE, VENKY');

    const [teamBName, setTeamBName] = useState('CHICAGO SPARTANS B');
    const [teamBSquad, setTeamBSquad] = useState('DONNY, JIGAR, RAJU, SANDY, SHOBS, SHYAM, SUNIL, SURENDRA, VAMSI DESPLANES, VAMSI NAPERVILLE, VENKY');

    const [overs, setOvers] = useState(15);
    const [batFirst, setBatFirst] = useState('Team A'); // 'Team A' or 'Team B'

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const teamA: TeamData = {
            name: teamAName.trim(),
            players: teamASquad.split(',').map(s => s.trim()).filter(s => s.length > 0).sort()
        };

        const teamB: TeamData = {
            name: teamBName.trim(),
            players: teamBSquad.split(',').map(s => s.trim()).filter(s => s.length > 0).sort()
        };

        const batFirstTeamName = batFirst === 'Team A' ? teamA.name : teamB.name;
        onStartMatch(teamA, teamB, overs, batFirstTeamName);
    };

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg mt-10 text-slate-900 border border-slate-200">
            <h1 className="text-3xl font-bold text-slate-800 mb-8 text-center uppercase tracking-tight italic">Match Configuration</h1>
            <form onSubmit={handleSubmit} className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Team A Setup */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-widest">Team A</h3>
                        <div className="mb-3">
                            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-tighter">Team Name</label>
                            <input
                                type="text"
                                required
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                                value={teamAName}
                                onChange={(e) => setTeamAName(e.target.value.toUpperCase())}
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-tighter">Squad (Comma separated)</label>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                    {teamASquad.split(',').map(s => s.trim()).filter(s => s.length > 0).length} Players
                                </span>
                            </div>
                            <textarea
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm uppercase"
                                rows={5}
                                value={teamASquad}
                                onChange={(e) => setTeamASquad(e.target.value.toUpperCase())}
                            />
                        </div>
                    </div>

                    {/* Team B Setup */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-widest">Team B</h3>
                        <div className="mb-3">
                            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-tighter">Team Name</label>
                            <input
                                type="text"
                                required
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                                value={teamBName}
                                onChange={(e) => setTeamBName(e.target.value.toUpperCase())}
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-tighter">Squad (Comma separated)</label>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                    {teamBSquad.split(',').map(s => s.trim()).filter(s => s.length > 0).length} Players
                                </span>
                            </div>
                            <textarea
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm uppercase"
                                rows={5}
                                value={teamBSquad}
                                onChange={(e) => setTeamBSquad(e.target.value.toUpperCase())}
                            />
                        </div>
                    </div>
                </div>

                {/* Match Settings */}
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Overs per Innings</label>
                            <input
                                type="number"
                                min={1}
                                max={50}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={overs}
                                onChange={(e) => setOvers(Number(e.target.value))}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Who Bats First?</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="batFirst"
                                        checked={batFirst === 'Team A'}
                                        onChange={() => setBatFirst('Team A')}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-sm font-medium">{teamAName || 'Team A'}</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="batFirst"
                                        checked={batFirst === 'Team B'}
                                        onChange={() => setBatFirst('Team B')}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-sm font-medium">{teamBName || 'Team B'}</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 text-lg uppercase tracking-widest italic"
                >
                    Start Match
                </button>
            </form>
        </div>
    );
};

export default MatchSetup;