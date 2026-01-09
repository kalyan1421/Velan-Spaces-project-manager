import React, { useState, useEffect } from 'react';
import { UserRole, Project, Manager } from './types';
import { 
    initAuth, subscribeToProjects, subscribeToManagerProjects, createProject, 
    getProjectById, subscribeToGlobalManagers, addGlobalManager, updateProjectFinancials,
    getWorkerById // Import getWorkerById
} from './services/firebase';
import { Header, Card, Button, Input, Badge, VelanLogo } from './components/Layouts';
import { ProjectOperationalView } from './components/ProjectOperationalView';
import { ClientDashboard } from './components/ClientDashboard';
import { WorkerDashboard } from './components/WorkerDashboard'; // Import WorkerDashboard
import { Users, Briefcase, Hammer, Plus, ChevronRight, Shield, ArrowRight, Check } from 'lucide-react';
import { ProjectHeader } from './components/ProjectHeader'; // Import ProjectHeader

// --- 2-STEP PROJECT WIZARD ---

const ProjectCreationWizard = ({ onClose, managers }: { onClose: () => void, managers: Manager[] }) => {
    const [step, setStep] = useState(1);
    const [data, setData] = useState<any>({});
    const [loading, setLoading] = useState(false);
    const [newManagerMode, setNewManagerMode] = useState(false);
    const [newManagerData, setNewManagerData] = useState<any>({});

    const handleNext = async () => {
        if (step === 1) {
            if (!data.projectName || !data.clientName) return alert("Please fill required fields");
            
            if (newManagerMode) {
                if (!newManagerData.name) {
                    return alert("Please enter manager details or cancel 'New Manager' mode.");
                }
                try {
                    // Auto-create manager and assign
                    const newId = await addGlobalManager(newManagerData);
                    setData((prev: any) => ({ ...prev, managerIds: [newId] }));
                    setNewManagerMode(false);
                } catch (e) {
                    console.error(e);
                    return alert("Failed to create manager. Please try again.");
                }
            }
            setStep(2);
        } else {
            setLoading(true);
            await createProject({ ...data, isComplete: data.isComplete || false }); 
            setLoading(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl overflow-hidden p-0">
                <div className="bg-primary p-6 text-white flex justify-between items-center">
                    <div>
                        <h2 className="font-serif font-bold text-2xl">Create New Project</h2>
                        <p className="text-white/60 text-sm mt-1">Step {step} of 2</p>
                    </div>
                    <div className="flex gap-2">
                        <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-accent' : 'bg-white/20'}`}></div>
                        <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-accent' : 'bg-white/20'}`}></div>
                    </div>
                </div>
                
                <div className="p-8">
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <Input label="Project Name" placeholder="e.g. Smith Residence 2025" value={data.projectName || ''} onChange={(e:any) => setData({...data, projectName: e.target.value})} required autoFocus />
                            <div className="grid grid-cols-2 gap-6">
                                <Input label="Client Name" placeholder="e.g. John Smith" value={data.clientName || ''} onChange={(e:any) => setData({...data, clientName: e.target.value})} required />
                                <Input label="Location" placeholder="e.g. Downtown, NY" value={data.location || ''} onChange={(e:any) => setData({...data, location: e.target.value})} />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Assign Manager</label>
                                {!newManagerMode ? (
                                    <div className="flex gap-2">
                                        <select 
                                            className="w-full p-3 border border-neutral-200 rounded-xl bg-neutral-50"
                                            onChange={(e) => setData({...data, managerIds: [e.target.value]})}
                                            value={data.managerIds?.[0] || ''}
                                        >
                                            <option value="">-- Select Manager --</option>
                                            {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                        <Button variant="outline" onClick={() => setNewManagerMode(true)} className="whitespace-nowrap">New Manager</Button>
                                    </div>
                                ) : (
                                    <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                                        <h4 className="font-bold text-sm mb-3">Quick Create Manager</h4>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <Input label="Name" onChange={(e:any) => setNewManagerData({...newManagerData, name: e.target.value})} />
                                            <Input label="ID (e.g. MGR01)" onChange={(e:any) => setNewManagerData({...newManagerData, id: e.target.value})} />
                                        </div>
                                        <Input label="Password" type="password" onChange={(e:any) => setNewManagerData({...newManagerData, passwordHash: e.target.value})} />
                                        <div className="flex justify-end gap-2 mt-4">
                                            <Button variant="ghost" onClick={() => setNewManagerMode(false)} className="text-xs py-2">Cancel</Button>
                                            {/* Removed Save button requirement; Next handles it */}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                         <div className="space-y-6 animate-in slide-in-from-right duration-300">
                             <div className="text-center mb-8">
                                 <h3 className="font-serif font-bold text-xl">Financial Setup</h3>
                                 <p className="text-neutral-500 text-sm">Set the initial budget goals for {data.projectName}</p>
                             </div>
                             <div className="grid grid-cols-2 gap-6">
                                 <Input label="Approved Budget (₹)" type="number" placeholder="0" value={data.budget || ''} onChange={(e:any) => setData({...data, budget: e.target.value})} />
                             </div>
                             <div className="flex items-center mt-4">
                                <input
                                    type="checkbox"
                                    id="isComplete"
                                    checked={data.isComplete || false}
                                    onChange={(e) => setData({...data, isComplete: e.target.checked})}
                                    className="h-4 w-4 text-accent focus:ring-accent border-gray-300 rounded"
                                />
                                <label htmlFor="isComplete" className="ml-2 block text-sm text-gray-900">
                                    Mark as Completed
                                </label>
                            </div>
                         </div>
                    )}
                </div>

                <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex justify-between items-center">
                     <Button variant="ghost" onClick={onClose}>Cancel</Button>
                     <Button onClick={handleNext} variant="accent" disabled={loading} className="w-32">
                         {step === 1 ? 'Next' : 'Create Project'}
                     </Button>
                </div>
            </Card>
        </div>
    );
};

// --- HEAD DASHBOARD ---

const HeadDashboard = ({ onLogout }: { onLogout: () => void }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [managers, setManagers] = useState<Manager[]>([]);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    useEffect(() => {
        const u1 = subscribeToProjects(setProjects);
        const u2 = subscribeToGlobalManagers(setManagers);
        return () => { u1(); u2(); };
    }, []);

    if (selectedProject) {
        return (
            <div className="min-h-screen bg-surface-alt">
                <Header title="Administrator" onLogout={onLogout} />
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <button onClick={() => setSelectedProject(null)} className="mb-6 text-neutral-400 hover:text-primary flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-colors">
                        <ArrowRight className="rotate-180" size={16}/> Back to Dashboard
                    </button>
                    <ProjectHeader project={selectedProject} role="HEAD" />
                    <ProjectOperationalView project={selectedProject} role="HEAD" currentUserId="admin" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-alt">
            <Header title="Admin Dashboard" subtitle="Overview" onLogout={onLogout} />
            <main className="max-w-7xl mx-auto px-6 py-12">
                <div className="flex justify-between items-end mb-10">
                    <div>
                        <h2 className="font-serif font-bold text-3xl text-primary mb-2">Projects</h2>
                        <p className="text-neutral-500">Manage your active sites and financial health.</p>
                    </div>
                    <Button onClick={() => setIsWizardOpen(true)} variant="primary" className="shadow-velan hover:shadow-lg transform hover:-translate-y-1">
                        <Plus size={18} className="inline mr-2"/> Create Project
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(p => {
                        const health = p.currentSpend > p.budget ? 'red' : 'green';
                        return (
                            <Card key={p.id} onClick={() => setSelectedProject(p)} className="cursor-pointer group hover:border-accent transition-all hover:-translate-y-1">
                                <div className="flex justify-between items-start mb-4">
                                    <Badge color="neutral">{p.id}</Badge>
                                    <div className={`w-2 h-2 rounded-full ${health === 'red' ? 'bg-red-500' : 'bg-green-500'} shadow-[0_0_8px_currentColor]`}></div>
                                </div>
                                <h3 className="font-serif font-bold text-xl mb-1 group-hover:text-accent-hover transition-colors">{p.projectName}</h3>
                                <p className="text-neutral-500 text-sm mb-6">{p.clientName}</p>
                                <div className="flex justify-between items-center border-t border-neutral-100 pt-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Budget</p>
                                        <p className="font-mono font-bold text-primary">₹{p.budget.toLocaleString()}</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center group-hover:bg-accent transition-colors">
                                        <ChevronRight size={16}/>
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                </div>

                {isWizardOpen && <ProjectCreationWizard onClose={() => setIsWizardOpen(false)} managers={managers} />}
            </main>
        </div>
    );
};

const ManagerDashboard = ({ currentUser, onLogout }: { currentUser: any, onLogout: () => void }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    useEffect(() => {
        const unsub = subscribeToManagerProjects(currentUser.id, setProjects);
        return () => unsub();
    }, [currentUser.id]);

    if (selectedProject) {
        return (
            <div className="min-h-screen bg-surface-alt">
                <Header title="Manager" onLogout={onLogout} />
                <div className="max-w-7xl mx-auto px-6 py-8">
                     <button onClick={() => setSelectedProject(null)} className="mb-6 text-neutral-400 hover:text-primary flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-colors">
                        <ArrowRight className="rotate-180" size={16}/> Back to My Projects
                    </button>
                    <ProjectHeader project={selectedProject} role="MANAGER" />
                    <ProjectOperationalView project={selectedProject} role="MANAGER" currentUserId={currentUser.id} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-alt">
            <Header title={`Hello, ${currentUser.name}`} subtitle="Manager Portal" onLogout={onLogout} />
            <main className="max-w-5xl mx-auto px-6 py-12">
                 <h2 className="font-serif font-bold text-2xl text-primary mb-8">Assigned Projects</h2>
                 <div className="grid gap-4">
                    {projects.map(p => (
                        <Card key={p.id} onClick={() => setSelectedProject(p)} className="flex items-center justify-between cursor-pointer group hover:border-accent transition-colors">
                             <div>
                                 <h3 className="font-bold text-lg group-hover:text-accent-hover">{p.projectName}</h3>
                                 <p className="text-neutral-500 text-sm">{p.location} • {p.clientName}</p>
                             </div>
                             <ChevronRight className="text-neutral-300 group-hover:text-primary"/>
                        </Card>
                    ))}
                 </div>
            </main>
        </div>
    );
};

// --- LOGIN & MAIN ---

const App = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [clientProject, setClientProject] = useState<Project | null>(null);

  // Login State
  const [loginMode, setLoginMode] = useState<'CLIENT' | 'MANAGER' | 'HEAD' | 'WORKER'>('CLIENT'); // Add WORKER
  const [inputId, setInputId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { 
      initAuth(); 
      
      // Auto-login for client via URL path
      // Format: domain.com/PRJ12345 or domain.com/projectmanager/PRJ12345
      const pathSegments = window.location.pathname.split('/').filter(Boolean);
      const possibleId = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : null;
      
      if (possibleId && possibleId.startsWith('PRJ')) {
          getProjectById(possibleId).then(p => {
              if (p) {
                  setRole('CLIENT');
                  setClientProject(p);
              }
          });
      }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (loginMode === 'CLIENT') {
        if(!inputId) return;
        const p = await getProjectById(inputId.trim());
        if (p) { setRole('CLIENT'); setClientProject(p); } else { setError('Invalid Project ID'); }
    } else if (loginMode === 'HEAD') {
        if (inputId === 'admin' && password === '12345') { setRole('HEAD'); setCurrentUser({id:'admin'}); } else { setError('Invalid Admin Credentials'); }
    } else if (loginMode === 'MANAGER') {
        // Simplified Manager login
        if(inputId && password) { setRole('MANAGER'); setCurrentUser({id: inputId, name: 'Manager'}); } 
    } else if (loginMode === 'WORKER') { // New: Worker login logic
        if(!inputId) return;
        const worker = await getWorkerById(inputId.trim());
        // For simplicity, no password check for workers yet
        if (worker) { setRole('WORKER'); setCurrentUser(worker); } else { setError('Invalid Worker ID'); }
    }
  };

  if (role === 'HEAD') return <HeadDashboard onLogout={() => setRole(null)} />;
  if (role === 'MANAGER') return <ManagerDashboard currentUser={currentUser} onLogout={() => setRole(null)} />;
  if (role === 'CLIENT' && clientProject) return <ClientDashboard project={clientProject} onLogout={() => setRole(null)} />;
  if (role === 'WORKER') return <WorkerDashboard currentUser={currentUser} onLogout={() => setRole(null)} />; // Render WorkerDashboard

  return (
    <div className="min-h-screen bg-white flex flex-col">
       <div className="p-8 flex justify-between items-center">
           <VelanLogo />
           <div className="flex gap-6 text-xs font-bold uppercase tracking-widest text-neutral-400">
               <button onClick={() => setLoginMode('CLIENT')} className={loginMode === 'CLIENT' ? 'text-accent-hover' : 'hover:text-primary'}>Client</button>
               <button onClick={() => setLoginMode('MANAGER')} className={loginMode === 'MANAGER' ? 'text-accent-hover' : 'hover:text-primary'}>Manager</button>
               <button onClick={() => setLoginMode('HEAD')} className={loginMode === 'HEAD' ? 'text-accent-hover' : 'hover:text-primary'}>Admin</button>
               <button onClick={() => setLoginMode('WORKER')} className={loginMode === 'WORKER' ? 'text-accent-hover' : 'hover:text-primary'}>Worker</button>
           </div>
       </div>
       
       <div className="flex-1 flex items-center justify-center p-6">
           <div className="w-full max-w-md text-center">
               <h1 className="font-serif font-bold text-4xl mb-2 text-primary">
                   {loginMode === 'CLIENT' ? 'View Project' : loginMode === 'MANAGER' ? 'Manager Portal' : loginMode === 'WORKER' ? 'Worker Login' : 'Admin Access'}
               </h1>
               <p className="text-neutral-400 mb-10 text-sm tracking-wide uppercase">
                   {loginMode === 'CLIENT' ? 'Enter your ID to track progress' : 'Sign in to manage workspace'}
               </p>

               <form onSubmit={handleLogin} className="space-y-5 text-left">
                   {loginMode === 'CLIENT' ? (
                       <div className="relative group">
                           <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                           <input 
                               className="relative w-full bg-neutral-50 border-2 border-neutral-100 rounded-2xl py-5 text-center text-2xl font-serif font-bold tracking-widest uppercase focus:border-accent focus:ring-0 outline-none transition-all placeholder:text-neutral-300" 
                               placeholder="PRJ-ID"
                               value={inputId}
                               onChange={(e) => setInputId(e.target.value)}
                           />
                       </div>
                   ) : (
                       <>
                           <Input label={loginMode === 'HEAD' ? "Username" : (loginMode === 'MANAGER' ? "Manager ID" : "Worker ID")} value={inputId} onChange={(e:any) => setInputId(e.target.value)} />
                           {loginMode !== 'WORKER' && ( // Workers don't need password yet
                               <Input label="Password" type="password" value={password} onChange={(e:any) => setPassword(e.target.value)} />
                           )}
                       </>
                   )}
                   
                   {error && <div className="text-red-500 text-xs text-center font-bold uppercase tracking-wider">{error}</div>}
                   
                   <Button type="submit" variant="primary" className="w-full py-4 text-sm uppercase tracking-widest shadow-velan mt-4">
                       Enter Workspace
                   </Button>
               </form>
           </div>
       </div>
    </div>
  );
};


export default App;