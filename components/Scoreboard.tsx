import React, { useState } from 'react';
import { InningsState, Player, Bowler, ExtraType } from '../types';

interface ScoreboardProps {
  currentInnings: InningsState;
  previousInnings?: InningsState;
  onClose: () => void;
}

const Scoreboard: React.FC<ScoreboardProps> = ({ currentInnings, previousInnings, onClose }) => {
  const [activeTab, setActiveTab] = useState<'current' | 'previous'>(
    'current'
  );

  const displayInnings = activeTab === 'current' ? currentInnings : previousInnings;

  if (!displayInnings && activeTab === 'previous') {
    setActiveTab('current');
  }

  const BattingTable = ({ players, order }: { players: Record<string, Player>, order: string[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-slate-600">
        <thead className="text-xs text-slate-700 uppercase bg-slate-100">
          <tr>
            <th className="px-4 py-2 rounded-tl-lg font-bold">Batter</th>
            <th className="px-4 py-2 font-bold">Dismissal</th>
            <th className="px-4 py-2 text-right font-bold">R</th>
            <th className="px-4 py-2 text-right font-bold">B</th>
            <th className="px-4 py-2 text-right font-bold">4s</th>
            <th className="px-4 py-2 text-right rounded-tr-lg font-bold">6s</th>
            <th className="px-4 py-2 text-right font-bold uppercase tracking-tighter">SR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {order.map((id) => {
            const player = players[id];
            if (player.ballsFaced === 0 && !player.isOut && id !== displayInnings?.strikerId && id !== displayInnings?.nonStrikerId) {
              return null;
            }
            const isStriker = id === displayInnings?.strikerId;
            const isNonStriker = id === displayInnings?.nonStrikerId;
            const highlight = (activeTab === 'current' && (isStriker || isNonStriker));
            const sr = player.ballsFaced > 0 ? ((player.runs / player.ballsFaced) * 100).toFixed(1) : '0.0';

            return (
              <tr key={id} className={`border-b ${highlight ? 'bg-blue-50' : 'bg-white'}`}>
                <td className="px-4 py-3 font-bold text-slate-900 uppercase italic text-xs tracking-tight">
                  {player.name} {highlight && '*'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 font-medium">
                  {player.isOut ? (
                    <span className="text-red-600 font-bold uppercase text-[10px]">
                      {player.wicketType?.toLowerCase().replace('_', ' ')} b {player.wicketBy}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-bold uppercase text-[10px]">not out</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">{player.runs}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-500">{player.ballsFaced}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-500">{player.fours}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-500">{player.sixes}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-600/70">{sr}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const BowlingTable = ({ bowlers, order }: { bowlers: Record<string, Bowler>, order: string[] }) => (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-sm text-left text-slate-600">
        <thead className="text-xs text-slate-700 uppercase bg-slate-100">
          <tr>
            <th className="px-4 py-2 rounded-tl-lg font-bold">Bowler</th>
            <th className="px-4 py-2 text-right font-bold">O</th>
            <th className="px-4 py-2 text-right font-bold">M</th>
            <th className="px-4 py-2 text-right font-bold">R</th>
            <th className="px-4 py-2 text-right font-bold">W</th>
            <th className="px-4 py-2 text-right rounded-tr-lg font-bold tracking-tighter uppercase">Econ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {order.map((id) => {
            const bowler = bowlers[id];
            if (bowler.overs === 0 && bowler.balls === 0 && activeTab === 'previous') return null;
            if (bowler.overs === 0 && bowler.balls === 0 && id !== displayInnings?.currentBowlerId) return null;

            const totalOvers = bowler.overs + (bowler.balls / 6);
            const econ = totalOvers > 0 ? (bowler.runsConceded / totalOvers).toFixed(1) : '-';
            const isCurrent = activeTab === 'current' && id === displayInnings?.currentBowlerId;

            return (
              <tr key={id} className={`border-b ${isCurrent ? 'bg-green-50' : 'bg-white'}`}>
                <td className="px-4 py-3 font-bold text-slate-900 uppercase italic text-xs tracking-tight">{bowler.name}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-500">{bowler.overs}.{bowler.balls}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-500">{bowler.maidens}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">{bowler.runsConceded}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-600">{bowler.wickets}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-400">{econ}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/75 z-[150] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0 border-b border-white/10">
          <h2 className="text-xl font-black uppercase tracking-widest italic">Scorecard Protocol</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-white font-bold text-2xl">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 shrink-0 bg-slate-50">
          {previousInnings && (
            <button
              onClick={() => setActiveTab('previous')}
              className={`flex-1 py-4 text-xs font-black uppercase tracking-widest italic transition-all ${activeTab === 'previous' ? 'bg-white text-blue-600 border-b-4 border-blue-600' : 'text-slate-400 hover:bg-white hover:text-slate-600'}`}
            >
              {previousInnings.battingTeamName} (1st)
            </button>
          )}
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest italic transition-all ${activeTab === 'current' ? 'bg-white text-blue-600 border-b-4 border-blue-600' : 'text-slate-400 hover:bg-white hover:text-slate-600'}`}
          >
            {currentInnings.battingTeamName} ({currentInnings.inningNumber === 2 ? '2nd' : '1st'})
          </button>
        </div>

        {/* Content */}
        {displayInnings ? (
          <div className="p-8 overflow-y-auto pb-20 bg-white">
            <div className="mb-10">
              <div className="flex justify-between items-end mb-4 border-b border-slate-100 pb-2">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Batting</h3>
                <div className="text-right">
                  <span className="text-3xl font-black text-slate-900 italic uppercase">
                    {displayInnings.totalRuns}/{displayInnings.totalWickets}
                    <span className="text-xs font-bold text-slate-400 ml-2 not-italic">({displayInnings.overs}.{displayInnings.balls} ov)</span>
                  </span>
                </div>
              </div>
              <BattingTable players={displayInnings.players} order={displayInnings.battingOrder} />
            </div>

            <div className="mb-8">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic mb-4">Bowling</h3>
              <BowlingTable bowlers={displayInnings.bowlers} order={displayInnings.bowlingOrder} />
            </div>

            <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex flex-wrap gap-x-10 gap-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Innings Total</span>
                  <span className="text-xl font-black text-slate-800 italic uppercase">{displayInnings.totalRuns} Runs</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Extras Breakdown</span>
                  <div className="flex gap-4 text-xs font-bold text-slate-600">
                    <span>W: {displayInnings.allBalls.filter(b => b.extraType === ExtraType.WIDE).length}</span>
                    <span>NB: {displayInnings.allBalls.filter(b => b.extraType === ExtraType.NO_BALL).length}</span>
                    <span>LB: {displayInnings.allBalls.filter(b => b.extraType === ExtraType.LEG_BYE).length}</span>
                    <span>B: {displayInnings.allBalls.filter(b => b.extraType === ExtraType.BYE).length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-20 text-center text-slate-400 font-bold uppercase italic tracking-widest">No match data found</div>
        )}
      </div>
    </div>
  );
};

export default Scoreboard;