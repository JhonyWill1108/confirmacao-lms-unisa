import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Course, Discipline, Person } from '@/types';
import { Plus, Loader2, Edit, Trash2, ChevronsUpDown, Check } from 'lucide-react';
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

interface DisciplinesTabProps {
  onDataChange?: () => void;
}

const DisciplinesTab = ({ onDataChange }: DisciplinesTabProps) => {
  const { userData } = useAuth();
  const { logAction } = useAuditLog();
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [filteredDisciplines, setFilteredDisciplines] = useState<Discipline[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [professors, setProfessors] = useState<Person[]>([]);
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

  useEffect(() => {
    loadDisciplines();
    loadCourses();
    loadProfessors();
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
      // Ordenar alfabeticamente
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
        const monthA = a['mes-1'] || '9999-99';
        const monthB = b['mes-1'] || '9999-99';
        return monthA.localeCompare(monthB);
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
        
        // Log audit
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
        
        // Log audit
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
      
      // Log audit
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
                      <Label htmlFor="coordinatorLogin">Login Coordenador</Label>
                      <Input
                        id="coordinatorLogin"
                        value={formData.coordinatorLogin}
                        onChange={(e) => setFormData({ ...formData, coordinatorLogin: e.target.value })}
                        placeholder="Ex: joao.silva"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="professorLogin">Professor</Label>
                      <Popover open={professorPopoverOpen} onOpenChange={setProfessorPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id="professorLogin"
                            variant="outline"
                            role="combobox"
                            aria-expanded={professorPopoverOpen}
                            className="w-full justify-between"
                          >
                            {formData.professorLogin
                              ? (() => {
                                  const prof = professors.find((p) => p.login === formData.professorLogin);
                                  return prof ? `${prof.firstName} ${prof.lastName} (${prof.login})` : formData.professorLogin;
                                })()
                              : "Selecionar professor..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput placeholder="Buscar professor..." />
                            <CommandList>
                              <CommandEmpty>Nenhum professor encontrado.</CommandEmpty>
                              <CommandGroup>
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
                      <Label htmlFor="tutorLogin">Login Tutor</Label>
                      <Input
                        id="tutorLogin"
                        value={formData.tutorLogin}
                        onChange={(e) => setFormData({ ...formData, tutorLogin: e.target.value })}
                        placeholder="Ex: carlos.lima"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mes-1">Mês 1 (YYYY-MM)</Label>
                      <Input
                        id="mes-1"
                        value={formData['mes-1']}
                        onChange={(e) => setFormData({ ...formData, 'mes-1': e.target.value })}
                        placeholder="Ex: 2025-03"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mes-2">Mês 2 (YYYY-MM)</Label>
                      <Input
                        id="mes-2"
                        value={formData['mes-2']}
                        onChange={(e) => setFormData({ ...formData, 'mes-2': e.target.value })}
                        placeholder="Ex: 2025-04"
                      />
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
                            {discipline.coordinatorLogin}
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
                            {discipline.tutorLogin}
                          </div>
                        )}
                        {discipline['mes-1'] && (
                          <div>
                            <span className="text-muted-foreground">Mês 1:</span>{' '}
                            {discipline['mes-1']}
                          </div>
                        )}
                        {discipline['mes-2'] && (
                          <div>
                            <span className="text-muted-foreground">Mês 2:</span>{' '}
                            {discipline['mes-2']}
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
    </div>
  );
};

export default DisciplinesTab;
