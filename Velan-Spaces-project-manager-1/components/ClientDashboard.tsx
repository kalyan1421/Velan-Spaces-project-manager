
import React, { useEffect, useState } from 'react';
import { Project, ProjectUpdate, DesignDocument } from '../types';
import { subscribeToUpdates, addComment, updateDesignStatus, subscribeToDesigns } from '../services/firebase';
import { Header, Card, Button, Badge } from './Layouts';
import { format, isSameDay } from 'date-fns';
import { CheckCircle, MessageCircle, Send, Image as ImageIcon, AlertCircle, FileText, Download, Video } from 'lucide-react';
import { ProjectHeader } from './ProjectHeader';

export const ClientDashboard = ({ project, onLogout }: { project: Project, onLogout: () => void }) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'designs' | 'timeline'>('feed');
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [designs, setDesigns] = useState<DesignDocument[]>([]);
  const [commentText, setCommentText] = useState<{[key: string]: string}>({});

  useEffect(() => {
    const u1 = subscribeToUpdates(project.id, setUpdates);
    const u2 = subscribeToDesigns(project.id, setDesigns);
    return () => { u1(); u2(); };
  }, [project.id]);

  const handleApproveDesign = async (designId: string) => {
      if(confirm("Approve this design?")) {
          await updateDesignStatus(project.id, designId, { required: true, approved: true, approvedBy: 'Client', timestamp: new Date() });
      }
  };

  const handleComment = async (updateId: string) => {
      if(!commentText[updateId]) return;
      await addComment(project.id, updateId, {
          id: Date.now().toString(),
          author: 'Client',
          text: commentText[updateId],
          timestamp: new Date()
      });
      setCommentText({...commentText, [updateId]: ''});
  };

  return (
    <div className="min-h-screen elegant-bg font-sans">
      <Header title="Project Dashboard" onLogout={onLogout} />
      
      <main className="max-w-5xl mx-auto px-6 py-12">
          
        <ProjectHeader project={project} role="CLIENT" />

        {/* Tab Nav */}
        <div className="flex justify-center mb-10">
            <div className="bg-white p-1.5 rounded-full shadow-sm border border-neutral-100 inline-flex">
                {['feed', 'designs', 'timeline'].map(t => (
                    <button 
                        key={t} 
                        onClick={() => setActiveTab(t as any)}
                        className={`px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${activeTab === t ? 'bg-primary text-white shadow-md' : 'text-neutral-500 hover:bg-neutral-50'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>
        </div>

        {/* Content Area */}
        <div className="animate-in fade-in duration-500">
            {activeTab === 'feed' && (
                <div className="space-y-12 max-w-3xl mx-auto">
                    {updates.filter(u => u.isClientViewable).map((u, idx) => {
                        const date = u.timestamp?.toDate ? u.timestamp.toDate() : new Date();
                        return (
                            <div key={u.id} className="relative pl-10 border-l border-neutral-200 pb-8 last:pb-0">
                                <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-accent border-2 border-white shadow-sm"></div>
                                <div className="mb-2 text-xs font-bold text-neutral-400 uppercase tracking-widest">{format(date, 'MMMM do, h:mm a')}</div>
                                <Card className="hover:shadow-lg transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-xs">{u.postedBy.charAt(0)}</div>
                                            <div>
                                                <p className="font-bold text-sm">{u.postedBy}</p>
                                                <p className="text-[10px] text-accent-hover font-bold uppercase tracking-wider">{u.category}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-neutral-700 mb-4 leading-relaxed">{u.content}</p>
                                    {u.type === 'photo' && <img src={u.content} className="w-full rounded-lg mb-4" alt="update"/>}
                                    {u.type === 'video' && (
                                        <video controls className="w-full rounded-lg mb-4 bg-black max-h-96">
                                            <source src={u.content} />
                                            Your browser does not support the video tag.
                                        </video>
                                    )}
                                    
                                    {/* Simple Comment Section */}
                                    <div className="bg-neutral-50 -mx-6 -mb-6 p-4 border-t border-neutral-100 rounded-b-2xl">
                                        {u.comments.map(c => (
                                            <div key={c.id} className="mb-2 text-sm"><span className="font-bold">{c.author}:</span> {c.text}</div>
                                        ))}
                                        <div className="flex gap-2 mt-3">
                                            <input 
                                                className="flex-1 px-4 py-2 rounded-full border border-neutral-200 text-sm focus:border-accent outline-none" 
                                                placeholder="Leave a comment..."
                                                value={commentText[u.id] || ''}
                                                onChange={(e) => setCommentText({...commentText, [u.id]: e.target.value})}
                                            />
                                            <button onClick={() => handleComment(u.id)} className="w-9 h-9 bg-neutral-900 text-white rounded-full flex items-center justify-center hover:bg-accent hover:text-primary transition-colors"><Send size={14}/></button>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )
                    })}
                </div>
            )}

            {activeTab === 'designs' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {designs.map(d => (
                        <Card key={d.id}>
                             <div className="aspect-video bg-neutral-100 rounded-lg mb-4 overflow-hidden relative group">
                                 <img src={d.url} className="w-full h-full object-cover" alt={d.title}/>
                                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                     <a href={d.url} target="_blank" className="p-2 bg-white rounded-full hover:bg-accent"><Download size={20}/></a>
                                 </div>
                             </div>
                             <div className="flex justify-between items-start">
                                 <div>
                                     <h4 className="font-bold text-lg">{d.title}</h4>
                                     <p className="text-xs text-neutral-400 uppercase tracking-wide">{d.type}</p>
                                 </div>
                                 {d.approvalStatus.approved ? 
                                     <Badge color="green">Approved</Badge> : 
                                     d.approvalStatus.required ? 
                                     <Button onClick={() => handleApproveDesign(d.id)} variant="accent" className="text-xs py-1.5 px-4 h-auto">Approve</Button> : null
                                 }
                             </div>
                        </Card>
                    ))}
                </div>
            )}

            {activeTab === 'timeline' && (
                <Card className="max-w-2xl mx-auto">
                     <h3 className="font-serif font-bold text-xl mb-6 text-center">Project Timeline</h3>
                     <div className="space-y-8">
                         {project.timeline?.map((phase, idx) => (
                             <div key={idx} className="flex gap-4 relative">
                                 <div className="flex flex-col items-center">
                                     <div className={`w-4 h-4 rounded-full z-10 ${phase.status === 'COMPLETED' ? 'bg-green-500' : phase.status === 'IN_PROGRESS' ? 'bg-accent animate-pulse' : 'bg-neutral-200'}`}></div>
                                     {idx !== (project.timeline?.length || 0) - 1 && <div className="w-px bg-neutral-200 flex-1 my-1"></div>}
                                 </div>
                                 <div className="pb-8">
                                     <h4 className={`font-bold text-lg ${phase.status === 'PENDING' ? 'text-neutral-400' : 'text-primary'}`}>{phase.name}</h4>
                                     <p className="text-xs text-neutral-400 uppercase tracking-wider mt-1">Target: {phase.targetDate}</p>
      
                                     {phase.status === 'IN_PROGRESS' && <Badge color="yellow" className="mt-2 inline-block">Current Phase</Badge>}
                                 </div>
                             </div>
                         ))}
                     </div>
                </Card>
            )}
        </div>

      </main>
    </div>
  );
};
