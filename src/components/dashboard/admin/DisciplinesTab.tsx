import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Course, Discipline, Person } from '@/types';
import { Plus, Loader2, Edit, Trash2, ChevronsUpDown, Check, Download, Upload } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DisciplinesTabProps {
  onDataChange?: () => void;
}

const MONTHS = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const DisciplinesTab = ({ onDataChange }: DisciplinesTabProps) => {
  const { userData } = useAuth();
  const { logAction } = useAuditLog();
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [filteredDisciplines, setFilteredDisciplines] = useState<Discipline[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [professors, setProfessors] = useState<Person[]>([]);
  const [coordinators, setCoordinators] = useState<Person[]>([]);
  const [tutors, setTutors] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [disciplineToDelete, setDisciplineToDelete] = useState<Discipline | null>(null);
  const [editingDiscipline, setEditingDiscipline] = useState<Discipline | null>(null);
  const [formData, setFormData] = useState({ 
    name: '',
    courseIds: [] as string[],
    coordinatorLogin: '',
    professorLogin: '',
    tutorLogin: '',
    'mes-1': '',
    'mes-2': ''
  });
  const [saving, setSaving] = useState(false);
  const [sortOrder, setSortOrder] = useState<'alphabetical' | 'month'>('month');
  const [professorPopoverOpen, setProfessorPopoverOpen] = useState(false);
  const [coordinatorPopoverOpen, setCoordinatorPopoverOpen] = useState(false);
  const [tutorPopoverOpen, setTutorPopoverOpen] = useState(false);
  
  // Batch upload states
  const [uploading, setUploading] = useState(false);
  const [uploadResultOpen, setUploadResultOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [uploadResult, setUploadResult] = useState<{
    created: string[];
    ignored: string[];
    errors: string[];
  }>({ created: [], ignored: [], errors: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDisciplines();
    loadCourses();
    loadProfessors();
    loadCoordinators();
    loadTutors();
  }, []);

  useEffect(() => {
    filterDisciplines();
  }, [searchTerm, disciplines, sortOrder]);

  const loadCourses = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'curs-pos-mensal'));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Course[];
      data.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      setCourses(data);
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  };

  const loadProfessors = async () => {
    try {
      const q = query(collection(db, 'user-pos'), where('tipo', '==', 'Professor'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => {
        const docData = doc.data();
        let firstName = docData.firstName || '';
        let lastName = docData.lastName || '';
        
        if (docData.nome && (!firstName || !lastName)) {
          const nameParts = docData.nome.trim().split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        }
        
        return {
          id: doc.id,
          tipo: docData.tipo,
          firstName,
          lastName,
          login: docData.login,
          email: docData.email,
          senha: docData.senha,
          courseId: docData.courseId,
          courseName: docData.courseName,
          createdAt: docData.createdAt?.toDate() || new Date(),
        } as Person;
      });
      data.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB, 'pt-BR');
      });
      setProfessors(data);
    } catch (error) {
      console.error('Error loading professors:', error);
    }
  };

  const loadCoordinators = async () => {
    try {
      const q = query(collection(db, 'user-pos'), where('tipo', '==', 'Coordenador'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => {
        const docData = doc.data();
        let firstName = docData.firstName || '';
        let lastName = docData.lastName || '';
        
        if (docData.nome && (!firstName || !lastName)) {
          const nameParts = docData.nome.trim().split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        }
        
        return {
          id: doc.id,
          tipo: docData.tipo,
          firstName,
          lastName,
          login: docData.login,
          email: docData.email,
          senha: docData.senha,
          courseId: docData.courseId,
          courseName: docData.courseName,
          createdAt: docData.createdAt?.toDate() || new Date(),
        } as Person;
      });
      data.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB, 'pt-BR');
      });
      setCoordinators(data);
    } catch (error) {
      console.error('Error loading coordinators:', error);
    }
  };

  const loadTutors = async () => {
    try {
      const q = query(collection(db, 'user-pos'), where('tipo', '==', 'Tutor'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => {
        const docData = doc.data();
        let firstName = docData.firstName || '';
        let lastName = docData.lastName || '';
        
        if (docData.nome && (!firstName || !lastName)) {
          const nameParts = docData.nome.trim().split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        }
        
        return {
          id: doc.id,
          tipo: docData.tipo,
          firstName,
          lastName,
          login: docData.login,
          email: docData.email,
          senha: docData.senha,
          courseId: docData.courseId,
          courseName: docData.courseName,
          createdAt: docData.createdAt?.toDate() || new Date(),
        } as Person;
      });
      data.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB, 'pt-BR');
      });
      setTutors(data);
    } catch (error) {
      console.error('Error loading tutors:', error);
    }
  };

  const loadDisciplines = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'disc-pos-mensal'));
      const data = snapshot.docs.map((doc) => {
        const docData = doc.data();
        return {
          id: doc.id,
          name: docData.name || '',
          courseIds: docData.courseIds || [],
          courseNames: docData.courseNames || [],
          coordinatorLogin: docData.coordinatorLogin || '',
          professorLogin: docData.professorLogin || '',
          tutorLogin: docData.tutorLogin || '',
          'mes-1': docData['mes-1'] || '',
          'mes-2': docData['mes-2'] || '',
          createdAt: docData.createdAt?.toDate() || new Date(),
          updatedAt: docData.updatedAt?.toDate() || new Date(),
        } as Discipline;
      });
      setDisciplines(data);
    } catch (error) {
      console.error('Error loading disciplines:', error);
      toast({
        title: 'Erro ao carregar disciplinas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterDisciplines = () => {
    let filtered = [...disciplines];
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(d => 
        d.name.toLowerCase().includes(search) ||
        d.courseNames?.some(cn => cn.toLowerCase().includes(search)) ||
        d.professorLogin?.toLowerCase().includes(search)
      );
    }
    
    if (sortOrder === 'alphabetical') {
      filtered.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    } else {
      filtered.sort((a, b) => {
        const monthA = parseInt(a['mes-1'] || '99');
        const monthB = parseInt(b['mes-1'] || '99');
        return monthA - monthB;
      });
    }
    
    setFilteredDisciplines(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast({
        title: 'Preencha o nome da disciplina',
        variant: 'destructive',
      });
      return;
    }

    if (formData.courseIds.length === 0) {
      toast({
        title: 'Selecione pelo menos um curso',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const courseNames = courses
        .filter(c => formData.courseIds.includes(c.id))
        .map(c => c.name);

      const disciplineData: any = {
        name: formData.name,
        courseIds: formData.courseIds,
        courseNames: courseNames,
        coordinatorLogin: formData.coordinatorLogin || '',
        professorLogin: formData.professorLogin || '',
        tutorLogin: formData.tutorLogin || '',
        'mes-1': formData['mes-1'] || '',
        'mes-2': formData['mes-2'] || '',
        updatedAt: Timestamp.now(),
      };

      if (editingDiscipline) {
        await updateDoc(doc(db, 'disc-pos-mensal', editingDiscipline.id), disciplineData);
        
        if (userData) {
          await logAction(
            userData.id,
            userData.email,
            'update',
            'discipline',
            editingDiscipline.id,
            formData.name,
            {
              name: { before: editingDiscipline.name, after: formData.name },
              courseIds: { before: editingDiscipline.courseIds, after: formData.courseIds },
            }
          );
        }
        
        toast({ title: 'Disciplina atualizada com sucesso!' });
      } else {
        const docRef = await addDoc(collection(db, 'disc-pos-mensal'), {
          ...disciplineData,
          createdAt: Timestamp.now(),
        });
        
        if (userData) {
          await logAction(
            userData.id,
            userData.email,
            'create',
            'discipline',
            docRef.id,
            formData.name
          );
        }
        
        toast({ title: 'Disciplina criada com sucesso!' });
      }
      
      setDialogOpen(false);
      setFormData({ 
        name: '',
        courseIds: [],
        coordinatorLogin: '',
        professorLogin: '',
        tutorLogin: '',
        'mes-1': '',
        'mes-2': ''
      });
      setEditingDiscipline(null);
      loadDisciplines();
      onDataChange?.();
    } catch (error) {
      console.error('Error saving discipline:', error);
      toast({
        title: 'Erro ao salvar disciplina',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (discipline: Discipline) => {
    setEditingDiscipline(discipline);
    setFormData({
      name: discipline.name,
      courseIds: discipline.courseIds || [],
      coordinatorLogin: discipline.coordinatorLogin || '',
      professorLogin: discipline.professorLogin || '',
      tutorLogin: discipline.tutorLogin || '',
      'mes-1': discipline['mes-1'] || '',
      'mes-2': discipline['mes-2'] || '',
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = (discipline: Discipline) => {
    setDisciplineToDelete(discipline);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!disciplineToDelete) return;

    try {
      await deleteDoc(doc(db, 'disc-pos-mensal', disciplineToDelete.id));
      
      if (userData) {
        await logAction(
          userData.id,
          userData.email,
          'delete',
          'discipline',
          disciplineToDelete.id,
          disciplineToDelete.name
        );
      }
      
      toast({ title: 'Disciplina excluída com sucesso!' });
      loadDisciplines();
      onDataChange?.();
      setDeleteDialogOpen(false);
      setDisciplineToDelete(null);
    } catch (error) {
      console.error('Error deleting discipline:', error);
      toast({
        title: 'Erro ao excluir disciplina',
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingDiscipline(null);
    setFormData({
      name: '',
      courseIds: [],
      coordinatorLogin: '',
      professorLogin: '',
      tutorLogin: '',
      'mes-1': '',
      'mes-2': ''
    });
  };

  const getMonthLabel = (value: string) => {
    const month = MONTHS.find(m => m.value === value);
    return month ? month.label : value;
  };

  // Batch upload functions
  const handleDownloadTemplate = () => {
    const templateData = [
      { 
        'Nome da Disciplina': 'Inteligência Artificial', 
        'Nome do Curso': 'Mestrado em Ciência da Computação',
        'Login do Coordenador': 'joao.silva',
        'Login do Professor': 'maria.santos',
        'Login do Tutor': 'carlos.oliveira',
        'Mês 1': '3',
        'Mês 2': '9'
      },
      { 
        'Nome da Disciplina': 'Marketing Digital', 
        'Nome do Curso': 'MBA em Marketing',
        'Login do Coordenador': 'ana.costa',
        'Login do Professor': 'pedro.lima',
        'Login do Tutor': '',
        'Mês 1': '5',
        'Mês 2': ''
      },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Disciplinas');
    XLSX.writeFile(wb, 'template_disciplinas.xlsx');
    toast({ title: 'Template baixado com sucesso!' });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        toast({ title: 'Planilha vazia', variant: 'destructive' });
        return;
      }

      // Buscar todos os usuários e cursos para validar
      const peopleSnapshot = await getDocs(collection(db, 'user-pos'));
      const existingPeopleByLogin = new Map<string, any>(
        peopleSnapshot.docs.map(doc => [doc.data().login?.toLowerCase(), { id: doc.id, ...doc.data() }])
      );

      const coursesSnapshot = await getDocs(collection(db, 'curs-pos-mensal'));
      const existingCoursesByName = new Map<string, any>(
        coursesSnapshot.docs.map(doc => [doc.data().name?.toLowerCase(), { id: doc.id, ...doc.data() }])
      );

      // Enriquecer os dados com validações
      const enrichedData = jsonData.map((row) => {
        const courseName = row['Nome do Curso']?.trim();
        const coordinatorLogin = row['Login do Coordenador']?.trim();
        const professorLogin = row['Login do Professor']?.trim();
        const tutorLogin = row['Login do Tutor']?.trim();

        const course = courseName ? existingCoursesByName.get(courseName.toLowerCase()) : null;
        const coordinator = coordinatorLogin ? existingPeopleByLogin.get(coordinatorLogin.toLowerCase()) : null;
        const professor = professorLogin ? existingPeopleByLogin.get(professorLogin.toLowerCase()) : null;
        const tutor = tutorLogin ? existingPeopleByLogin.get(tutorLogin.toLowerCase()) : null;

        return {
          ...row,
          courseFound: !!course,
          courseId: course?.id,
          coordinatorFound: coordinatorLogin ? !!coordinator : true,
          coordinatorFullName: coordinator ? `${coordinator.firstName} ${coordinator.lastName}` : null,
          professorFound: professorLogin ? !!professor : true,
          professorFullName: professor ? `${professor.firstName} ${professor.lastName}` : null,
          tutorFound: tutorLogin ? !!tutor : true,
          tutorFullName: tutor ? `${tutor.firstName} ${tutor.lastName}` : null,
        };
      });

      setPreviewData(enrichedData);
      setPreviewOpen(true);
    } catch (error) {
      console.error('Error reading file:', error);
      toast({ title: 'Erro ao ler arquivo', variant: 'destructive' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    setUploading(true);
    setPreviewOpen(false);
    const result = { created: [] as string[], ignored: [] as string[], errors: [] as string[] };
    
    try {
      const disciplinesSnapshot = await getDocs(collection(db, 'disc-pos-mensal'));
      const existingDisciplines = new Map(
        disciplinesSnapshot.docs.map(doc => [doc.data().name?.toLowerCase(), doc.id])
      );

      const coursesSnapshot = await getDocs(collection(db, 'curs-pos-mensal'));
      const existingCoursesByName = new Map<string, any>(
        coursesSnapshot.docs.map(doc => [doc.data().name?.toLowerCase(), { id: doc.id, name: doc.data().name }])
      );

      const peopleSnapshot = await getDocs(collection(db, 'user-pos'));
      const existingPeopleByLogin = new Map<string, any>(
        peopleSnapshot.docs.map(doc => [doc.data().login?.toLowerCase(), { id: doc.id, ...doc.data() }])
      );

      let rowNum = 1;
      
      for (const row of previewData) {
        rowNum++;
        try {
          const disciplineName = row['Nome da Disciplina']?.trim();
          const courseName = row['Nome do Curso']?.trim();
          const coordinatorLogin = row['Login do Coordenador']?.trim();
          const professorLogin = row['Login do Professor']?.trim();
          const tutorLogin = row['Login do Tutor']?.trim();
          const mes1 = row['Mês 1']?.toString().trim();
          const mes2 = row['Mês 2']?.toString().trim();
          
          if (!disciplineName) {
            result.errors.push(`Linha ${rowNum}: Nome da Disciplina é obrigatório`);
            continue;
          }

          if (!courseName) {
            result.errors.push(`Linha ${rowNum}: Nome do Curso é obrigatório`);
            continue;
          }

          // Buscar curso
          const course = existingCoursesByName.get(courseName.toLowerCase());
          if (!course) {
            result.errors.push(`Linha ${rowNum}: Curso "${courseName}" não encontrado`);
            continue;
          }

          // Validar coordenador se fornecido
          if (coordinatorLogin && !existingPeopleByLogin.get(coordinatorLogin.toLowerCase())) {
            result.errors.push(`Linha ${rowNum}: Coordenador com login "${coordinatorLogin}" não encontrado`);
            continue;
          }

          // Validar professor se fornecido
          if (professorLogin && !existingPeopleByLogin.get(professorLogin.toLowerCase())) {
            result.errors.push(`Linha ${rowNum}: Professor com login "${professorLogin}" não encontrado`);
            continue;
          }

          // Validar tutor se fornecido
          if (tutorLogin && !existingPeopleByLogin.get(tutorLogin.toLowerCase())) {
            result.errors.push(`Linha ${rowNum}: Tutor com login "${tutorLogin}" não encontrado`);
            continue;
          }

          // Verificar se disciplina já existe
          const existingDisciplineId = existingDisciplines.get(disciplineName.toLowerCase());
          
          if (existingDisciplineId) {
            // Atualizar disciplina existente adicionando o curso
            const existingDoc = disciplinesSnapshot.docs.find(d => d.id === existingDisciplineId);
            if (existingDoc) {
              const existingData = existingDoc.data();
              const currentCourseIds = existingData.courseIds || [];
              const currentCourseNames = existingData.courseNames || [];

              if (!currentCourseIds.includes(course.id)) {
                if (currentCourseIds.length >= 15) {
                  result.errors.push(`Linha ${rowNum}: Disciplina "${disciplineName}" já tem 15 cursos vinculados`);
                  continue;
                }

                await updateDoc(doc(db, 'disc-pos-mensal', existingDisciplineId), {
                  courseIds: [...currentCourseIds, course.id],
                  courseNames: [...currentCourseNames, course.name],
                  updatedAt: Timestamp.now(),
                });
                result.created.push(`Linha ${rowNum}: Curso "${courseName}" vinculado à disciplina "${disciplineName}"`);
              } else {
                result.ignored.push(`Linha ${rowNum}: Disciplina "${disciplineName}" já vinculada ao curso "${courseName}"`);
              }
            }
          } else {
            // Criar nova disciplina
            const disciplineData: any = {
              name: disciplineName,
              courseIds: [course.id],
              courseNames: [course.name],
              coordinatorLogin: coordinatorLogin || '',
              professorLogin: professorLogin || '',
              tutorLogin: tutorLogin || '',
              'mes-1': mes1 || '',
              'mes-2': mes2 || '',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            };

            const docRef = await addDoc(collection(db, 'disc-pos-mensal'), disciplineData);
            existingDisciplines.set(disciplineName.toLowerCase(), docRef.id);
            result.created.push(`Linha ${rowNum}: Disciplina "${disciplineName}" criada`);
          }
        } catch (error) {
          console.error(`Error processing row ${rowNum}:`, error);
          result.errors.push(`Linha ${rowNum}: Erro ao processar`);
        }
      }

      setUploadResult(result);
      setUploadResultOpen(true);
      setPreviewData([]);
      loadDisciplines();
      onDataChange?.();
    } catch (error) {
      console.error('Error uploading:', error);
      toast({ title: 'Erro ao importar', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Disciplinas</CardTitle>
              <CardDescription>Gerencie as disciplinas</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Template
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" />Importar Excel</>
                )}
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleDialogClose()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Disciplina
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingDiscipline ? 'Editar Disciplina' : 'Nova Disciplina'}
                    </DialogTitle>
                    <DialogDescription>
                      Preencha os dados da disciplina
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome da Disciplina *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: Inteligência Artificial"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Cursos * (até 15)</Label>
                      <ScrollArea className="h-[150px] border rounded-lg p-3">
                        <div className="space-y-2">
                          {courses.map((course) => (
                            <div key={course.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`course-${course.id}`}
                                checked={formData.courseIds.includes(course.id)}
                                disabled={
                                  formData.courseIds.length >= 15 &&
                                  !formData.courseIds.includes(course.id)
                                }
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData({
                                      ...formData,
                                      courseIds: [...formData.courseIds, course.id],
                                    });
                                  } else {
                                    setFormData({
                                      ...formData,
                                      courseIds: formData.courseIds.filter(id => id !== course.id),
                                    });
                                  }
                                }}
                              />
                              <label
                                htmlFor={`course-${course.id}`}
                                className="text-sm cursor-pointer"
                              >
                                {course.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <p className="text-xs text-muted-foreground">
                        {formData.courseIds.length}/15 cursos selecionados
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Coordenador</Label>
                        <Popover open={coordinatorPopoverOpen} onOpenChange={setCoordinatorPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={coordinatorPopoverOpen}
                              className="w-full justify-between"
                            >
                              {formData.coordinatorLogin
                                ? (() => {
                                    const coord = coordinators.find((c) => c.login === formData.coordinatorLogin);
                                    return coord ? `${coord.firstName} ${coord.lastName}` : formData.coordinatorLogin;
                                  })()
                                : "Selecionar..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0 bg-popover">
                            <Command>
                              <CommandInput placeholder="Buscar coordenador..." />
                              <CommandList>
                                <CommandEmpty>Nenhum coordenador encontrado.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value=""
                                    onSelect={() => {
                                      setFormData({ ...formData, coordinatorLogin: '' });
                                      setCoordinatorPopoverOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", !formData.coordinatorLogin ? "opacity-100" : "opacity-0")} />
                                    Nenhum
                                  </CommandItem>
                                  {coordinators.map((coordinator) => (
                                    <CommandItem
                                      key={coordinator.id}
                                      value={`${coordinator.firstName} ${coordinator.lastName} ${coordinator.login}`}
                                      onSelect={() => {
                                        setFormData({ ...formData, coordinatorLogin: coordinator.login });
                                        setCoordinatorPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.coordinatorLogin === coordinator.login ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {coordinator.firstName} {coordinator.lastName} ({coordinator.login})
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>Professor</Label>
                        <Popover open={professorPopoverOpen} onOpenChange={setProfessorPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={professorPopoverOpen}
                              className="w-full justify-between"
                            >
                              {formData.professorLogin
                                ? (() => {
                                    const prof = professors.find((p) => p.login === formData.professorLogin);
                                    return prof ? `${prof.firstName} ${prof.lastName}` : formData.professorLogin;
                                  })()
                                : "Selecionar..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0 bg-popover">
                            <Command>
                              <CommandInput placeholder="Buscar professor..." />
                              <CommandList>
                                <CommandEmpty>Nenhum professor encontrado.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value=""
                                    onSelect={() => {
                                      setFormData({ ...formData, professorLogin: '' });
                                      setProfessorPopoverOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", !formData.professorLogin ? "opacity-100" : "opacity-0")} />
                                    Nenhum
                                  </CommandItem>
                                  {professors.map((professor) => (
                                    <CommandItem
                                      key={professor.id}
                                      value={`${professor.firstName} ${professor.lastName} ${professor.login}`}
                                      onSelect={() => {
                                        setFormData({ ...formData, professorLogin: professor.login });
                                        setProfessorPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.professorLogin === professor.login ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {professor.firstName} {professor.lastName} ({professor.login})
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>Tutor</Label>
                        <Popover open={tutorPopoverOpen} onOpenChange={setTutorPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={tutorPopoverOpen}
                              className="w-full justify-between"
                            >
                              {formData.tutorLogin
                                ? (() => {
                                    const tutor = tutors.find((t) => t.login === formData.tutorLogin);
                                    return tutor ? `${tutor.firstName} ${tutor.lastName}` : formData.tutorLogin;
                                  })()
                                : "Selecionar..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0 bg-popover">
                            <Command>
                              <CommandInput placeholder="Buscar tutor..." />
                              <CommandList>
                                <CommandEmpty>Nenhum tutor encontrado.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value=""
                                    onSelect={() => {
                                      setFormData({ ...formData, tutorLogin: '' });
                                      setTutorPopoverOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", !formData.tutorLogin ? "opacity-100" : "opacity-0")} />
                                    Nenhum
                                  </CommandItem>
                                  {tutors.map((tutor) => (
                                    <CommandItem
                                      key={tutor.id}
                                      value={`${tutor.firstName} ${tutor.lastName} ${tutor.login}`}
                                      onSelect={() => {
                                        setFormData({ ...formData, tutorLogin: tutor.login });
                                        setTutorPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.tutorLogin === tutor.login ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {tutor.firstName} {tutor.lastName} ({tutor.login})
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Mês 1</Label>
                        <Select
                          value={formData['mes-1'] || 'none'}
                          onValueChange={(value) => setFormData({ ...formData, 'mes-1': value === 'none' ? '' : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o mês" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {MONTHS.map((month) => (
                              <SelectItem key={month.value} value={month.value}>
                                {month.value} - {month.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Mês 2</Label>
                        <Select
                          value={formData['mes-2'] || 'none'}
                          onValueChange={(value) => setFormData({ ...formData, 'mes-2': value === 'none' ? '' : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o mês" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {MONTHS.map((month) => (
                              <SelectItem key={month.value} value={month.value}>
                                {month.value} - {month.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleDialogClose}
                        disabled={saving}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          'Salvar'
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Input
              placeholder="Buscar por nome, curso ou professor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as any)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Ordenar por Mês</SelectItem>
                <SelectItem value="alphabetical">Ordem Alfabética</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {filteredDisciplines.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nenhuma disciplina encontrada.</p>
              </div>
            ) : (
              filteredDisciplines.map((discipline) => (
                <div
                  key={discipline.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{discipline.name}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {discipline.courseNames?.map((courseName, idx) => (
                          <Badge key={idx} variant="secondary">{courseName}</Badge>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3 text-sm">
                        {discipline.coordinatorLogin && (
                          <div>
                            <span className="text-muted-foreground">Coordenador:</span>{' '}
                            {(() => {
                              const coord = coordinators.find(c => c.login === discipline.coordinatorLogin);
                              return coord ? `${coord.firstName} ${coord.lastName} (${coord.login})` : discipline.coordinatorLogin;
                            })()}
                          </div>
                        )}
                        {discipline.professorLogin && (
                          <div>
                            <span className="text-muted-foreground">Professor:</span>{' '}
                            {(() => {
                              const prof = professors.find(p => p.login === discipline.professorLogin);
                              return prof ? `${prof.firstName} ${prof.lastName} (${prof.login})` : discipline.professorLogin;
                            })()}
                          </div>
                        )}
                        {discipline.tutorLogin && (
                          <div>
                            <span className="text-muted-foreground">Tutor:</span>{' '}
                            {(() => {
                              const tutor = tutors.find(t => t.login === discipline.tutorLogin);
                              return tutor ? `${tutor.firstName} ${tutor.lastName} (${tutor.login})` : discipline.tutorLogin;
                            })()}
                          </div>
                        )}
                        {discipline['mes-1'] && (
                          <div>
                            <span className="text-muted-foreground">Mês 1:</span>{' '}
                            {getMonthLabel(discipline['mes-1'])}
                          </div>
                        )}
                        {discipline['mes-2'] && (
                          <div>
                            <span className="text-muted-foreground">Mês 2:</span>{' '}
                            {getMonthLabel(discipline['mes-2'])}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(discipline)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(discipline)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a disciplina <strong>{disciplineToDelete?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pré-visualização da Importação</DialogTitle>
            <DialogDescription>
              Verifique os dados antes de confirmar a importação
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Coordenador</TableHead>
                  <TableHead>Professor</TableHead>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((row, idx) => {
                  const hasError = !row.courseFound || !row.coordinatorFound || !row.professorFound || !row.tutorFound;
                  return (
                    <TableRow key={idx} className={hasError ? 'bg-destructive/10' : ''}>
                      <TableCell>{row['Nome da Disciplina']}</TableCell>
                      <TableCell>
                        {row['Nome do Curso']}
                        {!row.courseFound && (
                          <span className="text-destructive ml-2">
                            <AlertCircle className="h-4 w-4 inline" /> Não encontrado
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.coordinatorFullName || row['Login do Coordenador'] || '-'}
                        {row['Login do Coordenador'] && !row.coordinatorFound && (
                          <span className="text-destructive ml-2">
                            <AlertCircle className="h-4 w-4 inline" /> Não encontrado
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.professorFullName || row['Login do Professor'] || '-'}
                        {row['Login do Professor'] && !row.professorFound && (
                          <span className="text-destructive ml-2">
                            <AlertCircle className="h-4 w-4 inline" /> Não encontrado
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.tutorFullName || row['Login do Tutor'] || '-'}
                        {row['Login do Tutor'] && !row.tutorFound && (
                          <span className="text-destructive ml-2">
                            <AlertCircle className="h-4 w-4 inline" /> Não encontrado
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasError ? (
                          <Badge variant="destructive">Erro</Badge>
                        ) : (
                          <Badge variant="default">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmImport} disabled={uploading}>
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</>
              ) : (
                'Confirmar Importação'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Result Dialog */}
      <Dialog open={uploadResultOpen} onOpenChange={setUploadResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resultado da Importação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {uploadResult.created.length > 0 && (
              <div>
                <h4 className="font-semibold text-green-600 mb-2">
                  Criados ({uploadResult.created.length})
                </h4>
                <ScrollArea className="h-[100px] border rounded p-2">
                  {uploadResult.created.map((item, idx) => (
                    <p key={idx} className="text-sm">{item}</p>
                  ))}
                </ScrollArea>
              </div>
            )}
            {uploadResult.ignored.length > 0 && (
              <div>
                <h4 className="font-semibold text-yellow-600 mb-2">
                  Ignorados ({uploadResult.ignored.length})
                </h4>
                <ScrollArea className="h-[100px] border rounded p-2">
                  {uploadResult.ignored.map((item, idx) => (
                    <p key={idx} className="text-sm">{item}</p>
                  ))}
                </ScrollArea>
              </div>
            )}
            {uploadResult.errors.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-600 mb-2">
                  Erros ({uploadResult.errors.length})
                </h4>
                <ScrollArea className="h-[100px] border rounded p-2">
                  {uploadResult.errors.map((item, idx) => (
                    <p key={idx} className="text-sm">{item}</p>
                  ))}
                </ScrollArea>
              </div>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={() => setUploadResultOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DisciplinesTab;
