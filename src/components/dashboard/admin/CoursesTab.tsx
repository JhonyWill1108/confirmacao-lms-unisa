import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Course, Person } from '@/types';
import { Plus, Loader2, Edit, Trash2, Download, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import * as XLSX from 'xlsx';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';

interface CoursesTabProps {
  onDataChange?: () => void;
}

const CoursesTab = ({ onDataChange }: CoursesTabProps) => {
  const { userData } = useAuth();
  const { logAction } = useAuditLog();
  const [courses, setCourses] = useState<Course[]>([]);
  const [coordinators, setCoordinators] = useState<Person[]>([]);
  const [tutors, setTutors] = useState<Person[]>([]);
  const [disciplines, setDisciplines] = useState<any[]>([]);
  const [selectedDisciplineIds, setSelectedDisciplineIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState({ name: '', coordinatorId: '', tutorId: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResultOpen, setUploadResultOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadResult, setUploadResult] = useState<{
    created: string[];
    ignored: string[];
    errors: string[];
  }>({ created: [], ignored: [], errors: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCourses();
    loadCoordinators();
    loadTutors();
    loadDisciplines();
  }, []);

  const loadCoordinators = async () => {
    try {
      const q = query(collection(db, 'user-pos'), where('tipo', '==', 'Coordenador'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => {
        const docData = doc.data();
        
        // Normalizar dados
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
        
        // Normalizar dados
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
      setTutors(data);
    } catch (error) {
      console.error('Error loading tutors:', error);
    }
  };

  const loadCourses = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'curs-pos-mensal'));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Course[];
      
      // Ordenar cursos alfabeticamente
      data.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      
      setCourses(data);
    } catch (error) {
      console.error('Error loading courses:', error);
      toast({
        title: 'Erro ao carregar cursos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDisciplines = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'disc-pos-mensal'));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Ordenar disciplinas alfabeticamente
      data.sort((a: any, b: any) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB, 'pt-BR');
      });
      
      setDisciplines(data);
    } catch (error) {
      console.error('Error loading disciplines:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast({
        title: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    // Validar limite de 8 cursos por coordenador
    if (formData.coordinatorId && formData.coordinatorId !== 'none') {
      const coordinatorCourses = courses.filter(c => 
        c.coordinatorId === formData.coordinatorId && 
        (!editingCourse || c.id !== editingCourse.id)
      );
      
      if (coordinatorCourses.length >= 8) {
        toast({
          title: 'Limite atingido',
          description: 'Este coordenador já está atribuído a 8 cursos (limite máximo)',
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(true);
    try {
      const courseData: any = {
        name: formData.name,
      };

      // Se coordenador for "none", limpar o campo
      if (!formData.coordinatorId || formData.coordinatorId === 'none') {
        courseData.coordinatorId = null;
        courseData.coordinatorName = null;
      } else {
        const selectedCoordinator = coordinators.find(c => c.id === formData.coordinatorId);
        courseData.coordinatorId = formData.coordinatorId;
        courseData.coordinatorName = selectedCoordinator ? `${selectedCoordinator.firstName} ${selectedCoordinator.lastName}` : '';
      }

      // Se tutor for "none", limpar o campo
      if (!formData.tutorId || formData.tutorId === 'none') {
        courseData.tutorId = null;
        courseData.tutorName = null;
      } else {
        const selectedTutor = tutors.find(t => t.id === formData.tutorId);
        courseData.tutorId = formData.tutorId;
        courseData.tutorName = selectedTutor ? `${selectedTutor.firstName} ${selectedTutor.lastName}` : '';
      }
      
      if (editingCourse) {
        await updateDoc(doc(db, 'curs-pos-mensal', editingCourse.id), courseData);
        
        // Atualizar disciplinas selecionadas
        await updateCourseDisciplines(editingCourse.id, formData.name);
        
        // Log audit
        if (userData) {
          await logAction(
            userData.id,
            userData.email,
            'update',
            'course',
            editingCourse.id,
            formData.name,
            {
              name: { before: editingCourse.name, after: formData.name },
              coordinatorId: { before: editingCourse.coordinatorId, after: courseData.coordinatorId },
            }
          );
        }
        
        toast({ title: 'Curso atualizado com sucesso!' });
        onDataChange?.();
      } else {
        const docRef = await addDoc(collection(db, 'curs-pos-mensal'), {
          ...courseData,
          createdAt: Timestamp.now(),
        });
        
        // Atualizar disciplinas selecionadas com o novo curso
        await updateCourseDisciplines(docRef.id, formData.name);
        
        // Log audit
        if (userData) {
          await logAction(
            userData.id,
            userData.email,
            'create',
            'course',
            docRef.id,
            formData.name
          );
        }
        
        toast({ title: 'Curso criado com sucesso!' });
        onDataChange?.();
      }
      
      setDialogOpen(false);
      setFormData({ name: '', coordinatorId: '', tutorId: '' });
      setSelectedDisciplineIds(new Set());
      setEditingCourse(null);
      loadCourses();
      loadDisciplines();
    } catch (error) {
      console.error('Error saving course:', error);
      toast({
        title: 'Erro ao salvar curso',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateCourseDisciplines = async (courseId: string, courseName: string) => {
    try {
      // Atualizar todas as disciplinas para remover este curso
      const allDisciplinesSnapshot = await getDocs(collection(db, 'disc-pos-mensal'));
      
      for (const disciplineDoc of allDisciplinesSnapshot.docs) {
        const disciplineData = disciplineDoc.data();
        const currentCourseIds = disciplineData.courseIds || [];
        const currentCourseNames = disciplineData.courseNames || [];
        
        // Se esta disciplina estava vinculada ao curso, remover
        const indexToRemove = currentCourseIds.indexOf(courseId);
        if (indexToRemove > -1) {
          currentCourseIds.splice(indexToRemove, 1);
          currentCourseNames.splice(indexToRemove, 1);
          
          await updateDoc(doc(db, 'disc-pos-mensal', disciplineDoc.id), {
            courseIds: currentCourseIds,
            courseNames: currentCourseNames,
            updatedAt: Timestamp.now(),
          });
        }
      }
      
      // Adicionar o curso às disciplinas selecionadas
      for (const disciplineId of selectedDisciplineIds) {
        const disciplineSnapshot = await getDocs(query(collection(db, 'disc-pos-mensal'), where('__name__', '==', disciplineId)));
        
        if (!disciplineSnapshot.empty) {
          const disciplineData = disciplineSnapshot.docs[0].data();
          const currentCourseIds = disciplineData.courseIds || [];
          const currentCourseNames = disciplineData.courseNames || [];
          
          // Limitar a 15 cursos
          if (currentCourseIds.length >= 15 && !currentCourseIds.includes(courseId)) {
            toast({
              title: 'Aviso',
              description: `A disciplina "${disciplineData.name}" já está vinculada a 15 cursos (limite máximo)`,
              variant: 'destructive',
            });
            continue;
          }
          
          // Adicionar curso se não existir
          if (!currentCourseIds.includes(courseId)) {
            currentCourseIds.push(courseId);
            currentCourseNames.push(courseName);
            
            await updateDoc(doc(db, 'disc-pos-mensal', disciplineId), {
              courseIds: currentCourseIds,
              courseNames: currentCourseNames,
              updatedAt: Timestamp.now(),
            });
          }
        }
      }
    } catch (error) {
      console.error('Error updating course disciplines:', error);
      toast({
        title: 'Erro ao vincular disciplinas',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = async (course: Course) => {
    setEditingCourse(course);
    setFormData({
      name: course.name,
      coordinatorId: course.coordinatorId || '',
      tutorId: course.tutorId || '',
    });
    
    // Carregar disciplinas vinculadas a este curso
    const disciplinesSnapshot = await getDocs(collection(db, 'disc-pos-mensal'));
    const linkedDisciplineIds = new Set<string>();
    
    disciplinesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const courseIds = data.courseIds || [];
      if (courseIds.includes(course.id)) {
        linkedDisciplineIds.add(doc.id);
      }
    });
    
    setSelectedDisciplineIds(linkedDisciplineIds);
    setDialogOpen(true);
  };

  const handleDeleteClick = (course: Course) => {
    setCourseToDelete(course);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!courseToDelete) return;

    try {
      await deleteDoc(doc(db, 'curs-pos-mensal', courseToDelete.id));
      
      // Log audit
      if (userData) {
        await logAction(
          userData.id,
          userData.email,
          'delete',
          'course',
          courseToDelete.id,
          courseToDelete.name
        );
      }
      
      toast({ title: 'Curso excluído com sucesso!' });
      onDataChange?.();
      loadCourses();
      setDeleteDialogOpen(false);
      setCourseToDelete(null);
    } catch (error) {
      console.error('Error deleting course:', error);
      toast({
        title: 'Erro ao excluir curso',
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingCourse(null);
    setFormData({ name: '', coordinatorId: '', tutorId: '' });
    setSelectedDisciplineIds(new Set());
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { 
        'Nome do Curso': 'Mestrado em Ciência da Computação', 
        'Login do Coordenador': 'joao.silva',
        'Login do Tutor': 'carlos.oliveira'
      },
      { 
        'Nome do Curso': 'MBA em Marketing Digital', 
        'Login do Coordenador': 'maria.santos',
        'Login do Tutor': ''
      },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Cursos');
    XLSX.writeFile(wb, 'template_cursos.xlsx');
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

      // Buscar todos os usuários para validar coordenadores e tutores
      const peopleSnapshot = await getDocs(collection(db, 'user-pos'));
      const existingPeopleByLogin = new Map<string, any>(
        peopleSnapshot.docs.map(doc => [doc.data().login.toLowerCase(), { id: doc.id, ...doc.data() }])
      );

      // Enriquecer os dados com informações de coordenadores e tutores
      const enrichedData = jsonData.map((row) => {
        const coordinatorLogin = row['Login do Coordenador']?.trim();
        const tutorLogin = row['Login do Tutor']?.trim();

        const coordinator = coordinatorLogin 
          ? existingPeopleByLogin.get(coordinatorLogin.toLowerCase())
          : null;
        
        const tutor = tutorLogin 
          ? existingPeopleByLogin.get(tutorLogin.toLowerCase())
          : null;

        return {
          ...row,
          coordinatorFound: !!coordinator,
          coordinatorFullName: coordinator 
            ? `${coordinator.firstName} ${coordinator.lastName}`
            : null,
          tutorFound: tutorLogin ? !!tutor : true, // Se não forneceu tutor, considera como "ok"
          tutorFullName: tutor 
            ? `${tutor.firstName} ${tutor.lastName}`
            : null,
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
      // Carregar cursos e pessoas existentes
      const coursesSnapshot = await getDocs(collection(db, 'curs-pos-mensal'));
      const existingCourses = new Set(
        coursesSnapshot.docs.map(doc => doc.data().name.toLowerCase())
      );

      const peopleSnapshot = await getDocs(collection(db, 'user-pos'));
      const existingPeopleByLogin = new Map<string, any>(
        peopleSnapshot.docs.map(doc => [doc.data().login.toLowerCase(), { id: doc.id, ...doc.data() }])
      );

      let rowNum = 1;
      
      for (const row of previewData) {
        rowNum++;
        try {
          const courseName = row['Nome do Curso']?.trim();
          const coordinatorLogin = row['Login do Coordenador']?.trim();
          const tutorLogin = row['Login do Tutor']?.trim();
          
          if (!courseName || !coordinatorLogin) {
            result.errors.push(`Linha ${rowNum}: Nome do Curso e Login do Coordenador são obrigatórios`);
            continue;
          }

          // Verificar se curso já existe
          if (existingCourses.has(courseName.toLowerCase())) {
            result.ignored.push(`Linha ${rowNum}: Curso "${courseName}" já existe`);
            continue;
          }

          // Buscar coordenador pelo login
          const coordinator = existingPeopleByLogin.get(coordinatorLogin.toLowerCase());
          if (!coordinator) {
            result.errors.push(`Linha ${rowNum}: Coordenador com login "${coordinatorLogin}" não encontrado`);
            continue;
          }

          // Buscar tutor pelo login se fornecido
          let tutorId = '';
          let tutorName = '';
          if (tutorLogin) {
            const tutor = existingPeopleByLogin.get(tutorLogin.toLowerCase());
            if (!tutor) {
              result.errors.push(`Linha ${rowNum}: Tutor com login "${tutorLogin}" não encontrado`);
              continue;
            }
            tutorId = tutor.id;
            tutorName = `${tutor.firstName} ${tutor.lastName}`;
          }

          // Criar curso
          const courseData: any = {
            name: courseName,
            coordinatorId: coordinator.id,
            coordinatorName: `${coordinator.firstName} ${coordinator.lastName}`,
            createdAt: Timestamp.now(),
          };

          if (tutorId) {
            courseData.tutorId = tutorId;
            courseData.tutorName = tutorName;
          }

          await addDoc(collection(db, 'curs-pos-mensal'), courseData);
          existingCourses.add(courseName.toLowerCase());
          result.created.push(`Curso: ${courseName}`);
        } catch (error) {
          console.error(`Error processing row ${rowNum}:`, error);
          result.errors.push(`Linha ${rowNum}: Erro ao processar`);
        }
      }

      setUploadResult(result);
      setUploadResultOpen(true);
      setPreviewData([]);
      loadCourses();
      loadCoordinators();
      loadTutors();
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
              <CardTitle>Cursos de Pós-Graduação</CardTitle>
              <CardDescription>Gerencie os cursos e seus coordenadores</CardDescription>
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
                    Novo Curso
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingCourse ? 'Editar Curso' : 'Novo Curso'}
                  </DialogTitle>
                  <DialogDescription>
                    Preencha os dados do curso
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Curso *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Mestrado em Ciência da Computação"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coordinatorId">Coordenador</Label>
                    <Select
                      value={formData.coordinatorId || 'none'}
                      onValueChange={(value) => setFormData({ ...formData, coordinatorId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um coordenador" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {coordinators.map((coordinator) => {
                          const coordinatorCourseCount = courses.filter(c => c.coordinatorId === coordinator.id).length;
                          const isAtLimit = coordinatorCourseCount >= 8;
                          return (
                            <SelectItem 
                              key={coordinator.id} 
                              value={coordinator.id}
                              disabled={isAtLimit && (!editingCourse || editingCourse.coordinatorId !== coordinator.id)}
                            >
                              {coordinator.firstName} {coordinator.lastName} ({coordinator.login}) - {coordinatorCourseCount}/8 cursos
                              {isAtLimit && ' - Limite atingido'}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tutorId">Tutor</Label>
                    <Select
                      value={formData.tutorId || 'none'}
                      onValueChange={(value) => setFormData({ ...formData, tutorId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um tutor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {tutors.map((tutor) => (
                          <SelectItem key={tutor.id} value={tutor.id}>
                            {tutor.firstName} {tutor.lastName} ({tutor.login})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Disciplinas Section */}
                  <div className="space-y-2">
                    <Label>Disciplinas (opcional)</Label>
                    <p className="text-sm text-muted-foreground">
                      Selecione as disciplinas que fazem parte deste curso
                    </p>
                    <ScrollArea className="h-[200px] border rounded-lg p-3">
                      <div className="space-y-2">
                        {disciplines.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhuma disciplina cadastrada
                          </p>
                        ) : (
                          disciplines.map((discipline: any) => {
                            const disciplineCourseIds = discipline.courseIds || [discipline.courseId].filter(Boolean);
                            const isAtLimit = disciplineCourseIds.length >= 15 && !disciplineCourseIds.includes(editingCourse?.id);
                            const isChecked = selectedDisciplineIds.has(discipline.id);
                            
                            return (
                              <div key={discipline.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`discipline-${discipline.id}`}
                                  checked={isChecked}
                                  disabled={isAtLimit && !isChecked}
                                  onCheckedChange={(checked) => {
                                    const newSelected = new Set(selectedDisciplineIds);
                                    if (checked) {
                                      newSelected.add(discipline.id);
                                    } else {
                                      newSelected.delete(discipline.id);
                                    }
                                    setSelectedDisciplineIds(newSelected);
                                  }}
                                />
                                <label
                                  htmlFor={`discipline-${discipline.id}`}
                                  className={`text-sm flex-1 cursor-pointer ${isAtLimit && !isChecked ? 'text-muted-foreground' : ''}`}
                                >
                                  {discipline.name} 
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({disciplineCourseIds.length}/15 cursos)
                                  </span>
                                  {isAtLimit && !isChecked && (
                                    <span className="text-xs text-destructive ml-1"> - Limite atingido</span>
                                  )}
                                </label>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground">
                      {selectedDisciplineIds.size} disciplina(s) selecionada(s)
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
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
        <CardContent>
          <Input
            placeholder="Buscar por nome do curso, coordenador ou tutor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />
          {courses.filter(course => {
            if (!searchTerm) return true;
            const search = searchTerm.toLowerCase();
            return (
              course.name.toLowerCase().includes(search) ||
              course.coordinatorName?.toLowerCase().includes(search) ||
              course.tutorName?.toLowerCase().includes(search)
            );
          }).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhum curso encontrado.</p>
              <p className="text-sm mt-2">{searchTerm ? 'Tente buscar com outros termos.' : 'Clique em "Novo Curso" para adicionar.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {courses.filter(course => {
                if (!searchTerm) return true;
                const search = searchTerm.toLowerCase();
                return (
                  course.name.toLowerCase().includes(search) ||
                  course.coordinatorName?.toLowerCase().includes(search) ||
                  course.tutorName?.toLowerCase().includes(search)
                );
              }).map((course) => (
                <div
                  key={course.id}
                  className="border rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <h4 className="font-semibold text-lg">{course.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground">
                        Coordenador: {course.coordinatorName ? (() => {
                          const coord = coordinators.find(c => c.id === course.coordinatorId);
                          return coord ? `${course.coordinatorName} (${coord.login})` : course.coordinatorName;
                        })() : 'Não atribuído'}
                      </p>
                      {course.coordinatorId && (
                        <Badge variant="secondary" className="text-xs">
                          {courses.filter(c => c.coordinatorId === course.coordinatorId).length}/8 cursos
                        </Badge>
                      )}
                    </div>
                    {course.tutorName && (
                      <p className="text-sm text-muted-foreground">
                        Tutor: {(() => {
                          const tut = tutors.find(t => t.id === course.tutorId);
                          return tut ? `${course.tutorName} (${tut.login})` : course.tutorName;
                        })()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(course)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(course)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Pré-visualização dos Dados</DialogTitle>
            <DialogDescription>
              {previewData.length} curso(s) encontrado(s). Revise os dados antes de importar.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Nome do Curso</TableHead>
                  <TableHead>Login Coordenador</TableHead>
                  <TableHead>Coordenador</TableHead>
                  <TableHead>Login Tutor</TableHead>
                  <TableHead>Tutor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{row['Nome do Curso'] || '-'}</TableCell>
                    <TableCell>
                      <code className="text-xs">{row['Login do Coordenador'] || '-'}</code>
                    </TableCell>
                    <TableCell>
                      {row.coordinatorFound ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {row.coordinatorFullName}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          NÃO ENCONTRADO
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {row['Login do Tutor'] ? (
                        <code className="text-xs">{row['Login do Tutor']}</code>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row['Login do Tutor'] ? (
                        row.tutorFound ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {row.tutorFullName}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            NÃO ENCONTRADO
                          </Badge>
                        )
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmImport} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                'Confirmar Importação'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Result Dialog */}
      <Dialog open={uploadResultOpen} onOpenChange={setUploadResultOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resultado da Importação de Cursos</DialogTitle>
            <DialogDescription>
              Resumo do processamento da planilha
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {uploadResult.created.length > 0 && (
              <div>
                <h4 className="font-semibold text-secondary mb-2">
                  ✓ Criados ({uploadResult.created.length})
                </h4>
                <div className="space-y-1 text-sm max-h-48 overflow-y-auto">
                  {uploadResult.created.map((item, idx) => (
                    <p key={idx} className="text-muted-foreground">• {item}</p>
                  ))}
                </div>
              </div>
            )}
            
            {uploadResult.ignored.length > 0 && (
              <div>
                <h4 className="font-semibold text-warning mb-2">
                  ⊘ Ignorados ({uploadResult.ignored.length})
                </h4>
                <div className="space-y-1 text-sm max-h-48 overflow-y-auto">
                  {uploadResult.ignored.map((item, idx) => (
                    <p key={idx} className="text-muted-foreground">• {item}</p>
                  ))}
                </div>
              </div>
            )}
            
            {uploadResult.errors.length > 0 && (
              <div>
                <h4 className="font-semibold text-destructive mb-2">
                  ✕ Erros ({uploadResult.errors.length})
                </h4>
                <div className="space-y-1 text-sm max-h-48 overflow-y-auto">
                  {uploadResult.errors.map((item, idx) => (
                    <p key={idx} className="text-muted-foreground">• {item}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setUploadResultOpen(false)}>
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o curso <strong>{courseToDelete?.name}</strong>?
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
    </div>
  );
};

export default CoursesTab;
