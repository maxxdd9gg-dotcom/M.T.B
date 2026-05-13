/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { Plus, Trash2, Pill, CheckCircle2, History, RotateCcw, Calendar, TrendingUp, X, ShieldCheck, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Medicine {
  id: string;
  name: string;
  doses: number[]; // timestamps of doses taken today
  color: string;
  targetPerDay: number;
  reminders: string[]; // array of "HH:mm" strings
}

const COLORS = [
  'bg-blue-600',
  'bg-indigo-600',
  'bg-emerald-600',
  'bg-cyan-600',
];

export default function App() {
  const [medicines, setMedicines] = useState<Medicine[]>(() => {
    const saved = localStorage.getItem('medtrack_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const today = new Date().toDateString();
        const lastUpdate = localStorage.getItem('medtrack_last_date');
        if (lastUpdate !== today) {
          return parsed.map((m: Medicine) => ({ ...m, doses: [] }));
        }
        return parsed;
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('1');
  const [activeLegalView, setActiveLegalView] = useState<'privacy' | 'terms' | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    localStorage.setItem('medtrack_data', JSON.stringify(medicines));
    localStorage.setItem('medtrack_last_date', new Date().toDateString());
  }, [medicines]);

  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }

    const interval = setInterval(() => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      medicines.forEach(med => {
        if (med.reminders.includes(currentTime)) {
          // Check if we already notified for this exact minute to avoid spam
          const lastNotifKey = `notified_${med.id}_${currentTime}`;
          const lastNotifDate = localStorage.getItem(lastNotifKey);
          
          if (lastNotifDate !== now.toDateString()) {
            sendNotification(med.name);
            localStorage.setItem(lastNotifKey, now.toDateString());
          }
        }
      });
    }, 1000 * 60); // Check every minute

    return () => clearInterval(interval);
  }, [medicines]);

  const requestNotifPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
    }
  };

  const sendNotification = (medName: string) => {
    if (Notification.permission === 'granted') {
      new Notification('M.T.B medtime Reminder', {
        body: `It's time to take your ${medName}!`,
        icon: '/pwa-icon.png' // Fallback
      });
    }
  };

  const addMedicine = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    const newMed: Medicine = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      doses: [],
      color: COLORS[medicines.length % COLORS.length],
      targetPerDay: parseInt(newTarget) || 1,
      reminders: [],
    };

    setMedicines([...medicines, newMed]);
    setNewName('');
    setNewTarget('1');
  };

  const addReminder = (id: string, time: string) => {
    setMedicines(medicines.map(m => 
      m.id === id ? { ...m, reminders: [...new Set([...m.reminders, time])].sort() } : m
    ));
  };

  const removeReminder = (id: string, time: string) => {
    setMedicines(medicines.map(m => 
      m.id === id ? { ...m, reminders: m.reminders.filter(t => t !== time) } : m
    ));
  };

  const removeMedicine = (id: string) => {
    setMedicines(medicines.filter(m => m.id !== id));
  };

  const addDose = (id: string) => {
    setMedicines(medicines.map(m => 
      m.id === id ? { ...m, doses: [...m.doses, Date.now()] } : m
    ));
  };

  const resetDoses = (id: string) => {
    setMedicines(medicines.map(m => 
      m.id === id ? { ...m, doses: [] } : m
    ));
  };

  const totalDosesToday = medicines.reduce((acc, med) => acc + med.doses.length, 0);
  const recentLogs = [...medicines]
    .flatMap(m => m.doses.map(d => ({ name: m.name, time: d })))
    .sort((a, b) => b.time - a.time)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col">
      <nav className="h-20 border-b border-slate-200 bg-white flex items-center justify-between px-6 md:px-10 flex-shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
            <Pill className="text-white w-6 h-6" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">M.T.B medtime</h1>
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <div className="text-right text-sm">
            <p className="font-semibold text-slate-400 uppercase tracking-widest text-[10px]">Today's Status</p>
            <p className="text-slate-900 font-bold">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          </div>
          <form onSubmit={addMedicine} className="flex gap-2">
            <input
              type="text"
              placeholder="Medication name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm w-40 transition-all"
            />
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Per Day:</span>
              <input
                type="number"
                min="1"
                max="24"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                className="w-10 py-2 bg-transparent focus:outline-none text-sm font-bold"
              />
            </div>
            {notifPermission !== 'granted' && (
              <button
                type="button"
                onClick={requestNotifPermission}
                className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors uppercase tracking-widest"
              >
                Enable Notifications
              </button>
            )}
            <button
              type="submit"
              disabled={!newName.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Add
            </button>
          </form>
        </div>
      </nav>

      {/* Mobile Form */}
      <div className="md:hidden p-4 bg-white border-b border-slate-200">
        <form onSubmit={addMedicine} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Add medication..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
          />
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Doses per day:</span>
              <input
                type="number"
                min="1"
                max="24"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                className="w-full bg-transparent focus:outline-none text-sm font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={!newName.trim()}
              className="bg-blue-600 text-white p-3 rounded-lg disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      <main className="flex-1 flex flex-col lg:flex-row p-4 md:p-8 gap-8 overflow-hidden">
        {/* Left Section: Spreadsheeting Grid */}
        <div className="flex-1 flex flex-col gap-6">
          {medicines.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24 text-center bg-white rounded-3xl border border-slate-200 border-dashed">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                <Pill className="w-8 h-8 text-blue-600 opacity-40" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">No medicines tracked</h3>
              <p className="text-slate-500 text-sm max-w-xs mx-auto mt-2">
                Your daily medication schedule will appear here once you add your first medicine.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {medicines.map((med) => (
                  <motion.div
                    key={med.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-2xl border border-slate-200 flex flex-col shadow-sm hover:shadow-md transition-shadow group overflow-hidden"
                  >
                    <div className="p-5 border-b border-slate-100 flex justify-between items-start">
                      <div>
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wide">
                          {med.targetPerDay}x daily
                        </span>
                        <h2 className="mt-2 font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">
                          {med.name}
                        </h2>
                        <p className="text-xs text-slate-400 font-medium whitespace-nowrap">
                          {med.doses.length >= med.targetPerDay ? 'Goal reached today' : `Take ${med.targetPerDay - med.doses.length} more doses`}
                        </p>
                      </div>
                      <button
                        onClick={() => removeMedicine(med.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex-1 p-6 flex flex-col items-center justify-center gap-6 bg-slate-50/30">
                      <div className="flex gap-2 h-16 items-center">
                        <AnimatePresence>
                          {/* Display vertical bars for targets */}
                          {Array.from({ length: med.targetPerDay }).map((_, i) => (
                            <motion.div
                              key={`target-${i}`}
                              className={`w-3 rounded-full transition-all duration-500 ${
                                i < med.doses.length 
                                  ? `${med.color} h-12 shadow-sm shadow-blue-200` 
                                  : 'bg-slate-200 h-6 border border-slate-300/30'
                              }`}
                            />
                          ))}
                          {/* Extra doses show up as smaller dots or additional bars if exceeded */}
                          {med.doses.length > med.targetPerDay && (
                             <div className="flex gap-1 ml-2">
                               {med.doses.slice(med.targetPerDay).map((_, i) => (
                                 <motion.div 
                                   key={`extra-${i}`}
                                   initial={{ scale: 0 }}
                                   animate={{ scale: 1 }}
                                   className={`w-3 h-3 rounded-full ${med.color} border-2 border-white`}
                                 />
                               ))}
                             </div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black text-slate-900 tracking-tight">{med.doses.length}</span>
                          <span className="text-xl font-bold text-slate-300">/ {med.targetPerDay}</span>
                        </div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">Doses Today</p>
                      </div>

                      {/* Reminders Section */}
                      <div className="w-full mt-4 bg-white p-3 rounded-xl border border-slate-200/50">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            Daily Reminders
                          </p>
                          <input 
                            type="time" 
                            className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1 font-bold"
                            onChange={(e) => {
                              if (e.target.value) {
                                addReminder(med.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {med.reminders.length > 0 ? med.reminders.map(time => (
                            <div key={time} className="flex items-center gap-1 bg-slate-50 text-[9px] font-bold text-slate-600 px-2 py-0.5 rounded border border-slate-200 group/rem">
                              {time}
                              <button onClick={() => removeReminder(med.id, time)} className="hover:text-red-500 transition-colors">
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )) : (
                            <p className="text-[9px] text-slate-300 italic">No reminders set</p>
                          )}
                        </div>
                      </div>

                      {/* Explicit Log Times */}
                      {med.doses.length > 0 && (
                        <div className="w-full space-y-1 mt-4">
                          <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-2 border-b border-slate-200/50 pb-1 flex items-center gap-1">
                             <History className="w-2.5 h-2.5" />
                             Logged Today:
                          </p>
                          <div className="flex flex-wrap gap-2">
                             {med.doses.map((t, idx) => (
                               <span key={idx} className="text-[10px] font-bold bg-white px-2 py-1 rounded border border-slate-200 text-slate-500">
                                 {new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                               </span>
                             ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-white">
                      <button
                        onClick={() => addDose(med.id)}
                        className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group/btn"
                      >
                        <CheckCircle2 className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                        Log Current Dose
                      </button>
                      <button
                        onClick={() => resetDoses(med.id)}
                        className="w-full mt-2 py-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset Day
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right Section: Sidebar Statistics */}
        <div className="w-full lg:w-80 flex flex-col gap-6">
          <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-200 relative overflow-hidden">
             {/* Decorative element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Daily Progress</h3>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-5xl font-black text-white">{totalDosesToday > 0 ? 'Active' : '0'}</span>
                <span className="text-sm text-slate-400 mb-1">Doses logged</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(totalDosesToday * 20, 100)}%` }}
                  className="bg-blue-500 h-full shadow-lg shadow-blue-500/30" 
                />
              </div>
              <p className="text-xs text-slate-400 mt-6 leading-relaxed flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                Consistency is key for your health.
              </p>
            </div>
          </div>

          <div className="flex-1 bg-white rounded-3xl border border-slate-200 p-8 flex flex-col shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <History className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent Activity</h3>
            </div>
            
            <div className="space-y-6">
              {recentLogs.length > 0 ? (
                recentLogs.map((log, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={`${log.name}-${log.time}`} 
                    className="flex gap-4 items-center"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{log.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No activity yet</p>
                </div>
              )}
            </div>
            
            <div className="mt-auto pt-8">
              <button className="w-full py-4 text-[10px] font-black text-slate-400 hover:text-blue-600 border-t border-slate-100 uppercase tracking-widest transition-all">
                Export Data Log
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-10 px-10 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Pill className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">M.T.B medtime &copy; 2024</span>
          </div>
          <div className="flex gap-8">
            <button 
              onClick={() => setActiveLegalView('privacy')}
              className="text-[10px] text-slate-400 uppercase tracking-widest font-bold hover:text-blue-600 transition-colors cursor-pointer"
            >
              Privacy
            </button>
            <button 
              onClick={() => setActiveLegalView('terms')}
              className="text-[10px] text-slate-400 uppercase tracking-widest font-bold hover:text-blue-600 transition-colors cursor-pointer"
            >
              Terms
            </button>
            <a 
              href="mailto:support@example.com"
              className="text-[10px] text-slate-400 uppercase tracking-widest font-bold hover:text-blue-600 transition-colors"
            >
              Support
            </a>
          </div>
        </div>
      </footer>

      {/* Legal Overlays */}
      <AnimatePresence>
        {activeLegalView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            onClick={() => setActiveLegalView(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                    {activeLegalView === 'privacy' ? <ShieldCheck /> : <FileText />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      {activeLegalView === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
                    </h2>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Legal Information</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveLegalView(null)}
                  className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
                >
                  <X />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 prose prose-slate max-w-none">
                {activeLegalView === 'privacy' ? (
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">Your Data Stays Local</h3>
                      <p className="text-slate-600 leading-relaxed text-sm">
                        M.T.B medtime is built with a <strong>Privacy-First</strong> philosophy. We believe your medical information is yours alone. 
                        This application does NOT have a backend server. 
                      </p>
                    </section>
                    <section className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <p className="text-blue-800 text-sm font-medium">
                        All medication names, dose logs, and schedules are stored <strong>exclusively in your browser's local storage</strong> (localStorage). 
                        No data is ever transmitted, uploaded, or shared with us or any third parties.
                      </p>
                    </section>
                    <section>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">Cookies & Tracking</h3>
                      <p className="text-slate-600 leading-relaxed text-sm">
                        We do not use tracking cookies, analytics scripts, or any form of behavioral monitoring. 
                        The application is a pure utility designed to function as a private tool.
                      </p>
                    </section>
                    <section>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">Data Deletion</h3>
                      <p className="text-slate-600 leading-relaxed text-sm">
                        If you clear your browser's cache or local storage, all data will be permanently deleted. 
                        You can also remove individual medications within the app at any time.
                      </p>
                    </section>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">Informational Use Only</h3>
                      <p className="text-slate-600 leading-relaxed text-sm">
                        M.T.B medtime is a tracking tool intended for informational purposes. It is <strong>not a medical device</strong> and is 
                        not designed to provide medical advice, diagnosis, or treatment.
                      </p>
                    </section>
                    <section className="bg-red-50 p-4 rounded-2xl border border-red-100">
                      <p className="text-red-800 text-sm font-bold">
                        Always follow the instructions provided by your healthcare professional or the medication's label. 
                        Never ignore professional medical advice because of something you have recorded or seen in this app.
                      </p>
                    </section>
                    <section>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">No Warranty</h3>
                      <p className="text-slate-600 leading-relaxed text-sm">
                        This software is provided "as is" without warranty of any kind. Use of the application is at your own risk. 
                        M.T.B medtime is not responsible for any missed doses or incorrect tracking entries.
                      </p>
                    </section>
                    <section>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">Acceptance</h3>
                      <p className="text-slate-600 leading-relaxed text-sm">
                        By using M.T.B medtime, you acknowledge that you have read and understood these terms and agree to use the application responsibly.
                      </p>
                    </section>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setActiveLegalView(null)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors"
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
