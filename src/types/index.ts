export type UserRole = 'admin' | 'coordinator';
export type PersonType = 'Administrador' | 'Professor' | 'Coordenador' | 'Tutor';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  courseId?: string; // For coordinators
  createdAt: Date;
}

export interface Person {
  id: string;
  tipo: PersonType;
  firstName: string;
  lastName: string;
  login: string;
  email: string;
  senha: string;
  courseId?: string; // Required for Tutor and Coordinator
  courseName?: string;
  createdAt: Date;
}

// Aliases para compatibilidade
export type Professor = Person;
export type Coordinator = Person;

export interface Course {
  id: string;
  name: string;
  coordinatorId: string;
  coordinatorName: string;
  tutorId?: string;
  tutorName?: string;
  disciplineIds?: string[]; // IDs das disciplinas vinculadas
  createdAt: Date;
}

export interface Discipline {
  id: string;
  name: string; // Nome da disciplina
  courseIds: string[]; // IDs dos cursos (até 15)
  courseNames: string[]; // Nomes dos cursos
  coordinatorLogin?: string; // Login do coordenador
  professorLogin?: string; // Login do professor
  tutorLogin?: string; // Login do tutor
  'mes-1'?: string; // Mês 1 (formato YYYY-MM)
  'mes-2'?: string; // Mês 2 (formato YYYY-MM)
  createdAt: Date;
  updatedAt: Date;
}

export interface Agendamento {
  id: string;
  data: Date;
  horario: string;
  curso: string;
  disciplina: string;
  professor: string;
  local: string;
  timestamp: Date;
}

export interface UploadHistory {
  id: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: Date;
  recordsCount: number;
  month: string;
}
