import React, { useState, useEffect } from 'react';
import { Project, UserRole, Worker } from '../types';
import { Header, Card } from './Layouts';
import { ProjectOperationalView } from './ProjectOperationalView';
import { subscribeToGlobalWorkers, getProjectById } from '../services/firebase';

interface WorkerDashboardProps {
  currentUser: Worker;
  onLogout: () => void;
}

export const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ currentUser, onLogout }) => {
  const [assignedProjects, setAssignedProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    // Fetch projects assigned to this worker
    const fetchAssignedProjects = async () => {
      if (currentUser.assignedProjects && currentUser.assignedProjects.length > 0) {
        const projectsData = await Promise.all(
          currentUser.assignedProjects.map(projectId => getProjectById(projectId))
        );
        setAssignedProjects(projectsData.filter(Boolean) as Project[]);
      }
    };
    fetchAssignedProjects();
  }, [currentUser.assignedProjects]);

  if (selectedProject) {
    return (
      <div className="min-h-screen elegant-bg">
        <Header title="Worker Portal" subtitle={selectedProject.projectName} onLogout={onLogout} />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <button onClick={() => setSelectedProject(null)} className="mb-6 text-neutral-400 hover:text-primary flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-colors">
            {/* <ArrowRight className="rotate-180" size={16}/> */} Back to My Projects
          </button>
          {/* ProjectOperationalView will need to be made view-only for workers */}
          <ProjectOperationalView project={selectedProject} role="WORKER" currentUserId={currentUser.id} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen elegant-bg">
      <Header title={`Hello, ${currentUser.name}`} subtitle="My Tasks" onLogout={onLogout} />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="font-serif font-bold text-2xl text-primary mb-8">Assigned Projects</h2>
        <div className="grid gap-4">
          {assignedProjects.length > 0 ? (
            assignedProjects.map(p => (
              <Card key={p.id} onClick={() => setSelectedProject(p)} className="flex items-center justify-between cursor-pointer group hover:border-accent transition-colors">
                <div>
                  <h3 className="font-bold text-lg group-hover:text-accent-hover">{p.projectName}</h3>
                  <p className="text-neutral-500 text-sm">{p.location} • {p.clientName}</p>
                </div>
                {/* <ChevronRight className="text-neutral-300 group-hover:text-primary"/> */}
              </Card>
            ))
          ) : (
            <p className="text-neutral-500 text-center">No projects assigned yet.</p>
          )}
        </div>
      </main>
    </div>
  );
};
