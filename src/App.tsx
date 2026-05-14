/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { Plus, Trash2, Pill, CheckCircle2, History, RotateCcw, Calendar, TrendingUp, X, ShieldCheck, FileText, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Medicine {
  id: string;
  name: string;
  dosage: string; // e.g., "500mg"
  form: string;   // e.g., "Tablet"
  doses: number[]; // timestamps of doses taken today
  color: string;
  targetPerDay: number;
  reminders: string[]; // array of "HH:mm" strings
}

interface HistoryEntry {
  timestamp: number;
  medId: string;
  medName: string;
  dosage: string;
  form: string;
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
  const [newDosage, setNewDosage] = useState('');
  const [newForm, setNewForm] = useState('Tablet');
  const [newTarget, setNewTarget] = useState('1');
  const [activeLegalView, setActiveLegalView] = useState<'privacy' | 'terms' | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('medtrack_terms_accepted'));
  const [agreedToLegal, setAgreedToLegal] = useState(false);
  const [currentView, setCurrentView] = useState<'tracker' | 'history'>('tracker');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('medtrack_theme') === 'dark');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('medtrack_theme', darkMode ? 'dark' : 'white');
  }, [darkMode]);
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('medtrack_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [historyFilter, setHistoryFilter] = useState<'day' | 'week' | 'month'>('week');
  const [selectedMedFilter, setSelectedMedFilter] = useState<string>('all');

  const speakWelcome = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance("Welcome to M.T.B medtime. Get your doses right.");
      
      const voices = window.speechSynthesis.getVoices();
      const maleVoice = voices.find(v => 
        (v.name.includes('Male') || v.name.includes('David') || v.name.includes('Alex') || v.name.includes('Daniel')) && v.lang.includes('en')
      ) || voices.find(v => v.lang.includes('en'));

      if (maleVoice) utterance.voice = maleVoice;
      
      utterance.rate = 0.85; 
      utterance.pitch = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleEnterApp = () => {
    if (!agreedToLegal) return;
    speakWelcome();
    setShowWelcome(false);
    localStorage.setItem('medtrack_terms_accepted', 'true');
  };

  useEffect(() => {
    localStorage.setItem('medtrack_data', JSON.stringify(medicines));
    localStorage.setItem('medtrack_last_date', new Date().toDateString());
  }, [medicines]);

  useEffect(() => {
    localStorage.setItem('medtrack_history', JSON.stringify(history));
  }, [history]);

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
      dosage: newDosage.trim(),
      form: newForm,
      doses: [],
      color: COLORS[medicines.length % COLORS.length],
      targetPerDay: parseInt(newTarget) || 1,
      reminders: [],
    };

    setMedicines([...medicines, newMed]);
    setNewName('');
    setNewDosage('');
    setNewForm('Tablet');
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
    const med = medicines.find(m => m.id === id);
    if (!med) return;
    
    const now = Date.now();
    setMedicines(medicines.map(m => 
      m.id === id ? { ...m, doses: [...m.doses, now] } : m
    ));

    setHistory(prev => [...prev, {
      timestamp: now,
      medId: med.id,
      medName: med.name,
      dosage: med.dosage,
      form: med.form
    }]);
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
    <div className={`min-h-screen ${darkMode ? 'dark bg-slate-950' : 'bg-[#F8FAFC]'} text-slate-900 dark:text-slate-100 font-sans flex flex-col transition-colors duration-300`}>
      <nav className="h-20 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-6 md:px-10 flex-shrink-0 sticky top-0 z-50 transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-blue-900/20">
            <Pill className="text-white w-6 h-6" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">M.T.B medtime</h1>
          
          <div className="ml-6 flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
             <button 
               onClick={() => setCurrentView('tracker')}
               className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentView === 'tracker' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
             >
               Tracker
             </button>
             <button 
               onClick={() => setCurrentView('history')}
               className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentView === 'history' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
             >
               History
             </button>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-6">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all border border-transparent hover:border-blue-200 dark:hover:border-blue-800 group"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? (
              <Sun className="w-5 h-5 text-yellow-500 transition-transform group-hover:rotate-45" />
            ) : (
              <Moon className="w-5 h-5 text-blue-600 transition-transform group-hover:-rotate-12" />
            )}
          </button>

          <div className="text-right text-sm">
            <p className="font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Today's Status</p>
            <p className="text-slate-900 dark:text-slate-100 font-bold">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          </div>
          <form onSubmit={addMedicine} className="flex flex-wrap items-center gap-2">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-0.5">Name</span>
              <input
                type="text"
                placeholder="Medication name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm w-40 transition-all font-medium text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-0.5">Dose</span>
              <input
                type="text"
                placeholder="e.g. 10mg"
                value={newDosage}
                onChange={(e) => setNewDosage(e.target.value)}
                className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm w-24 transition-all font-medium text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-0.5">Form</span>
              <select
                value={newForm}
                onChange={(e) => setNewForm(e.target.value)}
                className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm w-32 transition-all font-medium appearance-none text-slate-900 dark:text-slate-100"
              >
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Liquid">Liquid</option>
                <option value="Injection">Injection</option>
                <option value="Cream">Cream</option>
                <option value="Drops">Drops</option>
              </select>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-0.5">Target</span>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2">
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  className="w-10 py-2 bg-transparent focus:outline-none text-sm font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            {notifPermission !== 'granted' && (
              <button
                type="button"
                onClick={requestNotifPermission}
                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors uppercase tracking-widest"
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
      <div className="md:hidden p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center justify-between mb-4">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Add New Medicine</p>
           <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg"
           >
            {darkMode ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-blue-600" />}
           </button>
        </div>
        <form onSubmit={addMedicine} className="flex flex-col gap-3">
          <div className="flex gap-2 h-20 items-center justify-between w-full">
            <div className="flex flex-col flex-1">
              <input
                type="text"
                placeholder="Add medication..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-col w-24">
              <input
                type="text"
                placeholder="Dose (10mg)"
                value={newDosage}
                onChange={(e) => setNewDosage(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
                value={newForm}
                onChange={(e) => setNewForm(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm appearance-none text-slate-900 dark:text-slate-100"
              >
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Liquid">Liquid</option>
                <option value="Injection">Injection</option>
                <option value="Cream">Cream</option>
                <option value="Drops">Drops</option>
            </select>
            <div className="flex-1 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Doses:</span>
              <input
                type="number"
                min="1"
                max="24"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                className="w-12 bg-transparent focus:outline-none text-sm font-bold text-right text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={!newName.trim()}
              className="bg-blue-600 text-white p-3 rounded-lg disabled:opacity-50 shadow-lg shadow-blue-100 dark:shadow-blue-900/20 active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      <main className="flex-1 flex flex-col lg:flex-row p-4 md:p-8 gap-8 overflow-hidden">
        {currentView === 'tracker' ? (
          <>
            {/* Left Section: Spreadsheeting Grid */}
            <div className="flex-1 flex flex-col gap-6">
              {medicines.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 border-dashed transition-colors">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-4">
                    <Pill className="w-8 h-8 text-blue-600 dark:text-blue-400 opacity-40" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">No medicines tracked</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto mt-2">
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
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col shadow-sm hover:shadow-md transition-all group overflow-hidden"
                      >
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start transition-colors">
                          <div>
                            <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold rounded uppercase tracking-wide">
                              {med.targetPerDay}x daily
                            </span>
                            <h2 className="mt-2 font-bold text-lg text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {med.name}
                            </h2>
                            <div className="flex items-center gap-2 mt-0.5">
                              {med.dosage && (
                                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                                  {med.dosage}
                                </span>
                              )}
                              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                                {med.form}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-2 whitespace-nowrap">
                              {med.doses.length >= med.targetPerDay ? 'Goal reached today' : `Take ${med.targetPerDay - med.doses.length} more doses`}
                            </p>
                          </div>
                          <button
                            onClick={() => removeMedicine(med.id)}
                            className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex-1 p-6 flex flex-col items-center justify-center gap-6 bg-slate-50/30 dark:bg-slate-800/10 transition-colors">
                          <div className="flex gap-2 h-16 items-center">
                            <AnimatePresence>
                              {/* Display vertical bars for targets */}
                              {Array.from({ length: med.targetPerDay }).map((_, i) => (
                                <motion.div
                                  key={`target-${i}`}
                                  className={`w-3 rounded-full transition-all duration-500 ${
                                    i < med.doses.length 
                                      ? `${med.color} h-12 shadow-sm shadow-blue-200 dark:shadow-blue-900/20` 
                                      : 'bg-slate-200 dark:bg-slate-700 h-6 border border-slate-300/30 dark:border-slate-600/30'
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
                                      className={`w-3 h-3 rounded-full ${med.color} border-2 border-white dark:border-slate-900`}
                                    />
                                  ))}
                                </div>
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="flex flex-col items-center">
                            <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{med.doses.length}</span>
                              <span className="text-xl font-bold text-slate-300 dark:text-slate-600">/ {med.targetPerDay}</span>
                            </div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest mt-1">Doses Today</p>
                          </div>

                          {/* Reminders Section */}
                          <div className="w-full mt-4 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" />
                                Daily Reminders
                              </p>
                              <input 
                                type="time" 
                                className="text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 font-bold text-slate-900 dark:text-slate-100"
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
                                <div key={time} className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 text-[9px] font-bold text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 group/rem">
                                  {time}
                                  <button onClick={() => removeReminder(med.id, time)} className="hover:text-red-500 transition-colors">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              )) : (
                                <p className="text-[9px] text-slate-300 dark:text-slate-600 italic">No reminders set</p>
                              )}
                            </div>
                          </div>

                          {/* Explicit Log Times */}
                          {med.doses.length > 0 && (
                            <div className="w-full space-y-1 mt-4">
                              <p className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest mb-2 border-b border-slate-200/50 dark:border-slate-700/50 pb-1 flex items-center gap-1 transition-colors">
                                <History className="w-2.5 h-2.5" />
                                Logged Today:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {med.doses.map((t, idx) => (
                                  <span key={idx} className="text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
                                    {new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="p-4 bg-white dark:bg-slate-900 transition-colors">
                          <button
                            onClick={() => addDose(med.id)}
                            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-100 dark:shadow-blue-900/20 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group/btn"
                          >
                            <CheckCircle2 className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                            Log Current Dose
                          </button>
                          <button
                            onClick={() => resetDoses(med.id)}
                            className="w-full mt-2 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
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
              <div className="bg-slate-900 dark:bg-slate-900/50 rounded-3xl p-8 text-white shadow-xl shadow-slate-200 dark:shadow-blue-900/10 relative overflow-hidden transition-colors border border-transparent dark:border-slate-800">
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

              <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col shadow-sm transition-colors">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Recent Activity</h3>
                  </div>
                  <button onClick={() => setCurrentView('history')} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">
                    View All
                  </button>
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
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700 transition-colors">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{log.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                            {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 transition-colors">
                      <p className="text-xs font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest">No activity yet</p>
                    </div>
                  )}
                </div>
                
                <div className="mt-auto pt-8">
                  <button className="w-full py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 border-t border-slate-100 dark:border-slate-800 uppercase tracking-widest transition-all">
                    Export Data Log
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm p-8 flex flex-col transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Medication History</h2>
                <p className="text-slate-400 dark:text-slate-500 font-medium text-sm">Detailed log of all doses taken</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Medicine Filter */}
                <select 
                  value={selectedMedFilter}
                  onChange={(e) => setSelectedMedFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">All Medicines</option>
                  {medicines.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>

                {/* Range Selector */}
                <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center">
                  {(['day', 'week', 'month'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setHistoryFilter(range)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-black transition-all ${
                        historyFilter === range ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                  <History className="w-12 h-12 mb-4 text-slate-300 dark:text-slate-700" />
                  <p className="font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest text-xs">No entries found for this period</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(
                    history
                      .filter(entry => {
                        if (selectedMedFilter !== 'all' && entry.medId !== selectedMedFilter) return false;
                        
                        const entryDate = new Date(entry.timestamp);
                        const now = new Date();
                        if (historyFilter === 'day') {
                          return entryDate.toDateString() === now.toDateString();
                        } else if (historyFilter === 'week') {
                          const oneWeekAgo = new Date();
                          oneWeekAgo.setDate(now.getDate() - 7);
                          return entryDate >= oneWeekAgo;
                        } else {
                          const oneMonthAgo = new Date();
                          oneMonthAgo.setMonth(now.getMonth() - 1);
                          return entryDate >= oneMonthAgo;
                        }
                      })
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .reduce((groups, entry) => {
                        const date = new Date(entry.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
                        if (!groups[date]) groups[date] = [];
                        groups[date].push(entry);
                        return groups;
                      }, {} as Record<string, HistoryEntry[]>)
                  ).map(([date, entries]) => (
                    <div key={date} className="space-y-2">
                      <div className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm py-2 z-10 transition-colors">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1">{date}</p>
                      </div>
                      <div className="grid gap-2">
                        {entries.map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 rounded-2xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all group">
                             <div className="flex items-center gap-4">
                               <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 transition-colors">
                                 <Pill className="w-5 h-5" />
                               </div>
                               <div>
                                 <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{entry.medName}</p>
                                 <div className="flex items-center gap-2">
                                   <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{entry.dosage} {entry.form}</span>
                                   <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                   <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Success</span>
                                 </div>
                               </div>
                             </div>
                             <div className="text-right">
                               <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                 {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                               </p>
                               <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Recorded via MTB</p>
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="py-10 px-10 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Pill className="w-4 h-4 text-slate-900 dark:text-slate-100" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100">M.T.B medtime &copy; 2026</span>
          </div>
          <div className="flex gap-8">
            <button 
              onClick={() => setActiveLegalView('privacy')}
              className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Privacy
            </button>
            <button 
              onClick={() => setActiveLegalView('terms')}
              className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Terms
            </button>
            <a 
              href="mailto:bountyrun1@gmail.com"
              className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Support
            </a>
          </div>
        </div>
      </footer>

      {/* Legal Overlays */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 40 }}
              className="bg-white dark:bg-slate-900 max-w-md w-full rounded-[40px] p-10 text-center shadow-2xl relative overflow-hidden transition-colors border border-transparent dark:border-slate-800"
            >
              {/* Decorative Background Element */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl" />
              
              <div className="relative z-10">
                <div className="w-20 h-20 bg-blue-600 rounded-[28px] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-200 dark:shadow-blue-900/20">
                  <Pill className="text-white w-10 h-10" strokeWidth={2.5} />
                </div>
                
                <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 mb-4 tracking-tight">
                  Welcome to<br />M.T.B medtime
                </h2>
                
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-6">
                  Your private, minimalist companion to ensure you never miss a dose. 
                  <span className="block mt-2 text-blue-600 dark:text-blue-400 font-bold">Get your doses right.</span>
                </p>

                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl mb-8 border border-slate-100 dark:border-slate-700 flex flex-col gap-4">
                  <div className="flex items-start gap-3 text-left">
                    <input 
                      type="checkbox" 
                      id="legal-agree"
                      checked={agreedToLegal}
                      onChange={(e) => setAgreedToLegal(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="legal-agree" className="text-xs text-slate-500 dark:text-slate-400 leading-normal cursor-pointer">
                      I have read and agree to the 
                      <button onClick={() => setActiveLegalView('privacy')} className="text-blue-600 dark:text-blue-400 font-bold hover:underline mx-1">Privacy Policy</button> 
                      and 
                      <button onClick={() => setActiveLegalView('terms')} className="text-blue-600 dark:text-blue-400 font-bold hover:underline ml-1">Terms of Service</button>.
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleEnterApp}
                  disabled={!agreedToLegal}
                  className="w-full py-5 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-600 dark:hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-200 dark:shadow-blue-900/20 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:bg-slate-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed disabled:scale-100"
                >
                  Start Tracking
                  <motion.div
                    animate={agreedToLegal ? { x: [0, 5, 0] } : {}}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <Plus className="w-6 h-6" />
                  </motion.div>
                </button>
                
                <p className="mt-6 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">
                  Privacy First • Browser Storage Only
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {activeLegalView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            onClick={() => setActiveLegalView(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] transition-colors border border-transparent dark:border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                    {activeLegalView === 'privacy' ? <ShieldCheck /> : <FileText />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                      {activeLegalView === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
                    </h2>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500">Legal Information</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveLegalView(null)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 dark:text-slate-500"
                >
                  <X />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 prose prose-slate dark:prose-invert max-w-none">
                {activeLegalView === 'privacy' ? (
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Your Data Stays Local</h3>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                        M.T.B medtime is built with a <strong>Privacy-First</strong> philosophy. We believe your medical information is yours alone. 
                        This application does NOT have a backend server. 
                      </p>
                    </section>
                    <section className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 transition-colors">
                      <p className="text-blue-800 dark:text-blue-300 text-sm font-medium">
                        All medication names, dose logs, and schedules are stored <strong>exclusively in your browser's local storage</strong> (localStorage). 
                        No data is ever transmitted, uploaded, or shared with us or any third parties.
                      </p>
                    </section>
                    <section>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Cookies & Tracking</h3>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                        We do not use tracking cookies, analytics scripts, or any form of behavioral monitoring. 
                        The application is a pure utility designed to function as a private tool.
                      </p>
                    </section>
                    <section>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Data Deletion</h3>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                        If you clear your browser's cache or local storage, all data will be permanently deleted. 
                        You can also remove individual medications within the app at any time.
                      </p>
                    </section>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Informational Use Only</h3>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                        M.T.B medtime is a tracking tool intended for informational purposes. It is <strong>not a medical device</strong> and is 
                        not designed to provide medical advice, diagnosis, or treatment.
                      </p>
                    </section>
                    <section className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30 transition-colors">
                      <p className="text-red-800 dark:text-red-400 text-sm font-bold">
                        Always follow the instructions provided by your healthcare professional or the medication's label. 
                        Never ignore professional medical advice because of something you have recorded or seen in this app.
                      </p>
                    </section>
                    <section>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">No Warranty</h3>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                        This software is provided "as is" without warranty of any kind. Use of the application is at your own risk. 
                        M.T.B medtime is not responsible for any missed doses or incorrect tracking entries.
                      </p>
                    </section>
                    <section>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Acceptance</h3>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                        By using M.T.B medtime, you acknowledge that you have read and understood these terms and agree to use the application responsibly.
                      </p>
                    </section>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end transition-colors">
                <button 
                  onClick={() => setActiveLegalView(null)}
                  className="px-6 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors"
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
