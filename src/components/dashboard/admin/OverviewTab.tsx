import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { BookOpen, GraduationCap, Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Course, Discipline } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CourseWithDisciplines extends Course {
  disciplines: Discipline[];
}

interface OverviewTabProps {
  onDataChange?: () => void;
}

const OverviewTab = ({ onDataChange }: OverviewTabProps) => {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesWithDisciplines, setCoursesWithDisciplines] = useState<CourseWithDisciplines[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [disciplineSortOrder, setDisciplineSortOrder] = useState<'alphabetical' | 'month'>('month');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load disciplines
      const disciplinesSnapshot = await getDocs(collection(db, 'disc-pos-mensal'));
      const disciplinesData = disciplinesSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          courseIds: data.courseIds || [],
          courseNames: data.courseNames || [],
          coordinatorLogin: data.coordinatorLogin || '',
          professorLogin: data.professorLogin || '',
          tutorLogin: data.tutorLogin || '',
          'mes-1': data['mes-1'] || '',
          'mes-2': data['mes-2'] || '',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Discipline;
      });
      setDisciplines(disciplinesData);

      // Load courses
      const coursesSnapshot = await getDocs(collection(db, 'curs-pos-mensal'));
      const coursesData = coursesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Course[];

      // Ordenar cursos alfabeticamente
      coursesData.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      setCourses(coursesData);

      // Combinar cursos com suas disciplinas
      const combined = coursesData.map(course => {
        const courseDisciplines = disciplinesData.filter(d => 
          d.courseIds?.includes(course.id)
        );
        return {
          ...course,
          disciplines: courseDisciplines,
        };
      });

      setCoursesWithDisciplines(combined);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Erro ao carregar dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDisciplineLogin = async (disciplineId: string, field: 'coordinatorLogin' | 'professorLogin' | 'tutorLogin', value: string) => {
    try {
      await updateDoc(doc(db, 'disc-pos-mensal', disciplineId), {
        [field]: value,
        updatedAt: Timestamp.now(),
      });
      
      toast({
        title: 'Login atualizado',
        description: 'O login foi atualizado com sucesso.',
      });
      
      loadData();
      onDataChange?.();
    } catch (error) {
      console.error('Error updating login:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o login.',
        variant: 'destructive',
      });
    }
  };

  const toggleCourse = (courseId: string) => {
    const newExpanded = new Set(expandedCourses);
    if (newExpanded.has(courseId)) {
      newExpanded.delete(courseId);
    } else {
      newExpanded.add(courseId);
    }
    setExpandedCourses(newExpanded);
  };

  const getSortedDisciplines = (disciplines: Discipline[]) => {
    if (disciplineSortOrder === 'alphabetical') {
      return [...disciplines].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    } else {
      return [...disciplines].sort((a, b) => {
        const monthA = a['mes-1'] || '9999-99';
        const monthB = b['mes-1'] || '9999-99';
        return monthA.localeCompare(monthB);
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = {
    total: disciplines.length,
    totalCourses: courses.length,
  };

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Disciplinas</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastradas no sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cursos Ativos</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalCourses}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pós-graduação
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Course Details with Disciplines */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cursos e Disciplinas</CardTitle>
                <CardDescription>
                  Visualize e edite todos os cursos e disciplinas
                </CardDescription>
              </div>
              <Button onClick={loadData} variant="outline" size="sm">
                Atualizar
              </Button>
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Buscar por curso ou disciplina..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-[300px]"
              />
              <div className="flex items-center gap-2">
                <Label htmlFor="sort-order" className="text-sm font-medium whitespace-nowrap">
                  Ordenar disciplinas por:
                </Label>
                <Select
                  value={disciplineSortOrder}
                  onValueChange={(value) => setDisciplineSortOrder(value as 'alphabetical' | 'month')}
                >
                  <SelectTrigger id="sort-order" className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Mês</SelectItem>
                    <SelectItem value="alphabetical">Ordem Alfabética</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {coursesWithDisciplines.filter(course => {
                if (!searchTerm) return true;
                const search = searchTerm.toLowerCase();
                return (
                  course.name.toLowerCase().includes(search) ||
                  course.disciplines.some(d => d.name.toLowerCase().includes(search))
                );
              }).map((course) => (
                <Card key={course.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCourse(course.id)}
                        >
                          {expandedCourses.has(course.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <div>
                          <CardTitle className="text-xl">{course.name}</CardTitle>
                          <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
                            <span>{course.disciplines.length} disciplina(s)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {expandedCourses.has(course.id) && (
                    <CardContent className="space-y-3">
                      {getSortedDisciplines(course.disciplines).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhuma disciplina vinculada a este curso
                        </p>
                      ) : (
                        getSortedDisciplines(course.disciplines).map((discipline) => (
                          <Card key={discipline.id} className="bg-muted/50">
                            <CardContent className="pt-4 space-y-3">
                              <div>
                                <h4 className="font-medium">{discipline.name}</h4>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {discipline.courseNames?.map((cn, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {cn}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Coordenador</Label>
                                  <div className="font-medium text-xs">
                                    {discipline.coordinatorLogin || 'Não atribuído'}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Professor</Label>
                                  <div className="font-medium text-xs">
                                    {discipline.professorLogin || 'Não atribuído'}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Tutor</Label>
                                  <div className="font-medium text-xs">
                                    {discipline.tutorLogin || 'Não atribuído'}
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {discipline['mes-1'] && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Mês 1</Label>
                                    <div className="font-medium">{discipline['mes-1']}</div>
                                  </div>
                                )}
                                {discipline['mes-2'] && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Mês 2</Label>
                                    <div className="font-medium">{discipline['mes-2']}</div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewTab;
