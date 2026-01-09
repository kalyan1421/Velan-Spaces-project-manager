import React, { useState, useEffect } from 'react';
import { Project, UserRole, Worker } from '../types';
import { Card, Button, Input } from './Layouts';
import { Briefcase, User, Calendar, Users, MapPin, Phone, Mail, Edit2, X, Save, Hash } from 'lucide-react';
import { updateProject, subscribeToGlobalWorkers } from '../services/firebase';

interface ProjectHeaderProps {
    project: Project;
    role?: UserRole;
}

const InfoCard = ({ icon, title, value }: { icon: React.ReactNode, title: string, value: string | undefined }) => (
    <div className="flex items-center gap-4 bg-neutral-50 p-4 rounded-lg">
        <div className="text-primary">{icon}</div>
        <div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{title}</p>
            <p className="font-semibold text-primary">{value || 'Not set'}</p>
        </div>
    </div>
);

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({ project, role }) => {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editData, setEditData] = useState({
        projectName: project.projectName,
        id: project.id,
        clientName: project.clientName,
        clientPhone: project.clientPhone || '',
        clientEmail: project.clientEmail || '',
        clientAddress: project.clientAddress || '',
        clientNotes: project.clientNotes || '',
        location: project.location
    });
    const [globalWorkers, setGlobalWorkers] = useState<Worker[]>([]);

    useEffect(() => {
        const unsub = subscribeToGlobalWorkers(setGlobalWorkers);
        return () => unsub();
    }, []);

    // Calculate timeline info
    const getTimelineInfo = () => {
        if (!project.timeline || project.timeline.length === 0) return 'No phases set';
        const completed = project.timeline.filter(p => p.status === 'COMPLETED').length;
        const inProgress = project.timeline.filter(p => p.status === 'IN_PROGRESS').length;
        const total = project.timeline.length;
        if (inProgress > 0) {
            const currentPhase = project.timeline.find(p => p.status === 'IN_PROGRESS');
            return currentPhase?.name || `${completed}/${total} completed`;
        }
        return `${completed}/${total} phases completed`;
    };

    // Get workers count
    const getWorkersInfo = () => {
        const assignedCount = project.workerIds?.length || 0;
        if (assignedCount === 0) return 'No workers assigned';
        const workerNames = project.workerIds?.slice(0, 2).map(id => {
            const worker = globalWorkers.find(w => w.id === id);
            return worker?.name;
        }).filter(Boolean).join(', ');
        if (assignedCount > 2) return `${workerNames} +${assignedCount - 2} more`;
        return workerNames || `${assignedCount} workers`;
    };

    const handleSaveProject = async () => {
        await updateProject(project.id, {
            projectName: editData.projectName,
            clientName: editData.clientName,
            clientPhone: editData.clientPhone,
            clientEmail: editData.clientEmail,
            clientAddress: editData.clientAddress,
            clientNotes: editData.clientNotes,
            location: editData.location
        });
        setIsEditModalOpen(false);
        alert('Project details updated!');
    };

    const canEdit = role === 'HEAD' || role === 'MANAGER';

    return (
        <>
            <Card className="mb-8">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-neutral-900 text-white text-xs font-mono px-2 py-1 rounded">{project.id}</span>
                        <h2 className="font-serif font-bold text-xl">{project.projectName}</h2>
                    </div>
                    {canEdit && (
                        <Button variant="outline" onClick={() => setIsEditModalOpen(true)} className="text-xs flex items-center gap-2">
                            <Edit2 size={14}/> Edit Details
                        </Button>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <InfoCard icon={<User size={20} />} title="Client" value={project.clientName} />
                    <InfoCard icon={<MapPin size={20} />} title="Location" value={project.location} />
                    <InfoCard icon={<Calendar size={20} />} title="Timeline" value={getTimelineInfo()} />
                    <InfoCard icon={<Users size={20} />} title="Workers" value={getWorkersInfo()} />
                </div>
                {/* Additional Client Info Row */}
                {(project.clientPhone || project.clientEmail) && (
                    <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-wrap gap-6">
                        {project.clientPhone && (
                            <div className="flex items-center gap-2 text-sm text-neutral-600">
                                <Phone size={14} className="text-neutral-400"/>
                                <span>{project.clientPhone}</span>
                            </div>
                        )}
                        {project.clientEmail && (
                            <div className="flex items-center gap-2 text-sm text-neutral-600">
                                <Mail size={14} className="text-neutral-400"/>
                                <span>{project.clientEmail}</span>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg">Edit Project Details</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                                <X size={20}/>
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Project Info Section */}
                            <div className="pb-4 border-b border-neutral-100">
                                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Project Information</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-neutral-400 uppercase">Project ID</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Hash size={16} className="text-neutral-400"/>
                                            <span className="font-mono text-sm bg-neutral-100 px-2 py-1 rounded">{project.id}</span>
                                            <span className="text-xs text-neutral-400">(Cannot be changed)</span>
                                        </div>
                                    </div>
                                    <Input 
                                        label="Project Name" 
                                        value={editData.projectName} 
                                        onChange={(e: any) => setEditData({...editData, projectName: e.target.value})} 
                                    />
                                    <Input 
                                        label="Location" 
                                        value={editData.location} 
                                        onChange={(e: any) => setEditData({...editData, location: e.target.value})} 
                                    />
                                </div>
                            </div>

                            {/* Client Info Section */}
                            <div className="pb-4">
                                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Client Information</h4>
                                <div className="space-y-3">
                                    <Input 
                                        label="Client Name" 
                                        value={editData.clientName} 
                                        onChange={(e: any) => setEditData({...editData, clientName: e.target.value})} 
                                    />
                                    <Input 
                                        label="Client Phone" 
                                        value={editData.clientPhone} 
                                        onChange={(e: any) => setEditData({...editData, clientPhone: e.target.value})} 
                                        placeholder="+91 XXXXX XXXXX"
                                    />
                                    <Input 
                                        label="Client Email" 
                                        type="email"
                                        value={editData.clientEmail} 
                                        onChange={(e: any) => setEditData({...editData, clientEmail: e.target.value})} 
                                        placeholder="client@example.com"
                                    />
                                    <Input 
                                        label="Client Address" 
                                        value={editData.clientAddress} 
                                        onChange={(e: any) => setEditData({...editData, clientAddress: e.target.value})} 
                                    />
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Notes</label>
                                        <textarea 
                                            className="w-full p-3 border rounded-xl text-sm resize-none"
                                            rows={3}
                                            value={editData.clientNotes}
                                            onChange={(e) => setEditData({...editData, clientNotes: e.target.value})}
                                            placeholder="Any additional notes about the client..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-neutral-100">
                                <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                                <Button variant="primary" onClick={handleSaveProject} className="flex items-center gap-2">
                                    <Save size={14}/> Save Changes
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
};
