import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Discipline } from '@/types';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const CoordinatorDashboard = () => {
  const { userData } = useAuth();
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [filteredDisciplines, setFilteredDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [coordinatorCourses, setCoordinatorCourses] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'alphabetical' | 'month'>('month');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [userData]);

  useEffect(() => {
    filterDisciplines();
  }, [disciplines, sortOrder, searchTerm]);

  const filterDisciplines = () => {
    let filtered = [...disciplines];
    
    // Aplicar busca
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(d => 
        d.name.toLowerCase().includes(search) ||
        d.courseNames?.some(cn => cn.toLowerCase().includes(search)) ||
        d.professorLogin?.toLowerCase().includes(search)
      );
    }
    
    // Aplicar ordenação
    if (sortOrder === 'alphabetical') {
      filtered.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    } else {
      // Ordem por mês - usar mes-1 como referência
      filtered.sort((a, b) => {
        const monthA = a['mes-1'] || '9999-99';
        const monthB = b['mes-1'] || '9999-99';
        return monthA.localeCompare(monthB);
      });
    }
    
    setFilteredDisciplines(filtered);
  };

  const loadData = async () => {
    if (!userData) return;

    try {
      setLoading(true);

      // Find courses where this coordinator is responsible via login
      const coursesQuery = query(
        collection(db, 'curs-pos-mensal'),
        where('coordinatorLogin', '==', userData.login)
      );
      const coursesSnapshot = await getDocs(coursesQuery);
      const courseIds = coursesSnapshot.docs.map((doc) => doc.id);
      setCoordinatorCourses(courseIds);

      // Load all disciplines
      const disciplinesSnapshot = await getDocs(collection(db, 'disc-pos-mensal'));
      const disciplinesData = disciplinesSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Discipline;
      });

      // Filter disciplines that belong to coordinator's courses
      const coordinatorDisciplines = disciplinesData.filter(d => 
        d.courseIds?.some(cid => courseIds.includes(cid))
      );

      setDisciplines(coordinatorDisciplines);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard do Coordenador</h1>
        <p className="text-muted-foreground mt-2">
          Olá, {userData?.firstName} {userData?.lastName}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Disciplinas</CardTitle>
            <CardDescription>
              Gerencie as disciplinas dos seus cursos
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="mb-6 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar</label>
              <Input
                placeholder="Buscar por disciplina, curso ou professor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Ordenar Por</label>
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as any)}>
                <SelectTrigger className="w-full md:w-[250px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mês</SelectItem>
                  <SelectItem value="alphabetical">Ordem Alfabética</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lista de Disciplinas */}
          <div className="space-y-4">
            {filteredDisciplines.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nenhuma disciplina encontrada</p>
              </div>
            ) : (
              filteredDisciplines.map((discipline) => (
                <Card key={discipline.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-semibold text-lg">{discipline.name}</h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {discipline.courseNames?.map((courseName, idx) => (
                            <Badge key={idx} variant="secondary">{courseName}</Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Professor:</span>{' '}
                          <span className="font-medium text-xs">{discipline.professorLogin || 'Não atribuído'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tutor:</span>{' '}
                          <span className="font-medium text-xs">{discipline.tutorLogin || 'Não atribuído'}</span>
                        </div>
                        {discipline['mes-1'] && (
                          <div>
                            <span className="text-muted-foreground">Mês 1:</span>{' '}
                            <span className="font-medium">{discipline['mes-1']}</span>
                          </div>
                        )}
                        {discipline['mes-2'] && (
                          <div>
                            <span className="text-muted-foreground">Mês 2:</span>{' '}
                            <span className="font-medium">{discipline['mes-2']}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CoordinatorDashboard;
