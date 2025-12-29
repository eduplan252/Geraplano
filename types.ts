
export type PlanningType = 'Individual' | 'Mensal' | 'Semestral' | 'Anual';

export interface TestQuestion {
  number: number;
  question: string;
  options?: string[]; // Para objetivas
  correctAnswer: string;
}

export interface GeneratedTest {
  id: string;
  type: 'objective' | 'subjective';
  questions: TestQuestion[];
  instructions: string;
}

export interface LessonPlan {
  id: string;
  title: string;
  subject: string;
  grade: string;
  duration: string;
  planningType: PlanningType;
  bnccCodes: string[];
  objectives: string[];
  content: string;
  methodology: string;
  resources: string[];
  additionalResources: string[];
  assessment: string;
  studentText?: string;
  mermaidCode?: string;
  imageUrl?: string;
  test?: GeneratedTest;
  createdAt: number;
}

export interface LessonPlanRequest {
  subject: string;
  grade: string;
  topic: string;
  duration: string;
  planningType: PlanningType;
  additionalContext?: string;
}

export type Subject = 
  | 'Matemática'
  | 'Português'
  | 'História'
  | 'Geografia'
  | 'Ciências'
  | 'Biologia'
  | 'Física'
  | 'Química'
  | 'Artes'
  | 'Educação Física'
  | 'Inglês'
  | 'Outro';
