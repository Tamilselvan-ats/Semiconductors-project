/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  ReferenceLine
} from 'recharts';
import { 
  Sun, 
  Zap, 
  Waves, 
  Info,
  CheckCircle2,
  AlertCircle,
  Activity,
  Moon,
  ChevronRight,
  BookOpen,
  LayoutDashboard,
  Calculator
} from 'lucide-react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility for Tailwind classes ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Constants ---
const Q = 1.602176634e-19; // Elementary charge (C)
const K = 1.380649e-23;    // Boltzmann constant (J/K)
const T_REF = 298.15;      // Reference temperature (25°C in Kelvin)
const N = 1.5;             // Ideality factor
const I0_REF = 1e-12;      // Reference saturation current (A)
const ISC_REF = 0.04;      // Reference short-circuit current (A)

// --- Types ---
interface Material {
  name: string;
  eg: number; // Band gap in eV
}

const MATERIALS: Material[] = [
  { name: 'Silicon (Si)', eg: 1.12 },
  { name: 'Gallium Arsenide (GaAs)', eg: 1.42 },
  { name: 'Germanium (Ge)', eg: 0.67 },
  { name: 'Indium Phosphide (InP)', eg: 1.34 },
  { name: 'Cadmium Telluride (CdTe)', eg: 1.45 },
];

type Tab = 'dashboard' | 'step-by-step';
type Theme = 'dark' | 'light';

export default function App() {
  // --- State ---
  const [material, setMaterial] = useState<Material>(MATERIALS[0]);
  const [irradiance, setIrradiance] = useState(800); // W/m²
  const [temperature, setTemperature] = useState(300); // K
  const [wavelength, setWavelength] = useState(550); // nm
  const [solarAngle, setSolarAngle] = useState(0); // degrees
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app-theme');
      return (saved as Theme) || 'dark';
    }
    return 'dark';
  });

  // --- Physics Calculations ---
  const physics = useMemo(() => {
    // 1. Photon Energy (eV)
    const ePhoton = 1240 / wavelength;
    const isPowerGenerated = ePhoton > material.eg;

    // 2. Photocurrent (Iph)
    // Apply Cosine Law and Irradiance scaling
    const angleRad = (solarAngle * Math.PI) / 180;
    const cosTheta = Math.cos(angleRad);
    const effectiveIrradiance = irradiance * cosTheta;
    let iph = isPowerGenerated ? (effectiveIrradiance / 1000) * ISC_REF : 0;
    if (iph < 0) iph = 0;

    // 3. Saturation Current (I0) with Temperature scaling
    // I0 = I0_ref * (T/T_ref)^3 * exp(-qEg/nk * (1/T - 1/T_ref))
    const thermalVoltage = (K * temperature) / Q;
    const i0 = I0_REF * Math.pow(temperature / T_REF, 3) * 
               Math.exp((-material.eg / (N * (K / Q))) * (1 / temperature - 1 / T_REF));

    // 4. Characteristic Metrics
    // Voc = (nkT/q) * ln(Iph/I0 + 1)
    const voc = iph > 0 ? N * thermalVoltage * Math.log(iph / i0 + 1) : 0;
    const isc = iph;

    // 5. Generate I-V Curve Data
    const ivData = [];
    let pMax = 0;
    let vMax = 0;

    const steps = 100;
    const vLimit = voc > 0 ? voc * 1.1 : 0.8;
    
    for (let i = 0; i <= steps; i++) {
      const v = (i / steps) * vLimit;
      // I = Iph - I0 * (exp(qV/nkT) - 1)
      const current = Math.max(0, iph - i0 * (Math.exp(v / (N * thermalVoltage)) - 1));
      const power = v * current;

      if (power > pMax) {
        pMax = power;
        vMax = v;
      }

      ivData.push({
        voltage: parseFloat(v.toFixed(3)),
        current: parseFloat(current.toFixed(4)),
        power: parseFloat(power.toFixed(4)),
      });
    }

    const fillFactor = (voc > 0 && isc > 0) ? (pMax / (voc * isc)) * 100 : 0;

    // --- Baseline Reference at T=298K ---
    // Calculate Voc at reference temperature for comparison
    const thermalVoltageRef = (K * T_REF) / Q;
    const i0Ref = I0_REF * 1; // Exp term is 1 because T = T_REF
    const vocRef = iph > 0 ? N * thermalVoltageRef * Math.log(iph / i0Ref + 1) : 0;
    const vocLoss = (voc - vocRef) * 1000; // in mV

    return {
      ePhoton,
      isPowerGenerated,
      voc,
      vocRef,
      vocLoss,
      isc,
      pMax,
      vMax,
      fillFactor,
      ivData,
      thermalVoltage,
      i0,
      cosTheta,
      effectiveIrradiance
    };
  }, [material, irradiance, temperature, wavelength, solarAngle]);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('app-theme', next);
      return next;
    });
  };

  return (
    <div className={cn(
      "min-h-screen font-sans selection:bg-blue-500/30 transition-colors duration-300",
      theme === 'dark' ? "bg-[#0F1115] text-white" : "bg-[#F8FAFC] text-slate-900"
    )}>
      {/* --- Header --- */}
      <header className={cn(
        "border-b px-8 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md",
        theme === 'dark' ? "border-white/10 bg-[#151921]/80" : "border-slate-200 bg-white/80"
      )}>
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-lg shadow-lg shadow-blue-500/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Quantum Solar Cell Simulator</h1>
            <p className={cn(
              "text-[10px] uppercase tracking-widest font-bold",
              theme === 'dark' ? "text-white/40" : "text-slate-400"
            )}>Semiconductor Physics Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <nav className={cn(
            "flex items-center p-1 rounded-xl",
            theme === 'dark' ? "bg-white/5" : "bg-slate-100"
          )}>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                activeTab === 'dashboard' 
                  ? (theme === 'dark' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-white text-blue-600 shadow-sm")
                  : (theme === 'dark' ? "text-white/40 hover:text-white" : "text-slate-500 hover:text-slate-900")
              )}
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab('step-by-step')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                activeTab === 'step-by-step'
                  ? (theme === 'dark' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-white text-blue-600 shadow-sm")
                  : (theme === 'dark' ? "text-white/40 hover:text-white" : "text-slate-500 hover:text-slate-900")
              )}
            >
              <Calculator className="w-4 h-4" /> Step by Step
            </button>
          </nav>

          <button
            onClick={toggleTheme}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl transition-all border group",
              theme === 'dark' 
                ? "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10" 
                : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm"
            )}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 transition-transform group-hover:rotate-45" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 transition-transform group-hover:-rotate-12" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </header>

      <main className="flex flex-col lg:flex-row h-[calc(100vh-73px)]">
        {/* --- Sidebar Controls --- */}
        <aside className={cn(
          "w-full lg:w-80 border-r p-6 overflow-y-auto shrink-0 transition-colors",
          theme === 'dark' ? "bg-[#151921] border-white/10" : "bg-white border-slate-200"
        )}>
          <div className="space-y-8">
            <section>
              <label className={cn(
                "flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest mb-4",
                theme === 'dark' ? "text-white/40" : "text-slate-400"
              )}>
                <Activity className="w-4 h-4" /> Material Selection
              </label>
              <div className="grid grid-cols-1 gap-2">
                {MATERIALS.map((m) => (
                  <button
                    key={m.name}
                    onClick={() => setMaterial(m)}
                    className={cn(
                      "px-4 py-3 rounded-xl text-sm font-medium transition-all text-left border",
                      material.name === m.name 
                        ? (theme === 'dark' 
                            ? "bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.1)]" 
                            : "bg-blue-50 border-blue-500 text-blue-600 shadow-sm")
                        : (theme === 'dark'
                            ? "bg-white/5 border-transparent text-white/60 hover:bg-white/10"
                            : "bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100")
                    )}
                  >
                    {m.name}
                    <span className="block text-[10px] opacity-50 mt-1">E_g = {m.eg} eV</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-6">
              <label className={cn(
                "flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                theme === 'dark' ? "text-white/40" : "text-slate-400"
              )}>
                <Sun className="w-4 h-4" /> Environmental Controls
              </label>
              
              <div className="space-y-4">
                <ControlSlider 
                  label="Irradiance (G)" 
                  value={irradiance} 
                  unit="W/m²" 
                  min={0} max={1000} step={10} 
                  onChange={setIrradiance} 
                  theme={theme}
                />
                <ControlSlider 
                  label="Temperature (T)" 
                  value={temperature} 
                  unit="K" 
                  min={250} max={350} step={1} 
                  onChange={setTemperature} 
                  theme={theme}
                />
                <ControlSlider 
                  label="Wavelength (λ)" 
                  value={wavelength} 
                  unit="nm" 
                  min={300} max={1500} step={10} 
                  onChange={setWavelength} 
                  theme={theme}
                />
                <ControlSlider 
                  label="Solar Angle (θ)" 
                  value={solarAngle} 
                  unit="°" 
                  min={0} max={90} step={1} 
                  onChange={setSolarAngle} 
                  theme={theme}
                />
              </div>
            </section>

            <section className={cn(
              "pt-6 border-t",
              theme === 'dark' ? "border-white/5" : "border-slate-100"
            )}>
              <div className={cn(
                "rounded-2xl p-4 border",
                theme === 'dark' ? "bg-blue-500/5 border-blue-500/10" : "bg-blue-50 border-blue-100"
              )}>
                <div className="flex items-center gap-2 text-blue-500 mb-2">
                  <Info className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Physics Note</span>
                </div>
                <p className={cn(
                  "text-[11px] leading-relaxed",
                  theme === 'dark' ? "text-white/50" : "text-slate-500"
                )}>
                  The simulation uses the single-diode model to calculate the current-voltage response based on semiconductor band gap properties.
                </p>
              </div>
            </section>
          </div>
        </aside>

        {/* --- Main Content Area --- */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'dashboard' ? (
            <div className="space-y-8 max-w-7xl mx-auto">
              {/* Panel A: The Quantum Proof */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={cn(
                  "md:col-span-2 rounded-3xl p-8 border relative overflow-hidden transition-colors",
                  theme === 'dark' ? "bg-[#151921] border-white/10" : "bg-white border-slate-200 shadow-sm"
                )}>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Waves className="w-5 h-5 text-blue-500" /> Panel A: The Quantum Proof
                      </h2>
                      {physics.isPowerGenerated ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-[10px] font-bold border border-green-500/20 uppercase tracking-wider">
                          <CheckCircle2 className="w-4 h-4" /> E_photon {'>'} E_g
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-600 rounded-full text-[10px] font-bold border border-red-500/20 uppercase tracking-wider">
                          <AlertCircle className="w-4 h-4" /> E_photon {'<'} E_g
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 items-center">
                      <div className="space-y-6">
                        <MetricDisplay 
                          label="Photon Energy" 
                          value={physics.ePhoton.toFixed(2)} 
                          unit="eV" 
                          formula={`E_{photon} = \\frac{1240}{\\lambda} = \\frac{1240}{${wavelength}}`}
                          theme={theme}
                        />
                        <MetricDisplay 
                          label="Material Band Gap" 
                          value={material.eg.toFixed(2)} 
                          unit="eV" 
                          formula={`E_g = ${material.eg} \\text{ eV}`}
                          theme={theme}
                        />
                      </div>

                      <div className={cn(
                        "rounded-2xl p-6 border space-y-4",
                        theme === 'dark' ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"
                      )}>
                        <h3 className={cn(
                          "text-[10px] font-bold uppercase tracking-wider",
                          theme === 'dark' ? "text-white/70" : "text-slate-500"
                        )}>Simulation Logic</h3>
                        {physics.isPowerGenerated ? (
                          <div className="space-y-3">
                            <p className="text-sm text-green-600 font-bold">Success: Photoelectric effect activated.</p>
                            {temperature > 298.15 && (
                              <div className="flex items-center gap-2 text-red-500 text-[10px] font-bold bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                                <AlertCircle className="w-3 h-3" /> Thermal Loss: {Math.abs(physics.vocLoss).toFixed(1)} mV
                              </div>
                            )}
                            <p className={cn(
                              "text-xs leading-relaxed",
                              theme === 'dark' ? "text-white/50" : "text-slate-500"
                            )}>
                              The incident photons have sufficient energy to excite electrons.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm text-red-600 font-bold">Failure: No power generated.</p>
                            <p className={cn(
                              "text-xs leading-relaxed",
                              theme === 'dark' ? "text-white/50" : "text-slate-500"
                            )}>
                              Photon energy is below the material's band gap threshold. No electron-hole pairs are created.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Background Glow */}
                  <div className={cn(
                    "absolute -right-20 -bottom-20 w-64 h-64 blur-[120px] rounded-full opacity-10 transition-colors duration-700",
                    physics.isPowerGenerated ? "bg-green-500" : "bg-red-500"
                  )} />
                </div>

                {/* Panel C: Metrics Summary */}
                <div className={cn(
                  "rounded-3xl p-8 border flex flex-col justify-between transition-colors",
                  theme === 'dark' ? "bg-[#151921] border-white/10" : "bg-white border-slate-200 shadow-sm"
                )}>
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
                    <Activity className="w-5 h-5 text-blue-500" /> Panel C: Metrics
                  </h2>
                  <div className="space-y-6">
                    <SummaryRow label="V_oc" value={`${physics.voc.toFixed(3)} V`} sub="Open Circuit Voltage" theme={theme} />
                    <div className={cn(
                      "flex justify-between items-center px-3 py-2 rounded-xl",
                      physics.vocLoss < 0 ? "bg-red-500/5 text-red-500" : "bg-green-500/5 text-green-500"
                    )}>
                      <span className="text-[9px] font-bold uppercase tracking-wider">Thermal Drift</span>
                      <span className="text-sm font-bold font-mono">
                        {physics.vocLoss > 0 ? "+" : ""}{physics.vocLoss.toFixed(1)} mV
                      </span>
                    </div>
                    <SummaryRow label="I_sc" value={`${(physics.isc * 1000).toFixed(1)} mA`} sub="Short Circuit Current" theme={theme} />
                    <SummaryRow label="Fill Factor" value={`${physics.fillFactor.toFixed(1)}%`} sub="Efficiency Metric" theme={theme} />
                  </div>
                  <div className={cn(
                    "mt-8 pt-6 border-t",
                    theme === 'dark' ? "border-white/5" : "border-slate-100"
                  )}>
                    <div className="flex items-center justify-between text-blue-500">
                      <span className="text-[10px] font-bold uppercase tracking-widest">P_max</span>
                      <span className="text-2xl font-light">{(physics.pMax * 1000).toFixed(2)} mW</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel B: The I-V Graph */}
              <div className={cn(
                "rounded-3xl p-8 border transition-colors",
                theme === 'dark' ? "bg-[#151921] border-white/10" : "bg-white border-slate-200 shadow-sm"
              )}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" /> Panel B: I-V Characteristic Curve
                  </h2>
                  <div className="flex flex-wrap gap-4">
                    <LegendItem label="Current (I)" color="#3b82f6" theme={theme} />
                    <LegendItem label="Power (P)" color="#3b82f640" isDashed theme={theme} />
                  </div>
                </div>

                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={physics.ivData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? "#ffffff10" : "#00000010"} vertical={false} />
                      <XAxis 
                        dataKey="voltage" 
                        stroke={theme === 'dark' ? "#ffffff40" : "#00000040"} 
                        fontSize={10} 
                        tickFormatter={(v) => `${v}V`}
                      />
                      <YAxis 
                        stroke={theme === 'dark' ? "#ffffff40" : "#00000040"} 
                        fontSize={10} 
                        tickFormatter={(v) => `${(v * 1000).toFixed(0)}mA`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: theme === 'dark' ? '#151921' : '#ffffff', 
                          borderColor: theme === 'dark' ? '#ffffff10' : '#00000010', 
                          borderRadius: '12px', 
                          fontSize: '12px',
                          color: theme === 'dark' ? '#fff' : '#000'
                        }}
                        itemStyle={{ color: '#3b82f6' }}
                        formatter={(value: number, name: string) => [
                          name === 'current' ? `${(value * 1000).toFixed(2)} mA` : `${(value * 1000).toFixed(2)} mW`,
                          name === 'current' ? 'Current' : 'Power'
                        ]}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="current" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorCurrent)" 
                        animationDuration={500}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="power" 
                        stroke="#3b82f640" 
                        strokeDasharray="5 5"
                        fill="transparent"
                        animationDuration={500}
                      />
                      {physics.vMax > 0 && (
                        <ReferenceLine x={physics.vMax} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: 'MPP', fill: '#3b82f6', fontSize: 10, position: 'top' }} />
                      )}
                      {physics.vocRef > 0 && temperature !== 298.15 && (
                        <ReferenceLine 
                          x={physics.vocRef} 
                          stroke={theme === 'dark' ? "#ffffff20" : "#00000020"} 
                          strokeDasharray="5 5" 
                          label={{ 
                            value: 'Baseline (25°C)', 
                            fill: theme === 'dark' ? '#ffffff30' : '#00000030', 
                            fontSize: 10, 
                            position: 'insideTopRight' 
                          }} 
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className={cn(
                    "rounded-2xl p-6 border",
                    theme === 'dark' ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"
                  )}>
                    <h3 className={cn(
                      "text-[10px] font-bold uppercase tracking-widest mb-4",
                      theme === 'dark' ? "text-white/40" : "text-slate-400"
                    )}>Governing Equation</h3>
                    <div className={cn(
                      "flex justify-center py-4 rounded-xl border",
                      theme === 'dark' ? "bg-[#0F1115] border-white/5" : "bg-white border-slate-100"
                    )}>
                      <BlockMath math={`I = I_{ph} - I_0 \\left[ \\exp\\left(\\frac{qV}{nkT}\\right) - 1 \\right]`} />
                    </div>
                    <p className={cn(
                      "text-[11px] mt-4 leading-relaxed",
                      theme === 'dark' ? "text-white/40" : "text-slate-500"
                    )}>
                      This equation models the solar cell as a current source in parallel with a diode. The exponential term represents the recombination current.
                    </p>
                  </div>

                  <div className={cn(
                    "rounded-2xl p-6 border",
                    theme === 'dark' ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"
                  )}>
                    <h3 className={cn(
                      "text-[10px] font-bold uppercase tracking-widest mb-4",
                      theme === 'dark' ? "text-white/40" : "text-slate-400"
                    )}>Environmental Variables</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <EnvVar label="Thermal Voltage (V_th)" value={`${(physics.thermalVoltage * 1000).toFixed(2)} mV`} theme={theme} />
                      <EnvVar label="Photo-Current (I_ph)" value={`${(physics.isc * 1000).toFixed(2)} mA`} theme={theme} />
                      <EnvVar label="Saturation (I_0)" value={(1e12 * physics.isc / Math.exp(physics.voc / (N * physics.thermalVoltage))).toExponential(2) + " A"} theme={theme} />
                      <EnvVar label="Cosine Loss" value={`${(100 * (1 - physics.cosTheta)).toFixed(1)}%`} theme={theme} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-12 pb-20">
              <header className="space-y-4">
                <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                  <Calculator className="w-8 h-8 text-blue-500" /> Step-by-Step Numeric Explanation
                </h2>
                <p className={cn(
                  "text-sm leading-relaxed",
                  theme === 'dark' ? "text-white/50" : "text-slate-500"
                )}>
                  A detailed breakdown of how the current simulation state was derived from your inputs.
                </p>
              </header>

              {/* Input Summary Card */}
              <div className={cn(
                "p-8 rounded-3xl border grid grid-cols-2 md:grid-cols-5 gap-6",
                theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-sm"
              )}>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-blue-500">Material</p>
                  <p className="text-sm font-bold">{material.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-blue-500">Irradiance</p>
                  <p className="text-sm font-bold">{irradiance} W/m²</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-blue-500">Temperature</p>
                  <p className="text-sm font-bold">{temperature} K</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-blue-500">Wavelength</p>
                  <p className="text-sm font-bold">{wavelength} nm</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-blue-500">Solar Angle</p>
                  <p className="text-sm font-bold">{solarAngle}°</p>
                </div>
              </div>

              <div className="space-y-16">
                <StepSection 
                  number="01" 
                  title="Quantum Threshold Verification" 
                  theme={theme}
                >
                  <p className="mb-6">First, we determine if the incident light has enough energy to excite electrons across the band gap.</p>
                  <div className="space-y-4">
                    <CalculationRow 
                      label="Photon Energy Calculation"
                      formula={`E_{ph} = \\frac{1240}{\\lambda} = \\frac{1240}{${wavelength}}`}
                      result={`${physics.ePhoton.toFixed(3)} eV`}
                      theme={theme}
                    />
                    <div className={cn(
                      "p-4 rounded-xl border flex items-center gap-4",
                      physics.isPowerGenerated ? "bg-green-500/10 border-green-500/20 text-green-600" : "bg-red-500/10 border-red-500/20 text-red-600"
                    )}>
                      {physics.isPowerGenerated ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      <span className="text-sm font-bold">
                        {physics.isPowerGenerated 
                          ? `Success: ${physics.ePhoton.toFixed(3)} eV > ${material.eg} eV (Band Gap of ${material.name})`
                          : `Failure: ${physics.ePhoton.toFixed(3)} eV < ${material.eg} eV (Band Gap of ${material.name})`
                        }
                      </span>
                    </div>
                  </div>
                </StepSection>

                <StepSection 
                  number="02" 
                  title="Photocurrent Generation (I_ph)" 
                  theme={theme}
                >
                  <p className="mb-6">We calculate the current generated by light, accounting for irradiance and the angle of incidence.</p>
                  <div className="space-y-4">
                    <CalculationRow 
                      label="Effective Irradiance (Cosine Law)"
                      formula={`G_{eff} = G \\cdot \\cos(\\theta) = ${irradiance} \\cdot \\cos(${solarAngle}^\\circ)`}
                      result={`${physics.effectiveIrradiance.toFixed(1)} W/m²`}
                      theme={theme}
                    />
                    <CalculationRow 
                      label="Short Circuit Current Scaling"
                      formula={`I_{sc} = 0.04 \\cdot \\frac{G_{eff}}{1000} = 0.04 \\cdot \\frac{${physics.effectiveIrradiance.toFixed(1)}}{1000}`}
                      result={`${(physics.isc * 1000).toFixed(2)} mA`}
                      theme={theme}
                    />
                  </div>
                </StepSection>

                <StepSection 
                  number="03" 
                  title="Thermal & Saturation Parameters" 
                  theme={theme}
                >
                  <p className="mb-6">The cell's performance is heavily influenced by temperature, affecting the thermal voltage and leakage current.</p>
                  <div className="space-y-4">
                    <CalculationRow 
                      label="Thermal Voltage"
                      formula={`V_{th} = \\frac{kT}{q} = \\frac{1.38e^{-23} \\cdot ${temperature}}{1.60e^{-19}}`}
                      result={`${(physics.thermalVoltage * 1000).toFixed(2)} mV`}
                      theme={theme}
                    />
                    <CalculationRow 
                      label="Saturation Current (I_0)"
                      formula={`I_0 = 10^{-12} \\cdot \\left(\\frac{T}{298.15}\\right)^3 \\cdot \\exp\\left(\\frac{-E_g}{n V_{th}}\\right)`}
                      result={`${physics.i0.toExponential(3)} A`}
                      theme={theme}
                    />
                  </div>
                </StepSection>

                <StepSection 
                  number="04" 
                  title="Open Circuit Voltage (V_oc)" 
                  theme={theme}
                >
                  <p className="mb-6">Finally, we derive the maximum possible voltage when no current is being drawn.</p>
                  <div className="space-y-4">
                    <CalculationRow 
                      label="Voc Derivation"
                      formula={`V_{oc} = n V_{th} \\ln\\left(\\frac{I_{ph}}{I_0} + 1\\right) = 1.5 \\cdot ${physics.thermalVoltage.toFixed(4)} \\ln\\left(\\frac{${physics.isc.toFixed(4)}}{${physics.i0.toExponential(2)}} + 1\\right)`}
                      result={`${physics.voc.toFixed(3)} V`}
                      theme={theme}
                    />
                  </div>
                </StepSection>

                <StepSection 
                  number="05" 
                  title="Efficiency & Maximum Power" 
                  theme={theme}
                >
                  <p className="mb-6">We calculate the maximum power point (MPP) and the fill factor to evaluate the cell's efficiency.</p>
                  <div className="space-y-4">
                    <CalculationRow 
                      label="Maximum Power (P_max)"
                      formula={`P_{max} = V_{mpp} \\cdot I_{mpp}`}
                      result={`${(physics.pMax * 1000).toFixed(2)} mW`}
                      theme={theme}
                    />
                    <CalculationRow 
                      label="Fill Factor (FF)"
                      formula={`FF = \\frac{P_{max}}{V_{oc} \\cdot I_{sc}} = \\frac{${(physics.pMax * 1000).toFixed(2)}}{${physics.voc.toFixed(3)} \\cdot ${(physics.isc * 1000).toFixed(2)}}`}
                      result={`${physics.fillFactor.toFixed(1)}%`}
                      theme={theme}
                    />
                  </div>
                </StepSection>

                <div className={cn(
                  "p-8 rounded-3xl border space-y-6",
                  theme === 'dark' ? "bg-blue-500/5 border-blue-500/20" : "bg-blue-50 border-blue-100"
                )}>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-blue-500" /> Theoretical Derivation & Thermal Effects
                  </h3>
                  <div className={cn(
                    "text-sm leading-relaxed space-y-4",
                    theme === 'dark' ? "text-white/70" : "text-slate-600"
                  )}>
                    <p>
                      The I-V characteristic of a solar cell is derived from the superposition principle. The total current <InlineMath math="I" /> is the difference between the light-generated current <InlineMath math="I_{ph}" /> and the dark diode current <InlineMath math="I_d" />:
                    </p>
                    <BlockMath math={`I = I_{ph} - I_d = I_{ph} - I_0 \\left[ \\exp\\left(\\frac{qV}{nkT}\\right) - 1 \\right]`} />
                    <p>
                      At open-circuit conditions (<InlineMath math="I = 0" />), we can solve for <InlineMath math="V_{oc}" />:
                    </p>
                    <BlockMath math={`V_{oc} = \\frac{nkT}{q} \\ln\\left(\\frac{I_{ph}}{I_0} + 1\\right)`} />
                    <div className={cn(
                      "p-4 rounded-xl border mt-4",
                      theme === 'dark' ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-100"
                    )}>
                      <h4 className="font-bold text-red-600 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4" /> Why does Voltage "Collapse" at High Temperatures?
                      </h4>
                      <p className="text-xs italic">
                        As temperature increases, two things happen: the thermal voltage <InlineMath math="V_{th} = kT/q" /> increases, but the saturation current <InlineMath math="I_0" /> increases <b>exponentially</b>. Because <InlineMath math="I_0" /> is in the denominator of the log term, its massive growth outweighs the linear increase of <InlineMath math="T" />. This results in a net decrease in <InlineMath math="V_{oc}" />, typically around <InlineMath math="-2.2\text{mV/K}" /> for Silicon, leading to the thermal "collapse" you see in the curve.
                      </p>
                      <div className="mt-4 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                        <h5 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Graph Visual Guide:</h5>
                        <ul className="text-[10px] list-disc pl-4 space-y-1 text-slate-500 dark:text-white/40">
                          <li>The <b>Dashed Vertical Line</b> is the benchmark (25°C).</li>
                          <li>The <b>X-Intercept Shift</b> to the left indicates Voltage Collapse.</li>
                          <li>A <b>Shrinking Area</b> under the curve equals reduced Efficiency.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// --- Subcomponents ---

function ControlSlider({ label, value, unit, min, max, step, onChange, theme }: { 
  label: string, value: number, unit: string, min: number, max: number, step: number, 
  onChange: (v: number) => void, theme: Theme 
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
        <span className={theme === 'dark' ? "text-white/60" : "text-slate-400"}>{label}</span>
        <div className="flex items-center gap-2">
          <input 
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className={cn(
              "w-16 px-2 py-1 rounded-md font-mono text-blue-500 text-[11px] border focus:outline-none focus:ring-1 focus:ring-blue-500/50",
              theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
            )}
          />
          <span className="text-blue-500/50">{unit}</span>
        </div>
      </div>
      <input 
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-500",
          theme === 'dark' ? "bg-white/10" : "bg-slate-200"
        )}
      />
    </div>
  );
}

function MetricDisplay({ label, value, unit, formula, theme }: { 
  label: string, value: string, unit: string, formula: string, theme: Theme 
}) {
  return (
    <div className="space-y-2">
      <p className={cn(
        "text-[10px] font-bold uppercase tracking-widest",
        theme === 'dark' ? "text-white/40" : "text-slate-400"
      )}>{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-light tracking-tighter">{value}</span>
        <span className={cn("text-sm font-medium", theme === 'dark' ? "text-white/40" : "text-slate-400")}>{unit}</span>
      </div>
      <div className="text-[10px] text-blue-500/80 italic">
        <InlineMath math={formula} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value, sub, theme }: { label: string, value: string, sub: string, theme: Theme }) {
  return (
    <div className={cn(
      "flex justify-between items-center border-b pb-4",
      theme === 'dark' ? "border-white/5" : "border-slate-100"
    )}>
      <span className={cn("text-[10px] font-bold uppercase", theme === 'dark' ? "text-white/40" : "text-slate-400")}>{label}</span>
      <div className="text-right">
        <p className="text-xl font-medium">{value}</p>
        <p className={cn("text-[9px] uppercase font-bold tracking-wider", theme === 'dark' ? "text-white/20" : "text-slate-300")}>{sub}</p>
      </div>
    </div>
  );
}

function LegendItem({ label, color, isDashed, theme }: { label: string, color: string, isDashed?: boolean, theme: Theme }) {
  return (
    <div className={cn(
      "flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider",
      theme === 'dark' ? "text-white/40" : "text-slate-400"
    )}>
      <div 
        className={cn("w-3 h-3 rounded-full", isDashed && "border border-dashed")} 
        style={{ backgroundColor: isDashed ? 'transparent' : color, borderColor: color }} 
      />
      {label}
    </div>
  );
}

function EnvVar({ label, value, theme }: { label: string, value: string, theme: Theme }) {
  return (
    <div className="space-y-1">
      <p className={cn("text-[9px] uppercase font-bold tracking-wider", theme === 'dark' ? "text-white/30" : "text-slate-400")}>{label}</p>
      <p className="text-sm font-mono text-blue-500">{value}</p>
    </div>
  );
}

function StepSection({ number, title, children, theme }: { number: string, title: string, children: React.ReactNode, theme: Theme }) {
  return (
    <section className="relative pl-12">
      <div className={cn(
        "absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border",
        theme === 'dark' ? "bg-white/5 border-white/10 text-white/40" : "bg-slate-100 border-slate-200 text-slate-400"
      )}>
        {number}
      </div>
      <div className="space-y-4">
        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
        <div className={cn(
          "text-sm leading-relaxed",
          theme === 'dark' ? "text-white/60" : "text-slate-600"
        )}>
          {children}
        </div>
      </div>
    </section>
  );
}

function CalculationRow({ label, formula, result, theme }: { label: string, formula: string, result: string, theme: Theme }) {
  return (
    <div className={cn(
      "p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-6",
      theme === 'dark' ? "bg-white/5 border-white/5" : "bg-white border-slate-100 shadow-sm"
    )}>
      <div className="space-y-1">
        <p className={cn("text-[10px] font-bold uppercase tracking-widest", theme === 'dark' ? "text-white/40" : "text-slate-400")}>{label}</p>
        <div className="text-blue-500 overflow-x-auto">
          <InlineMath math={formula} />
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <ChevronRight className="w-4 h-4 text-white/20 hidden md:block" />
        <div className={cn(
          "px-4 py-2 rounded-xl font-mono text-sm font-bold",
          theme === 'dark' ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"
        )}>
          {result}
        </div>
      </div>
    </div>
  );
}
