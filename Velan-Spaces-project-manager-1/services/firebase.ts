
// @ts-ignore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
// @ts-ignore
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// @ts-ignore
import { 
  getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc, 
  onSnapshot, orderBy, query, serverTimestamp, arrayUnion, where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// @ts-ignore
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

import { Project, ProjectUpdate, Manager, Worker, Settlement, DesignDocument, Room } from '../types';

// --- Configuration ---

const firebaseConfig = {
  apiKey: "AIzaSyDVjEztsxcWSN9Ilk8SeXsuj6mSXfUfN_g",
  authDomain: "velan-spaces-constructions.firebaseapp.com",
  projectId: "velan-spaces-constructions",
  storageBucket: "velan-spaces-constructions.firebasestorage.app",
  messagingSenderId: "502284969422",
  appId: "1:502284969422:web:dddd5ab7ba5236ca8b779f",
  measurementId: "G-4T7H6LRNFX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export const initAuth = async () => {
  try {
    await signInAnonymously(auth);
    console.log("Auth initialized anonymously");
  } catch (e: any) {
    console.error("Auth Initialization Failed:", e.code, e.message);
    if (e.code === 'auth/configuration-not-found') {
        console.warn("Please check if Authentication is enabled in your Firebase Console.");
    }
  }
};

// --- Constants ---
const COL_PROJECTS = 'projects';
const COL_MANAGERS = 'managers';
const COL_WORKERS = 'workers';

// --- Helper: File Upload ---
export const uploadProjectFile = async (file: File, projectId: string) => {
    const storageRef = ref(storage, `projects/${projectId}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};

// --- Core Project Services ---

const generateProjectId = () => {
    return 'PRJ' + Math.floor(10000 + Math.random() * 90000);
};

export const createProject = async (data: Partial<Project>) => {
  const generatedId = generateProjectId();
  const newRef = doc(db, COL_PROJECTS, generatedId);
  
  const project: Project = {
    id: generatedId,
    projectName: data.projectName || 'New Project',
    clientName: data.clientName || 'Client',
    location: data.location || '',
    estimatedCost: Number(data.estimatedCost) || 0,
    budget: Number(data.budget) || 0,
    currentSpend: 0,
    managerIds: data.managerIds || [],
    workerIds: [],
    timeline: [],
    isComplete: false,
    completionPercentage: 0,
    createdAt: serverTimestamp(),
    rooms: [] // Initialize rooms as an empty array
  };
  await setDoc(newRef, project);
  return generatedId;
};

export const updateProjectFinancials = async (projectId: string, cost: number, budget: number) => {
    const docRef = doc(db, COL_PROJECTS, projectId);
    await updateDoc(docRef, { estimatedCost: cost, budget: budget });
};

export const updateProject = async (projectId: string, data: Partial<Project>) => {
    const docRef = doc(db, COL_PROJECTS, projectId);
    await updateDoc(docRef, data);
};

export const subscribeToProjects = (callback: (projects: Project[]) => void) => {
  const q = query(collection(db, COL_PROJECTS), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot: any) => {
    const projects = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Project));
    callback(projects);
  });
};

export const subscribeToManagerProjects = (managerId: string, callback: (projects: Project[]) => void) => {
  const q = query(collection(db, COL_PROJECTS), where('managerIds', 'array-contains', managerId));
  return onSnapshot(q, (snapshot: any) => {
    const projects = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Project));
    callback(projects);
  });
};

export const getProjectById = async (projectId: string): Promise<Project | null> => {
    const docRef = doc(db, COL_PROJECTS, projectId);
    const d = await getDoc(docRef);
    if (d.exists()) return { id: d.id, ...d.data() } as Project;
    return null;
};

// --- Room Services ---
export const addRoom = async (projectId: string, room: Omit<Room, 'id'>) => {
    const roomsCollection = collection(db, COL_PROJECTS, projectId, 'rooms');
    const docRef = await addDoc(roomsCollection, room);
    return docRef.id;
};

export const subscribeToRooms = (projectId: string, callback: (rooms: Room[]) => void) => {
    const q = query(collection(db, COL_PROJECTS, projectId, 'rooms'), orderBy('name')); // Assuming 'name' field exists
    return onSnapshot(q, (snapshot: any) => {
        const rooms = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Room));
        callback(rooms);
    });
};

export const updateRoom = async (projectId: string, roomId: string, roomData: Partial<Room>) => {
    const roomRef = doc(db, COL_PROJECTS, projectId, 'rooms', roomId);
    await updateDoc(roomRef, roomData);
};

// --- Updates Services ---

export const subscribeToUpdates = (projectId: string, callback: (updates: ProjectUpdate[]) => void) => {
  const q = query(collection(db, COL_PROJECTS, projectId, 'updates'), orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snapshot: any) => {
    const updates = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as ProjectUpdate));
    callback(updates);
  });
};

export const addUpdate = async (projectId: string, update: Partial<ProjectUpdate>) => {
  const updatesColl = collection(db, COL_PROJECTS, projectId, 'updates');
  if (update.progressPercentage !== undefined) {
      const projRef = doc(db, COL_PROJECTS, projectId);
      await updateDoc(projRef, { completionPercentage: update.progressPercentage });
  }
  await addDoc(updatesColl, {
    ...update,
    timestamp: serverTimestamp(),
    comments: []
  });
};

export const addComment = async (projectId: string, updateId: string, comment: any) => {
  const docRef = doc(db, COL_PROJECTS, projectId, 'updates', updateId);
  await updateDoc(docRef, { comments: arrayUnion(comment) });
};

// --- Designs Services ---

export const subscribeToDesigns = (projectId: string, callback: (designs: DesignDocument[]) => void) => {
    const q = query(collection(db, COL_PROJECTS, projectId, 'designs'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snap: any) => callback(snap.docs.map((d: any) => ({id: d.id, ...d.data()} as DesignDocument))));
};

export const addDesign = async (projectId: string, design: Partial<DesignDocument>) => {
    const designsColl = collection(db, COL_PROJECTS, projectId, 'designs');
    await addDoc(designsColl, {
        ...design,
        timestamp: serverTimestamp()
    });
};

export const updateDesignStatus = async (projectId: string, designId: string, status: any) => {
    const docRef = doc(db, COL_PROJECTS, projectId, 'designs', designId);
    await updateDoc(docRef, { approvalStatus: status });
};

// --- Settlements Services ---

export const subscribeToSettlements = (projectId: string, callback: (settlements: Settlement[]) => void) => {
    const q = query(collection(db, COL_PROJECTS, projectId, 'settlements'), orderBy('date', 'desc'));
    return onSnapshot(q, (snap: any) => callback(snap.docs.map((d: any) => ({id: d.id, ...d.data()} as Settlement))));
};

export const addSettlement = async (projectId: string, settlement: Partial<Settlement>) => {
    await addDoc(collection(db, COL_PROJECTS, projectId, 'settlements'), {
        ...settlement,
        createdAt: serverTimestamp()
    });
    
    const projRef = doc(db, COL_PROJECTS, projectId);
    const pSnap = await getDoc(projRef);
    if(pSnap.exists()) {
        const current = pSnap.data()?.currentSpend || 0;
        await updateDoc(projRef, { currentSpend: current + (settlement.amount || 0) });
    }
};

// --- Global Managers & Workers ---

export const subscribeToGlobalManagers = (callback: (managers: Manager[]) => void) => {
  const q = query(collection(db, COL_MANAGERS));
  return onSnapshot(q, (snapshot: any) => {
    const managers = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Manager));
    callback(managers);
  });
};

export const addGlobalManager = async (manager: Partial<Manager>) => {
  if (manager.id) {
    await setDoc(doc(db, COL_MANAGERS, manager.id), manager);
    return manager.id;
  }
  const ref = await addDoc(collection(db, COL_MANAGERS), manager);
  return ref.id;
};

export const subscribeToGlobalWorkers = (callback: (workers: Worker[]) => void) => {
  const q = query(collection(db, COL_WORKERS));
  return onSnapshot(q, (snapshot: any) => {
    const workers = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Worker));
    callback(workers);
  });
};

export const addGlobalWorker = async (worker: Partial<Worker>) => {
  if (worker.id) {
     await setDoc(doc(db, COL_WORKERS, worker.id), worker);
     return worker.id;
  }
  const ref = await addDoc(collection(db, COL_WORKERS), worker);
  return ref.id;
};

export const getWorkerById = async (workerId: string): Promise<Worker | null> => {
    const docRef = doc(db, COL_WORKERS, workerId);
    const d = await getDoc(docRef);
    if (d.exists()) return { id: d.id, ...d.data() } as Worker;
    return null;
};

export const assignWorkerToProject = async (projectId: string, workerId: string) => {
    const ref = doc(db, COL_PROJECTS, projectId);
    await updateDoc(ref, { workerIds: arrayUnion(workerId) });
};

export const updateTimeline = async (projectId: string, timeline: any[]) => {
    const ref = doc(db, COL_PROJECTS, projectId);
    await updateDoc(ref, { timeline });
};

export { db, auth, storage };
