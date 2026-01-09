import React, { useState, useEffect } from 'react';
import { Project, ProjectUpdate, UserRole, TimelinePhase, TimelineTask, Worker, Settlement, DesignDocument, Manager, Room } from '../types';
import { 
    subscribeToUpdates, addUpdate, updateTimeline, 
    assignWorkerToProject, subscribeToGlobalWorkers, addGlobalWorker,
    subscribeToSettlements, addSettlement,
    subscribeToDesigns, addDesign, updateDesignStatus, updateProjectFinancials,
    uploadProjectFile, subscribeToRooms, addRoom, updateRoom
} from '../services/firebase';
import { Card, Button, Input, Badge } from './Layouts';
import { Send, Image, FileText, DollarSign, MessageSquare, Clock, Users, Plus, Trash2, CheckCircle, AlertCircle, Briefcase, Download, ArrowUpRight, Paperclip, X, Video, Home, ChevronDown, ChevronRight, Calendar, Target, Edit2 } from 'lucide-react';
import { format, isSameDay, differenceInDays, isPast, isToday } from 'date-fns';

interface Props {
  project: Project;
  role: UserRole;
  currentUserId?: string;
}

export const ProjectOperationalView: React.FC<Props> = ({ project, role, currentUserId }) => {
  const [activeTab, setActiveTab] = useState<'updates' | 'designs' | 'timeline' | 'workers' | 'settlements' | 'budget' | 'rooms'>(
    role === 'WORKER' ? 'updates' : 'updates'
  );
  
  // Data States
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [designs, setDesigns] = useState<DesignDocument[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [phases, setPhases] = useState<TimelinePhase[]>(project.timeline || []);
  const [globalWorkers, setGlobalWorkers] = useState<Worker[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]); // New: State for rooms
  
  // --- UPDATE TAB STATE ---
  const [newUpdateText, setNewUpdateText] = useState('');
  const [updateType, setUpdateType] = useState<'message' | 'photo' | 'video'>('message');
  const [category, setCategory] = useState<string>('General');
  const [updateFile, setUpdateFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedUpdateWorkerIds, setSelectedUpdateWorkerIds] = useState<string[]>([]);
  const [selectedRoomIdForUpdate, setSelectedRoomIdForUpdate] = useState<string | undefined>(undefined); // New: State for room tagging

  // --- DESIGN TAB STATE ---
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [designData, setDesignData] = useState<Partial<DesignDocument>>({ type: '2D Plan', approvalStatus: { required: false, approved: false } });
  const [designFile, setDesignFile] = useState<File | null>(null);

  // --- WORKER TAB STATE ---
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [workerMode, setWorkerMode] = useState<'select' | 'create'>('select');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [newWorkerData, setNewWorkerData] = useState<Partial<Worker>>({});

  // --- SETTLEMENT TAB STATE ---
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementData, setSettlementData] = useState<Partial<Settlement>>({ mode: 'Cash', paidToType: 'Worker' });

  // --- ROOM TAB STATE ---
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [newRoomData, setNewRoomData] = useState<Partial<Room>>({});
  const [selectedRoomForWorkerAssignment, setSelectedRoomForWorkerAssignment] = useState<Room | null>(null);
  const [selectedWorkersForRoom, setSelectedWorkersForRoom] = useState<string[]>([]);
  const [isAssignWorkerToRoomModalOpen, setIsAssignWorkerToRoomModalOpen] = useState(false);

  // --- BUDGET TAB STATE ---
  const [editBudgetMode, setEditBudgetMode] = useState(false);
  const [tempBudget, setTempBudget] = useState({ cost: project.estimatedCost, budget: project.budget });

  // --- TIMELINE TAB STATE ---
  const [expandedPhases, setExpandedPhases] = useState<string[]>([]);
  const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingPhaseIndex, setEditingPhaseIndex] = useState<number | null>(null);
  const [selectedPhaseForTask, setSelectedPhaseForTask] = useState<number | null>(null);
  const [newPhaseData, setNewPhaseData] = useState<Partial<TimelinePhase>>({ 
    name: '', 
    description: '', 
    startDate: '', 
    targetDate: '', 
    status: 'PENDING',
    tasks: [] 
  });
  const [newTaskData, setNewTaskData] = useState<Partial<TimelineTask>>({
    title: '',
    description: '',
    startDate: '',
    targetDate: '',
    status: 'PENDING',
    assignedWorkerIds: []
  });

  useEffect(() => {
    if (role === 'WORKER' && !['updates', 'designs', 'timeline'].includes(activeTab)) {
      setActiveTab('updates');
    }
  }, [activeTab, role]);

  useEffect(() => {
    const unsub1 = subscribeToUpdates(project.id, setUpdates);
    const unsub2 = subscribeToDesigns(project.id, setDesigns);
    const unsub3 = subscribeToSettlements(project.id, setSettlements);
    const unsub4 = subscribeToGlobalWorkers(setGlobalWorkers);
    const unsub5 = subscribeToRooms(project.id, setRooms); // New: Subscribe to rooms
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [project.id]);

  // --- Handlers ---

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    let contentUrl = '';
    
    if (updateType !== 'message' && updateFile) {
        try {
            contentUrl = await uploadProjectFile(updateFile, project.id);
        } catch (error) {
            console.error(error);
            alert("Error uploading file");
            setIsUploading(false);
            return;
        }
    } else {
        contentUrl = newUpdateText;
    }

    await addUpdate(project.id, {
      postedBy: role === 'HEAD' ? 'Head Designer' : 'Project Manager',
      role: role,
      type: updateType,
      content: contentUrl,
      isClientViewable: true,
      category: category,
      comments: [],
      associatedWorkerIds: selectedUpdateWorkerIds,
      roomId: selectedRoomIdForUpdate // New: Add roomId to update
    });
    setNewUpdateText(''); setUpdateFile(null); setSelectedUpdateWorkerIds([]); setSelectedRoomIdForUpdate(undefined); setIsUploading(false);
  };

  const handleAddDesign = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!designFile && !designData.url) return alert("Please select a file or provide URL");
      
      setIsUploading(true);
      let url = designData.url || '';
      if (designFile) {
          try {
              url = await uploadProjectFile(designFile, project.id);
          } catch (error) {
              console.error(error);
              alert("Upload failed");
              setIsUploading(false);
              return;
          }
      }

      await addDesign(project.id, {
          ...designData,
          url,
          postedBy: role === 'HEAD' ? 'Head Designer' : 'Project Manager',
          projectId: project.id
      });
      setIsDesignModalOpen(false); setDesignData({ type: '2D Plan', approvalStatus: { required: false, approved: false } }); setDesignFile(null); setIsUploading(false);
  };

  const handleAddWorker = async () => {
      if (workerMode === 'select') {
          if(selectedWorkerId) await assignWorkerToProject(project.id, selectedWorkerId);
      } else {
          await addGlobalWorker(newWorkerData);
          // Worker created successfully
          
          setWorkerMode('select');
      }
      setIsWorkerModalOpen(false);
  };

  const handleAddSettlement = async (e: React.FormEvent) => {
      e.preventDefault();
      await addSettlement(project.id, {
          ...settlementData,
          createdBy: currentUserId,
          projectId: project.id
      });
      setIsSettlementModalOpen(false);
      setSettlementData({ mode: 'Cash', paidToType: 'Worker' });
  };

  const handleAddRoom = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newRoomData.name || !newRoomData.type) {
          alert("Please fill all room details.");
          return;
      }
      await addRoom(project.id, { ...newRoomData, assignedWorkerIds: [] });
      setIsRoomModalOpen(false);
      setNewRoomData({});
  };

  const handleAssignWorkersToRoom = async () => {
      if (!selectedRoomForWorkerAssignment) return;
      await updateRoom(project.id, selectedRoomForWorkerAssignment.id, { assignedWorkerIds: selectedWorkersForRoom });
      setIsAssignWorkerToRoomModalOpen(false);
      setSelectedRoomForWorkerAssignment(null);
      setSelectedWorkersForRoom([]);
  };

  const handleSaveBudget = async () => {
      await updateProjectFinancials(project.id, tempBudget.cost, tempBudget.budget);
      setEditBudgetMode(false);
  };

  // --- RENDERERS ---

  const renderUpdatesTab = () => {
      const projectWorkers = globalWorkers.filter(w => project.workerIds?.includes(w.id));

      return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Post Form */}
          {role !== 'WORKER' && (
          <div className="lg:col-span-1">
              <Card className="sticky top-28">
                  <h3 className="font-serif font-bold text-lg mb-4">Daily Update</h3>
                  <form onSubmit={handlePostUpdate} className="space-y-4">
                      <div className="flex bg-neutral-50 p-1 rounded-lg">
                          {['message', 'photo', 'video'].map((t) => (
                              <button key={t} type="button" onClick={() => setUpdateType(t as any)} className={`flex-1 capitalize py-2 text-xs font-bold rounded-md transition-colors ${updateType === t ? 'bg-white shadow text-primary' : 'text-neutral-400'}`}>{t}</button>
                          ))}
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-neutral-400 uppercase">Category</label>
                          <select className="w-full mt-1 p-2 border rounded-lg bg-white text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                              <option>General</option>
                              <option>Civil</option>
                              <option>Electrical</option>
                              <option>Carpentry</option>
                              <option>Painting</option>
                              <option>Glass Work</option>
                              <option>Deco Work</option>
                              <option>Tiles</option>
                              <option>Granite</option>
                              <option>Plumbing</option>
                              <option>Welding</option>
                              <option>Fall Ceiling</option>
                              <option>AC Works</option>
                              <option>Solar Works</option>
                              <option>Lighting Works</option>
                          </select>
                      </div>
                      {/* Room Tagging */}
                      <div>
                          <label className="text-[10px] font-bold text-neutral-400 uppercase">Tag Room (Optional)</label>
                          <select 
                             className="w-full mt-1 p-2 border rounded-lg bg-white text-sm" 
                             value={selectedRoomIdForUpdate || ''} 
                             onChange={(e) => setSelectedRoomIdForUpdate(e.target.value || undefined)}
                          >
                              <option value="">-- Select Room --</option>
                              {rooms.map(room => (
                                  <option key={room.id} value={room.id}>{room.name}</option>
                              ))}
                          </select>
                      </div>
                      {updateType === 'message' ? (
                          <Input placeholder="What work was done today?" value={newUpdateText} onChange={(e:any) => setNewUpdateText(e.target.value)} required />
                      ) : (
                          <>
                             <Input placeholder="Description" value={newUpdateText} onChange={(e:any) => setNewUpdateText(e.target.value)} required />
                             <div className="border-2 border-dashed border-neutral-200 rounded-lg p-4 text-center">
                                 <input 
                                    type="file" 
                                    accept={updateType === 'video' ? "video/*" : "image/*"} 
                                    onChange={(e) => setUpdateFile(e.target.files?.[0] || null)} 
                                    className="hidden" 
                                    id="update-file"
                                 />
                                 <label htmlFor="update-file" className="cursor-pointer text-sm text-neutral-500 flex flex-col items-center gap-2">
                                     {updateType === 'video' ? <Video size={20}/> : <Paperclip size={20}/>}
                                     {updateFile ? updateFile.name : `Click to select ${updateType}`}
                                 </label>
                             </div>
                          </>
                      )}

                      {/* Worker Tagging - Shows ALL workers from global list */}
                      <div>
                          <label className="text-[10px] font-bold text-neutral-400 uppercase">Tag Workers (Optional)</label>
                          <div className="flex flex-wrap gap-2 mt-2 mb-2">
                              {selectedUpdateWorkerIds.map(id => {
                                  const w = globalWorkers.find(gw => gw.id === id);
                                  return (
                                      <span key={id} className="bg-neutral-100 text-neutral-600 text-xs px-2 py-1 rounded-full flex items-center gap-1 border border-neutral-200">
                                          {w?.name || 'Unknown'}
                                          <button type="button" className="hover:text-red-500" onClick={() => setSelectedUpdateWorkerIds(prev => prev.filter(pid => pid !== id))}><X size={12}/></button>
                                      </span>
                                  )
                              })}
                          </div>
                          <select 
                             className="w-full p-2 border rounded-lg bg-white text-sm text-neutral-600 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                             onChange={(e) => {
                                if(e.target.value && !selectedUpdateWorkerIds.includes(e.target.value)) {
                                    setSelectedUpdateWorkerIds([...selectedUpdateWorkerIds, e.target.value]);
                                }
                                e.target.value = '';
                             }}
                          >
                              <option value="">+ Add Worker</option>
                              {globalWorkers.filter(w => !selectedUpdateWorkerIds.includes(w.id)).map(w => (
                                  <option key={w.id} value={w.id}>{w.name} ({w.role})</option>
                              ))}
                          </select>
                      </div>

                      <Button type="submit" variant="accent" className="w-full" disabled={isUploading}>{isUploading ? 'Posting...' : 'Post Update'}</Button>
                  </form>
              </Card>
          </div>
          )}
          {/* Feed */}
          <div className={role === 'WORKER' ? 'lg:col-span-3' : 'lg:col-span-2 space-y-6'}>
              {updates.map((u, idx) => {
                  const date = u.timestamp?.toDate ? u.timestamp.toDate() : new Date();
                  const showDate = idx === 0 || !isSameDay(date, updates[idx-1].timestamp?.toDate());
                  const taggedWorkers = u.associatedWorkerIds?.map(id => globalWorkers.find(gw => gw.id === id)?.name).filter(Boolean).join(', ');
                  const taggedRoom = u.roomId ? rooms.find(room => room.id === u.roomId)?.name : null;
                  
                  return (
                      <div key={u.id}>
                          {showDate && <div className="flex items-center gap-4 mb-6 mt-2"><div className="h-px bg-neutral-200 flex-1"></div><span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{format(date, 'MMMM do')}</span><div className="h-px bg-neutral-200 flex-1"></div></div>}
                          <Card className="flex gap-4">
                              <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center text-neutral-400 shrink-0">
                                  {u.type === 'photo' ? <Image size={18}/> : u.type === 'video' ? <Video size={18}/> : <MessageSquare size={18}/>}
                              </div>
                              <div className="flex-1">
                                  <div className="flex justify-between">
                                      <h4 className="font-bold text-sm">{u.postedBy} <span className="font-normal text-neutral-400 mx-2">•</span> <span className="text-accent-hover text-xs uppercase tracking-wide">{u.category}</span></h4>
                                      <span className="text-xs text-neutral-400">{format(date, 'h:mm a')}</span>
                                  </div>
                                  {taggedRoom && (
                                      <div className="mt-1 flex items-center gap-2">
                                          <Home size={12} className="text-neutral-400"/>
                                          <span className="text-xs text-neutral-500 font-medium">Room: <span className="text-primary">{taggedRoom}</span></span>
                                      </div>
                                  )}
                                  {taggedWorkers && (
                                      <div className="mt-1 mb-2 flex items-center gap-2">
                                          <Users size={12} className="text-neutral-400"/>
                                          <span className="text-xs text-neutral-500 font-medium">With: <span className="text-primary">{taggedWorkers}</span></span>
                                      </div>
                                  )}
                                  <p className="text-neutral-700 mt-2 text-sm leading-relaxed">{u.content.startsWith('http') ? (u.type === 'message' ? u.content : '') : u.content}</p>
                                  {u.type === 'photo' && u.content.startsWith('http') && <img src={u.content} alt="update" className="mt-3 rounded-lg border border-neutral-100 max-h-80 object-cover" />}
                                  {u.type === 'video' && u.content.startsWith('http') && (
                                      <video controls className="mt-3 rounded-lg border border-neutral-100 max-h-80 w-full bg-black">
                                          <source src={u.content} />
                                          Your browser does not support the video tag.
                                      </video>
                                  )}
                              </div>
                          </Card>
                      </div>
                  )
              })}
          </div>
      </div>
  )};

  const renderRoomsTab = () => {
      const projectWorkers = globalWorkers.filter(w => project.workerIds?.includes(w.id)); // All workers assigned to the project

      return (
      <div>
          <div className="flex justify-between items-center mb-6">
              <h3 className="font-serif font-bold text-xl">Project Rooms</h3>
              {role !== 'WORKER' && <Button onClick={() => setIsRoomModalOpen(true)} variant="primary" className="flex items-center gap-2"><Plus size={16}/> Add Room</Button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map(room => (
                  <Card key={room.id} className="flex flex-col gap-4">
                      <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0">
                              <Home size={18}/>
                          </div>
                          <div>
                              <h4 className="font-bold text-lg">{room.name}</h4>
                              <p className="text-sm text-neutral-500">{room.type}</p>
                          </div>
                      </div>
                      <div className="border-t border-neutral-100 pt-4 mt-auto">
                          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Assigned Workers:</p>
                          <div className="flex flex-wrap gap-2">
                              {room.assignedWorkerIds && room.assignedWorkerIds.length > 0 ? (
                                  room.assignedWorkerIds.map(workerId => {
                                      const worker = projectWorkers.find(w => w.id === workerId);
                                      return worker ? <Badge key={workerId}>{worker.name}</Badge> : null;
                                  })
                              ) : (
                                  <span className="text-sm text-neutral-500">No workers assigned</span>
                              )}
                          </div>
                          {role !== 'WORKER' && 
                            <Button 
                                variant="outline" 
                                className="mt-4 w-full text-xs" 
                                onClick={() => {
                                    setSelectedRoomForWorkerAssignment(room);
                                    setSelectedWorkersForRoom(room.assignedWorkerIds || []);
                                    setIsAssignWorkerToRoomModalOpen(true);
                                }}
                            >
                                <Users size={14} className="inline mr-2"/> Assign Workers
                            </Button>
                          }
                      </div>
                  </Card>
              ))}
          </div>

          {isRoomModalOpen && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                  <Card className="w-full max-w-md">
                      <h3 className="font-bold text-lg mb-4">Add New Room</h3>
                      <form onSubmit={handleAddRoom} className="space-y-4">
                          <Input label="Room Name" value={newRoomData.name || ''} onChange={(e:any) => setNewRoomData({...newRoomData, name: e.target.value})} required />
                          <Input label="Room Type" value={newRoomData.type || ''} onChange={(e:any) => setNewRoomData({...newRoomData, type: e.target.value})} required />
                          <div className="flex justify-end gap-2 mt-6">
                              <Button variant="ghost" onClick={() => setIsRoomModalOpen(false)}>Cancel</Button>
                              <Button type="submit" variant="primary">Add Room</Button>
                          </div>
                      </form>
                  </Card>
              </div>
          )}

          {isAssignWorkerToRoomModalOpen && selectedRoomForWorkerAssignment && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                  <Card className="w-full max-w-md">
                      <h3 className="font-bold text-lg mb-4">Assign Workers to {selectedRoomForWorkerAssignment.name}</h3>
                      <div className="space-y-4">
                          <p className="text-sm text-neutral-600">Select workers to assign to this room. Already assigned workers are pre-selected.</p>
                          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto border border-neutral-200 p-3 rounded-lg">
                              {projectWorkers.map(worker => (
                                  <label key={worker.id} className="flex items-center gap-3 cursor-pointer">
                                      <input
                                          type="checkbox"
                                          checked={selectedWorkersForRoom.includes(worker.id)}
                                          onChange={(e) => {
                                              if (e.target.checked) {
                                                  setSelectedWorkersForRoom([...selectedWorkersForRoom, worker.id]);
                                              } else {
                                                  setSelectedWorkersForRoom(selectedWorkersForRoom.filter(id => id !== worker.id));
                                              }
                                          }}
                                          className="form-checkbox h-4 w-4 text-accent rounded"
                                      />
                                      <span className="text-neutral-700">{worker.name} ({worker.role})</span>
                                  </label>
                              ))}
                          </div>
                          <div className="flex justify-end gap-2 mt-6">
                              <Button variant="ghost" onClick={() => setIsAssignWorkerToRoomModalOpen(false)}>Cancel</Button>
                              <Button type="button" variant="primary" onClick={handleAssignWorkersToRoom}>Assign Workers</Button>
                          </div>
                      </div>
                  </Card>
              </div>
          )}
      </div>
  );
  };

  const renderDesignsTab = () => (
      <div className="space-y-6">
          <div className="flex justify-between items-center">
              <h3 className="font-serif font-bold text-xl">Project Documents</h3>
              {role !== 'WORKER' && <Button onClick={() => setIsDesignModalOpen(true)} variant="primary" className="flex items-center gap-2"><Plus size={16}/> Upload Design</Button>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {designs.map(d => (
                  <Card key={d.id} className="group hover:border-accent transition-colors">
                      <div className="aspect-video bg-neutral-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden relative">
                          <img src={d.url} alt={d.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"/>
                          <div className="absolute top-2 right-2">
                             {d.approvalStatus.approved ? <Badge color="green">Approved</Badge> : d.approvalStatus.required ? <Badge color="yellow">Pending</Badge> : null}
                          </div>
                      </div>
                      <h4 className="font-bold text-lg mb-1">{d.title}</h4>
                      <p className="text-xs text-neutral-400 uppercase tracking-wide mb-4">{d.type}</p>
                      <div className="flex justify-between items-center border-t border-neutral-100 pt-4">
                          <span className="text-xs text-neutral-400">{format(d.timestamp?.toDate(), 'MMM d')}</span>
                          <a href={d.url} target="_blank" className="text-sm font-bold text-primary hover:text-accent-hover flex items-center gap-1">View <ArrowUpRight size={14}/></a>
                      </div>
                  </Card>
              ))}
          </div>

          {isDesignModalOpen && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                  <Card className="w-full max-w-md">
                      <h3 className="font-bold text-lg mb-4">Upload Design Document</h3>
                      <form onSubmit={handleAddDesign} className="space-y-4">
                          <Input label="Title" value={designData.title || ''} onChange={(e:any) => setDesignData({...designData, title: e.target.value})} required />
                          <div className="mb-4">
                              <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Type</label>
                              <select className="w-full p-3 border rounded-xl" value={designData.type} onChange={(e:any) => setDesignData({...designData, type: e.target.value})}>
                                  <option>2D Plan</option>
                                  <option>3D Render</option>
                              </select>
                          </div>
                          <div className="mb-4">
                               <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">File</label>
                               <input type="file" onChange={(e) => setDesignFile(e.target.files?.[0] || null)} className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-primary hover:file:bg-neutral-200"/>
                          </div>
                          <div className="flex items-center gap-2 my-4">
                              <input type="checkbox" checked={designData.approvalStatus?.required} onChange={(e) => setDesignData({...designData, approvalStatus: { required: e.target.checked, approved: false }})} className="w-4 h-4 accent-accent"/>
                              <label className="text-sm">Requires Client Approval</label>
                          </div>
                          <div className="flex justify-end gap-2">
                              <Button variant="ghost" onClick={() => setIsDesignModalOpen(false)}>Cancel</Button>
                              <Button type="submit" variant="primary" disabled={isUploading}>{isUploading ? 'Uploading...' : 'Upload'}</Button>
                          </div>
                      </form>
                  </Card>
              </div>
          )}
      </div>
  );

  const renderWorkersTab = () => {
      const assignedWorkers = globalWorkers.filter(w => project.workerIds?.includes(w.id));
      return (
          <div>
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-serif font-bold text-xl">Site Team</h3>
                  {role !== 'WORKER' && <Button onClick={() => setIsWorkerModalOpen(true)} variant="primary" className="flex items-center gap-2"><Plus size={16}/> Assign Worker</Button>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assignedWorkers.map(w => (
                      <Card key={w.id} className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center font-bold text-lg">{w.name.charAt(0)}</div>
                          <div>
                              <h4 className="font-bold text-lg">{w.name}</h4>
                              <p className="text-sm text-accent-hover font-medium">{w.role}</p>
                              <p className="text-xs text-neutral-500 mt-1">{w.phone} • {w.type}</p>
                          </div>
                      </Card>
                  ))}
              </div>

              {isWorkerModalOpen && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                      <Card className="w-full max-w-md">
                          <h3 className="font-bold text-lg mb-4">Manage Team</h3>
                          <div className="flex gap-2 mb-4">
                              <Button variant={workerMode === 'select' ? 'primary' : 'ghost'} onClick={() => setWorkerMode('select')} className="flex-1 py-2 text-xs">Select Existing</Button>
                              <Button variant={workerMode === 'create' ? 'primary' : 'ghost'} onClick={() => setWorkerMode('create')} className="flex-1 py-2 text-xs">Create New</Button>
                          </div>
                          
                          {workerMode === 'select' ? (
                              <div className="space-y-4">
                                  <select className="w-full p-3 border rounded-xl" onChange={(e) => setSelectedWorkerId(e.target.value)}>
                                      <option value="">-- Select Worker --</option>
                                      {globalWorkers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.role})</option>)}
                                  </select>
                                  <Button onClick={handleAddWorker} className="w-full" disabled={!selectedWorkerId}>Assign to Project</Button>
                              </div>
                          ) : (
                              <div className="space-y-3">
                                  <Input placeholder="Name" onChange={(e:any) => setNewWorkerData({...newWorkerData, name: e.target.value})}/>
                                  <Input placeholder="Role" onChange={(e:any) => setNewWorkerData({...newWorkerData, role: e.target.value})}/>
                                  <Input placeholder="Phone" onChange={(e:any) => setNewWorkerData({...newWorkerData, phone: e.target.value})}/>
                                  <select className="w-full p-3 border rounded-xl mb-4" onChange={(e:any) => setNewWorkerData({...newWorkerData, type: e.target.value})}>
                                      <option value="Daily">Daily Wage</option><option value="Contract">Contract</option>
                                  </select>
                                  <Button onClick={handleAddWorker} className="w-full">Create & Add</Button>
                              </div>
                          )}
                          <Button variant="ghost" onClick={() => setIsWorkerModalOpen(false)} className="w-full mt-2">Close</Button>
                      </Card>
                  </div>
              )}
          </div>
      );
  };

  const renderSettlementsTab = () => {
      if (role !== 'HEAD') return <div className="p-10 text-center text-neutral-400">Restricted Access. Only Administrators can manage settlements.</div>;

      return (
          <div>
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-serif font-bold text-xl">Settlements</h3>
                  <Button onClick={() => setIsSettlementModalOpen(true)} variant="primary" className="flex items-center gap-2"><DollarSign size={16}/> Add Settlement</Button>
              </div>

              <div className="overflow-hidden rounded-xl border border-neutral-100">
                  <table className="w-full text-sm text-left bg-white">
                      <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase text-xs">
                          <tr>
                              <th className="p-4">Date</th>
                              <th className="p-4">Paid To</th>
                              <th className="p-4">Mode</th>
                              <th className="p-4">Description</th>
                              <th className="p-4 text-right">Amount</th>
                              <th className="p-4 text-center">Proof</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                          {settlements.map(s => (
                              <tr key={s.id} className="hover:bg-neutral-50/50">
                                  <td className="p-4 text-neutral-500">{format(s.createdAt?.toDate(), 'MMM d')}</td>
                                  <td className="p-4">
                                      <div className="font-bold text-primary">{s.paidToName}</div>
                                      <div className="text-xs text-neutral-400 uppercase">{s.paidToType}</div>
                                  </td>
                                  <td className="p-4"><Badge color="neutral">{s.mode}</Badge></td>
                                  <td className="p-4 text-neutral-600 max-w-xs truncate">{s.description}</td>
                                  <td className="p-4 text-right font-mono font-bold">${s.amount.toLocaleString()}</td>
                                  <td className="p-4 text-center">
                                      {s.screenshotUrl && <a href={s.screenshotUrl} target="_blank" className="text-accent-hover hover:underline text-xs">View</a>}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>

              {isSettlementModalOpen && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                      <Card className="w-full max-w-md">
                          <h3 className="font-bold text-lg mb-4">Record Payment</h3>
                          <form onSubmit={handleAddSettlement} className="space-y-4">
                               <div className="grid grid-cols-2 gap-4">
                                   <div>
                                       <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Type</label>
                                       <select className="w-full p-3 border rounded-xl text-sm" value={settlementData.paidToType} onChange={(e:any) => setSettlementData({...settlementData, paidToType: e.target.value})}>
                                            <option>Worker</option><option>Shop</option><option>Vendor</option>
                                       </select>
                                   </div>
                                   <div>
                                       <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Mode</label>
                                       <select className="w-full p-3 border rounded-xl text-sm" value={settlementData.mode} onChange={(e:any) => setSettlementData({...settlementData, mode: e.target.value})}>
                                            <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option>
                                       </select>
                                   </div>
                               </div>
                               <Input label="Paid To (Name)" value={settlementData.paidToName || ''} onChange={(e:any) => setSettlementData({...settlementData, paidToName: e.target.value})} required />
                               <Input label="Amount" type="number" value={settlementData.amount || ''} onChange={(e:any) => setSettlementData({...settlementData, amount: Number(e.target.value)})} required />
                               <Input label="Description" value={settlementData.description || ''} onChange={(e:any) => setSettlementData({...settlementData, description: e.target.value})} required />
                               <Input label="Proof URL" value={settlementData.screenshotUrl || ''} onChange={(e:any) => setSettlementData({...settlementData, screenshotUrl: e.target.value})} />
                               
                               <div className="flex justify-end gap-2 mt-6">
                                  <Button variant="ghost" onClick={() => setIsSettlementModalOpen(false)}>Cancel</Button>
                                  <Button type="submit" variant="primary">Record</Button>
                               </div>
                          </form>
                      </Card>
                  </div>
              )}
          </div>
      );
  };

  const renderBudgetTab = () => {
    if (role !== 'HEAD') return <div className="p-10 text-center text-neutral-400">Restricted Access.</div>;
    const remaining = project.budget - project.currentSpend;
    const health = remaining < 0 ? 'red' : remaining < (project.budget * 0.15) ? 'yellow' : 'green';

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h3 className="font-serif font-bold text-xl">Financial Overview</h3>
                {!editBudgetMode ? 
                    <Button variant="outline" onClick={() => setEditBudgetMode(true)} className="text-xs py-2">Edit Budget</Button> :
                    <div className="flex gap-2">
                         <Button variant="ghost" onClick={() => setEditBudgetMode(false)} className="text-xs py-2">Cancel</Button>
                         <Button variant="primary" onClick={handleSaveBudget} className="text-xs py-2">Save Changes</Button>
                    </div>
                }
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-neutral-900 text-white border-none">
                    <p className="text-neutral-400 text-xs font-bold uppercase tracking-widest mb-2">Total Estimated</p>
                    {editBudgetMode ? 
                        <input className="bg-neutral-800 text-2xl font-bold w-full p-2 rounded" type="number" value={tempBudget.cost} onChange={e => setTempBudget({...tempBudget, cost: Number(e.target.value)})}/> :
                        <p className="text-3xl font-serif">${project.estimatedCost.toLocaleString()}</p>
                    }
                </Card>
                <Card className="bg-accent text-primary border-none">
                    <p className="text-primary/60 text-xs font-bold uppercase tracking-widest mb-2">Approved Budget</p>
                    {editBudgetMode ? 
                        <input className="bg-yellow-300/50 text-2xl font-bold w-full p-2 rounded text-black" type="number" value={tempBudget.budget} onChange={e => setTempBudget({...tempBudget, budget: Number(e.target.value)})}/> :
                        <p className="text-3xl font-serif">${project.budget.toLocaleString()}</p>
                    }
                </Card>
                <Card className={`${health === 'red' ? 'bg-red-50 border-red-200' : health === 'yellow' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                     <p className={`${health === 'red' ? 'text-red-800' : health === 'yellow' ? 'text-yellow-800' : 'text-green-800'} text-xs font-bold uppercase tracking-widest mb-2`}>Remaining</p>
                     <p className={`text-3xl font-serif ${health === 'red' ? 'text-red-600' : health === 'yellow' ? 'text-yellow-700' : 'text-green-700'}`}>${remaining.toLocaleString()}</p>
                </Card>
            </div>
            
            <div className="pt-6 border-t border-neutral-100">
                <h4 className="font-bold text-lg mb-4">Spending Breakdown</h4>
                {/* Simple Bar Chart Visualization */}
                <div className="h-8 w-full bg-neutral-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-primary" style={{ width: `${Math.min((project.currentSpend / project.budget) * 100, 100)}%` }}></div>
                </div>
                <div className="flex justify-between text-xs font-bold text-neutral-400 mt-2 uppercase tracking-wider">
                    <span>$0</span>
                    <span>Current: ${project.currentSpend.toLocaleString()}</span>
                    <span>Budget: ${project.budget.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
  };

  const togglePhaseExpand = (phaseId: string) => {
    setExpandedPhases(prev => 
      prev.includes(phaseId) 
        ? prev.filter(id => id !== phaseId) 
        : [...prev, phaseId]
    );
  };

  const getPhaseStatusColor = (status: string) => {
    switch(status) {
      case 'COMPLETED': return { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50 border-green-200' };
      case 'IN_PROGRESS': return { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50 border-amber-200' };
      default: return { bg: 'bg-neutral-300', text: 'text-neutral-500', light: 'bg-neutral-50 border-neutral-200' };
    }
  };

  const getTaskProgress = (tasks: TimelineTask[]) => {
    if (!tasks || tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'COMPLETED').length;
    return Math.round((completed / tasks.length) * 100);
  };

  const getDaysRemaining = (targetDate: string) => {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const today = new Date();
    const days = differenceInDays(target, today);
    if (isToday(target)) return 'Due today';
    if (days < 0) return `${Math.abs(days)} days overdue`;
    return `${days} days left`;
  };

  const handleAddPhase = () => {
    if (!newPhaseData.name || !newPhaseData.startDate || !newPhaseData.targetDate) {
      alert('Please fill Phase Name, Start Date, and Goal Date');
      return;
    }
    const newPhase: TimelinePhase = {
      id: Date.now().toString(),
      name: newPhaseData.name || '',
      description: newPhaseData.description || '',
      startDate: newPhaseData.startDate || '',
      targetDate: newPhaseData.targetDate || '',
      status: 'PENDING',
      tasks: []
    };
    
    if (editingPhaseIndex !== null) {
      const updated = [...phases];
      updated[editingPhaseIndex] = { ...updated[editingPhaseIndex], ...newPhaseData };
      setPhases(updated);
    } else {
      setPhases([...phases, newPhase]);
    }
    
    setIsPhaseModalOpen(false);
    setEditingPhaseIndex(null);
    setNewPhaseData({ name: '', description: '', startDate: '', targetDate: '', status: 'PENDING', tasks: [] });
  };

  const handleAddTask = () => {
    if (selectedPhaseForTask === null || !newTaskData.title || !newTaskData.targetDate) {
      alert('Please fill Task Title and Target Date');
      return;
    }
    
    const newTask: TimelineTask = {
      id: Date.now().toString(),
      title: newTaskData.title || '',
      description: newTaskData.description || '',
      startDate: newTaskData.startDate || '',
      targetDate: newTaskData.targetDate || '',
      status: 'PENDING',
      assignedWorkerIds: newTaskData.assignedWorkerIds || []
    };
    
    const updated = [...phases];
    if (!updated[selectedPhaseForTask].tasks) {
      updated[selectedPhaseForTask].tasks = [];
    }
    updated[selectedPhaseForTask].tasks.push(newTask);
    setPhases(updated);
    
    setIsTaskModalOpen(false);
    setSelectedPhaseForTask(null);
    setNewTaskData({ title: '', description: '', startDate: '', targetDate: '', status: 'PENDING', assignedWorkerIds: [] });
  };

  const updateTaskStatus = (phaseIdx: number, taskIdx: number, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED') => {
    const updated = [...phases];
    updated[phaseIdx].tasks[taskIdx].status = status;
    setPhases(updated);
  };

  const deleteTask = (phaseIdx: number, taskIdx: number) => {
    const updated = [...phases];
    updated[phaseIdx].tasks.splice(taskIdx, 1);
    setPhases(updated);
  };

  const renderTimelineTab = () => (
    <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h3 className="font-serif font-bold text-2xl">Project Timeline</h3>
                <p className="text-neutral-500 text-sm mt-1">Track phases and sub-works progress</p>
        </div>
            <div className="flex gap-2">
                {role !== 'WORKER' && (
                    <>
                        <Button onClick={() => setIsPhaseModalOpen(true)} variant="primary" className="flex items-center gap-2">
                            <Plus size={16}/> Add Phase
                        </Button>
                        <Button onClick={() => updateTimeline(project.id, phases)} variant="accent">
                            Save All
                        </Button>
                    </>
                )}
                    </div>
                </div>

        {/* Timeline Progress Overview */}
        {phases.length > 0 && (
            <Card className="mb-8 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white border-none">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-neutral-400 text-xs font-bold uppercase tracking-wider">Overall Progress</span>
                    <span className="text-2xl font-bold">{Math.round(phases.filter(p => p.status === 'COMPLETED').length / phases.length * 100)}%</span>
                </div>
                <div className="flex gap-1 mb-4">
                    {phases.map((phase, idx) => (
                        <div 
                            key={phase.id} 
                            className={`h-2 flex-1 rounded-full transition-all ${
                                phase.status === 'COMPLETED' ? 'bg-green-500' : 
                                phase.status === 'IN_PROGRESS' ? 'bg-amber-500' : 'bg-neutral-600'
                            }`}
                            title={phase.name}
                        />
                    ))}
        </div>
                <div className="flex justify-between text-xs text-neutral-400">
                    <span>{phases.filter(p => p.status === 'COMPLETED').length} of {phases.length} phases completed</span>
                    <span>{phases.reduce((acc, p) => acc + (p.tasks?.filter(t => t.status === 'COMPLETED').length || 0), 0)} tasks done</span>
    </div>
            </Card>
        )}

        {/* Phases List */}
        <div className="space-y-4">
            {phases.length === 0 ? (
                <Card className="text-center py-12">
                    <Clock size={48} className="mx-auto text-neutral-300 mb-4"/>
                    <p className="text-neutral-500">No phases created yet</p>
                    {role !== 'WORKER' && <p className="text-sm text-neutral-400 mt-2">Click "Add Phase" to start building your timeline</p>}
                </Card>
            ) : (
                phases.map((phase, phaseIdx) => {
                    const isExpanded = expandedPhases.includes(phase.id);
                    const statusColors = getPhaseStatusColor(phase.status);
                    const taskProgress = getTaskProgress(phase.tasks);
                    const daysInfo = getDaysRemaining(phase.targetDate);

  return (
                        <div key={phase.id} className="group">
                            {/* Phase Header - Clickable */}
                            <div 
                                className={`bg-white rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                                    isExpanded ? 'border-accent shadow-md' : 'border-neutral-100'
                                }`}
                                onClick={() => togglePhaseExpand(phase.id)}
                            >
                                <div className="p-5">
                                    <div className="flex items-start gap-4">
                                        {/* Phase Number & Status Indicator */}
                                        <div className="flex flex-col items-center gap-2">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${statusColors.bg}`}>
                                                {phaseIdx + 1}
                                            </div>
                                            <div className={`w-1 h-8 rounded-full ${statusColors.bg} opacity-30`}></div>
                                        </div>
                                        
                                        {/* Phase Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h4 className="font-bold text-lg">{phase.name || 'Unnamed Phase'}</h4>
                                                <Badge color={phase.status === 'COMPLETED' ? 'green' : phase.status === 'IN_PROGRESS' ? 'yellow' : 'neutral'}>
                                                    {phase.status.replace('_', ' ')}
                                                </Badge>
                                            </div>
                                            
                                            {phase.description && (
                                                <p className="text-neutral-500 text-sm mb-3">{phase.description}</p>
                                            )}
                                            
                                            {/* Dates & Progress */}
                                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                                <div className="flex items-center gap-2 text-neutral-500">
                                                    <Calendar size={14}/>
                                                    <span>{phase.startDate ? format(new Date(phase.startDate), 'MMM d') : 'Not set'}</span>
                                                    <span>→</span>
                                                    <span className="font-medium">{phase.targetDate ? format(new Date(phase.targetDate), 'MMM d, yyyy') : 'Not set'}</span>
                                                </div>
                                                {daysInfo && (
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                                        daysInfo.includes('overdue') ? 'bg-red-100 text-red-600' : 
                                                        daysInfo.includes('today') ? 'bg-amber-100 text-amber-600' : 
                                                        'bg-blue-100 text-blue-600'
                                                    }`}>
                                                        {daysInfo}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Tasks Progress Bar */}
                                            {phase.tasks && phase.tasks.length > 0 && (
                                                <div className="mt-3">
                                                    <div className="flex justify-between text-xs text-neutral-400 mb-1">
                                                        <span>{phase.tasks.filter(t => t.status === 'COMPLETED').length}/{phase.tasks.length} tasks</span>
                                                        <span>{taskProgress}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-accent transition-all" style={{ width: `${taskProgress}%` }}></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Expand/Collapse Icon */}
                                        <div className="flex items-center gap-2">
                                            {role !== 'WORKER' && (
            <button 
                                                    onClick={(e) => { e.stopPropagation(); setEditingPhaseIndex(phaseIdx); setNewPhaseData(phase); setIsPhaseModalOpen(true); }}
                                                    className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-primary transition-colors"
            >
                                                    <Edit2 size={16}/>
            </button>
                                            )}
                                            <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-accent text-primary' : 'bg-neutral-100 text-neutral-400'}`}>
                                                {isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Expanded Tasks Section */}
                                {isExpanded && (
                                    <div className="border-t border-neutral-100 bg-neutral-50/50 p-5 rounded-b-xl">
                                        <div className="flex justify-between items-center mb-4">
                                            <h5 className="font-bold text-sm text-neutral-600 uppercase tracking-wider">Sub-Works / Tasks</h5>
                                            {role !== 'WORKER' && (
                                                <Button 
                                                    variant="outline" 
                                                    className="text-xs py-1.5"
                                                    onClick={(e) => { e.stopPropagation(); setSelectedPhaseForTask(phaseIdx); setIsTaskModalOpen(true); }}
                                                >
                                                    <Plus size={14} className="mr-1"/> Add Task
                                                </Button>
                                            )}
                                        </div>
                                        
                                        {(!phase.tasks || phase.tasks.length === 0) ? (
                                            <p className="text-neutral-400 text-sm text-center py-4">No tasks added yet</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {phase.tasks.map((task, taskIdx) => (
                                                    <div 
                                                        key={task.id} 
                                                        className={`flex items-center gap-3 p-3 rounded-lg border bg-white transition-all ${
                                                            task.status === 'COMPLETED' ? 'border-green-200 bg-green-50/50' :
                                                            task.status === 'IN_PROGRESS' ? 'border-amber-200 bg-amber-50/50' :
                                                            'border-neutral-200'
                                                        }`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {/* Task Status Checkbox */}
                                                        <button 
                                                            onClick={() => updateTaskStatus(
                                                                phaseIdx, 
                                                                taskIdx, 
                                                                task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
                                                            )}
                                                            disabled={role === 'WORKER'}
                                                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                                                task.status === 'COMPLETED' 
                                                                    ? 'bg-green-500 border-green-500 text-white' 
                                                                    : 'border-neutral-300 hover:border-green-500'
                                                            }`}
                                                        >
                                                            {task.status === 'COMPLETED' && <CheckCircle size={14}/>}
                                                        </button>
                                                        
                                                        {/* Task Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`font-medium ${task.status === 'COMPLETED' ? 'line-through text-neutral-400' : ''}`}>
                                                                {task.title}
                                                            </p>
                                                            {task.description && (
                                                                <p className="text-xs text-neutral-500 truncate">{task.description}</p>
                                                            )}
                                                        </div>
                                                        
                                                        {/* Task Target Date */}
                                                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                                                            <Target size={12}/>
                                                            {task.targetDate ? format(new Date(task.targetDate), 'MMM d') : '-'}
                                                        </div>
                                                        
                                                        {/* Task Status Select & Delete */}
                                                        {role !== 'WORKER' && (
                                                            <div className="flex items-center gap-1">
                                                                <select 
                                                                    value={task.status} 
                                                                    onChange={(e) => updateTaskStatus(phaseIdx, taskIdx, e.target.value as any)}
                                                                    className="text-xs border rounded-lg px-2 py-1 bg-white"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <option value="PENDING">Pending</option>
                                                                    <option value="IN_PROGRESS">In Progress</option>
                                                                    <option value="COMPLETED">Completed</option>
                                                                </select>
                                                                <button 
                                                                    onClick={() => deleteTask(phaseIdx, taskIdx)}
                                                                    className="p-1 text-neutral-300 hover:text-red-500"
                                                                >
                                                                    <Trash2 size={14}/>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
        ))}
      </div>
                                        )}
                                        
                                        {/* Phase Actions */}
                                        {role !== 'WORKER' && (
                                            <div className="mt-4 pt-4 border-t border-neutral-200 flex justify-between items-center">
                                                <select 
                                                    value={phase.status} 
                                                    onChange={(e) => { 
                                                        const updated = [...phases]; 
                                                        updated[phaseIdx].status = e.target.value as any; 
                                                        setPhases(updated); 
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-sm border rounded-lg px-3 py-2 bg-white"
                                                >
                                                    <option value="PENDING">Phase: Pending</option>
                                                    <option value="IN_PROGRESS">Phase: In Progress</option>
                                                    <option value="COMPLETED">Phase: Completed</option>
                                                </select>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setPhases(phases.filter((_, i) => i !== phaseIdx)); }}
                                                    className="text-sm text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                                                >
                                                    <Trash2 size={14}/> Delete Phase
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
      </div>
    </div>
  );
                })
            )}
        </div>

        {/* Add/Edit Phase Modal */}
        {isPhaseModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <Card className="w-full max-w-md">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg">{editingPhaseIndex !== null ? 'Edit Phase' : 'Add New Phase'}</h3>
                        <button onClick={() => { setIsPhaseModalOpen(false); setEditingPhaseIndex(null); setNewPhaseData({ name: '', description: '', startDate: '', targetDate: '', status: 'PENDING', tasks: [] }); }}>
                            <X size={20} className="text-neutral-400 hover:text-neutral-600"/>
                        </button>
                    </div>
                    <div className="space-y-4">
                        <Input 
                            label="Phase Name *" 
                            placeholder="e.g., Foundation Work, Structural Work"
                            value={newPhaseData.name || ''} 
                            onChange={(e: any) => setNewPhaseData({...newPhaseData, name: e.target.value})} 
                        />
                        <div>
                            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Description</label>
                            <textarea 
                                className="w-full p-3 border rounded-xl text-sm resize-none"
                                rows={2}
                                placeholder="Brief description of this phase..."
                                value={newPhaseData.description || ''}
                                onChange={(e) => setNewPhaseData({...newPhaseData, description: e.target.value})}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input 
                                label="Start Date *" 
                                type="date"
                                value={newPhaseData.startDate || ''} 
                                onChange={(e: any) => setNewPhaseData({...newPhaseData, startDate: e.target.value})} 
                            />
                            <Input 
                                label="Goal Date *" 
                                type="date"
                                value={newPhaseData.targetDate || ''} 
                                onChange={(e: any) => setNewPhaseData({...newPhaseData, targetDate: e.target.value})} 
                            />
                        </div>
                        {editingPhaseIndex !== null && (
                            <div>
                                <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Status</label>
                                <select 
                                    className="w-full p-3 border rounded-xl"
                                    value={newPhaseData.status}
                                    onChange={(e) => setNewPhaseData({...newPhaseData, status: e.target.value as any})}
                                >
                                    <option value="PENDING">Pending</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="COMPLETED">Completed</option>
                                </select>
                            </div>
                        )}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="ghost" onClick={() => { setIsPhaseModalOpen(false); setEditingPhaseIndex(null); }}>Cancel</Button>
                            <Button variant="primary" onClick={handleAddPhase}>
                                {editingPhaseIndex !== null ? 'Save Changes' : 'Add Phase'}
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        )}

        {/* Add Task Modal */}
        {isTaskModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <Card className="w-full max-w-md">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg">Add Task to Phase</h3>
                        <button onClick={() => { setIsTaskModalOpen(false); setSelectedPhaseForTask(null); }}>
                            <X size={20} className="text-neutral-400 hover:text-neutral-600"/>
                        </button>
                    </div>
                    <div className="space-y-4">
                        <Input 
                            label="Task Title *" 
                            placeholder="e.g., Pour concrete, Install rebar"
                            value={newTaskData.title || ''} 
                            onChange={(e: any) => setNewTaskData({...newTaskData, title: e.target.value})} 
                        />
                        <div>
                            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Description</label>
                            <textarea 
                                className="w-full p-3 border rounded-xl text-sm resize-none"
                                rows={2}
                                placeholder="Task details..."
                                value={newTaskData.description || ''}
                                onChange={(e) => setNewTaskData({...newTaskData, description: e.target.value})}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input 
                                label="Start Date" 
                                type="date"
                                value={newTaskData.startDate || ''} 
                                onChange={(e: any) => setNewTaskData({...newTaskData, startDate: e.target.value})} 
                            />
                            <Input 
                                label="Target Date *" 
                                type="date"
                                value={newTaskData.targetDate || ''} 
                                onChange={(e: any) => setNewTaskData({...newTaskData, targetDate: e.target.value})} 
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="ghost" onClick={() => { setIsTaskModalOpen(false); setSelectedPhaseForTask(null); }}>Cancel</Button>
                            <Button variant="primary" onClick={handleAddTask}>Add Task</Button>
                        </div>
                    </div>
                </Card>
            </div>
        )}
    </div>
  );

  return (
    <div className="mt-8">
      <div className="flex overflow-x-auto gap-1 mb-8 pb-2 border-b border-neutral-100">
        {[
            {id: 'updates', label: 'Updates', icon: MessageSquare},
            {id: 'designs', label: 'Designs', icon: Image},
            {id: 'timeline', label: 'Timeline', icon: Clock},
            (role === 'HEAD' || role === 'MANAGER') && {id: 'workers', label: 'Workers', icon: Users},
            (role === 'HEAD' || role === 'MANAGER') && {id: 'rooms', label: 'Rooms', icon: Home},
            role === 'HEAD' && {id: 'settlements', label: 'Settlements', icon: DollarSign},
            role === 'HEAD' && {id: 'budget', label: 'Budget', icon: Briefcase}
        ].filter(Boolean).map(tab => (
            <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)} 
                className={`flex items-center gap-2 px-5 py-3 font-bold text-xs uppercase tracking-wider rounded-t-lg transition-all ${activeTab === tab.id ? 'text-primary border-b-2 border-accent bg-neutral-50/50' : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'}`}
            >
                <tab.icon size={16} className={activeTab === tab.id ? 'text-accent-hover' : ''}/>
                {tab.label}
            </button>
        ))}
      </div>
      
      <div className="min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'updates' && (role === 'WORKER' ? <div className="p-10 text-center text-neutral-400">View updates here.</div> : renderUpdatesTab())}
        {activeTab === 'designs' && renderDesignsTab()}
        {activeTab === 'timeline' && renderTimelineTab()}
        {activeTab === 'workers' && (role === 'HEAD' || role === 'MANAGER') && renderWorkersTab()}
        {activeTab === 'rooms' && (role === 'HEAD' || role === 'MANAGER') && renderRoomsTab()}
        {activeTab === 'settlements' && role === 'HEAD' && renderSettlementsTab()}
        {activeTab === 'budget' && role === 'HEAD' && renderBudgetTab()}
      </div>
    </div>
  );
};