import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

const ReportsTab = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const exportToExcel = (data: any[], fileName: string, sheetName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  const exportCourses = async () => {
    setLoading('courses');
    try {
      const snapshot = await getDocs(collection(db, 'curso'));
      const courses = snapshot.docs.map(doc => ({
        Nome: doc.data().name || '',
        Coordenador: doc.data().coordinatorName || '',
        Tutor: doc.data().tutorName || '',
        'Data de Criação': doc.data().createdAt?.toDate?.()?.toLocaleDateString('pt-BR') || ''
      }));
      
      if (courses.length === 0) {
        toast.error('Nenhum curso encontrado');
        return;
      }
      
      exportToExcel(courses, 'cursos', 'Cursos');
      toast.success(`${courses.length} cursos exportados`);
    } catch (error) {
      console.error('Erro ao exportar cursos:', error);
      toast.error('Erro ao exportar cursos');
    } finally {
      setLoading(null);
    }
  };

  const exportDisciplines = async () => {
    setLoading('disciplines');
    try {
      const snapshot = await getDocs(collection(db, 'disc-pos-mensal'));
      const disciplines = snapshot.docs.map(doc => ({
        Nome: doc.data().name || '',
        Curso: doc.data().courseName || '',
        Professor: doc.data().professorLogin || '',
        Tutor: doc.data().tutorLogin || '',
        Coordenador: doc.data().coordinatorLogin || '',
        Status: doc.data().status || '',
        Mês: doc.data().month || '',
        Data: doc.data().date || ''
      }));
      
      if (disciplines.length === 0) {
        toast.error('Nenhuma disciplina encontrada');
        return;
      }
      
      exportToExcel(disciplines, 'disciplinas', 'Disciplinas');
      toast.success(`${disciplines.length} disciplinas exportadas`);
    } catch (error) {
      console.error('Erro ao exportar disciplinas:', error);
      toast.error('Erro ao exportar disciplinas');
    } finally {
      setLoading(null);
    }
  };

  const exportProfessorsByDiscipline = async () => {
    setLoading('professors');
    try {
      const snapshot = await getDocs(collection(db, 'disc-pos-mensal'));
      const data = snapshot.docs.map(doc => ({
        Disciplina: doc.data().name || '',
        Curso: doc.data().courseName || '',
        Professor: doc.data().professorLogin || '',
        Status: doc.data().status || '',
        Mês: doc.data().month || ''
      }));
      
      if (data.length === 0) {
        toast.error('Nenhum dado encontrado');
        return;
      }
      
      exportToExcel(data, 'professores-por-disciplina', 'Professores');
      toast.success(`${data.length} registros exportados`);
    } catch (error) {
      console.error('Erro ao exportar professores:', error);
      toast.error('Erro ao exportar professores');
    } finally {
      setLoading(null);
    }
  };

  const exportCoordinatorsByCourse = async () => {
    setLoading('coordinators');
    try {
      const coursesSnapshot = await getDocs(collection(db, 'curso'));
      const disciplinesSnapshot = await getDocs(collection(db, 'disc-pos-mensal'));
      
      const courseData = coursesSnapshot.docs.map(doc => ({
        Tipo: 'Curso',
        Nome: doc.data().name || '',
        'Nome do Coordenador': doc.data().coordinatorName || '',
        'Login do Coordenador': doc.data().coordinatorLogin || ''
      }));
      
      const disciplineData = disciplinesSnapshot.docs.map(doc => ({
        Tipo: 'Disciplina',
        Nome: doc.data().name || '',
        'Nome do Coordenador': doc.data().coordinatorName || '',
        'Login do Coordenador': doc.data().coordinatorLogin || ''
      }));
      
      const allData = [...courseData, ...disciplineData];
      
      if (allData.length === 0) {
        toast.error('Nenhum dado encontrado');
        return;
      }
      
      exportToExcel(allData, 'coordenadores', 'Coordenadores');
      toast.success(`${allData.length} registros exportados`);
    } catch (error) {
      console.error('Erro ao exportar coordenadores:', error);
      toast.error('Erro ao exportar coordenadores');
    } finally {
      setLoading(null);
    }
  };

  const exportDisciplinesByPeriod = async () => {
    if (!startDate || !endDate) {
      toast.error('Selecione o período inicial e final');
      return;
    }
    
    setLoading('period');
    try {
      const snapshot = await getDocs(collection(db, 'disc-pos-mensal'));
      
      const disciplines = snapshot.docs
        .filter(doc => {
          const dateStr = doc.data().date;
          if (!dateStr) return false;
          
          // Parse date string (assuming format YYYY-MM-DD or similar)
          const docDate = new Date(dateStr);
          return docDate >= startDate && docDate <= endDate;
        })
        .map(doc => ({
          Nome: doc.data().name || '',
          Curso: doc.data().courseName || '',
          Professor: doc.data().professorLogin || '',
          Coordenador: doc.data().coordinatorLogin || '',
          Status: doc.data().status || '',
          Data: doc.data().date || '',
          Mês: doc.data().month || ''
        }));
      
      if (disciplines.length === 0) {
        toast.error('Nenhuma disciplina encontrada no período');
        return;
      }
      
      const periodStr = `${format(startDate, 'dd-MM-yyyy')}_a_${format(endDate, 'dd-MM-yyyy')}`;
      exportToExcel(disciplines, `disciplinas-${periodStr}`, 'Disciplinas');
      toast.success(`${disciplines.length} disciplinas exportadas`);
    } catch (error) {
      console.error('Erro ao exportar disciplinas por período:', error);
      toast.error('Erro ao exportar disciplinas');
    } finally {
      setLoading(null);
    }
  };

  const exportAll = async () => {
    setLoading('all');
    try {
      const [coursesSnapshot, disciplinesSnapshot] = await Promise.all([
        getDocs(collection(db, 'curso')),
        getDocs(collection(db, 'disc-pos-mensal'))
      ]);

      // Sheet 1: Cursos
      const coursesData = coursesSnapshot.docs.map(doc => ({
        'Nome do Curso': doc.data().name || '',
        'Nome do Coordenador': doc.data().coordinatorName || '',
        'Login do Coordenador': doc.data().coordinatorLogin || '',
        'Nome do Tutor': doc.data().tutorName || '',
        'Login do Tutor': doc.data().tutorLogin || '',
        'Data de Criação': doc.data().createdAt?.toDate?.()?.toLocaleDateString('pt-BR') || ''
      }));

      // Sheet 2: Disciplinas completas
      const disciplinesData = disciplinesSnapshot.docs.map(doc => ({
        'Nome da Disciplina': doc.data().name || '',
        'Curso': doc.data().courseName || '',
        'Nome do Coordenador': doc.data().coordinatorName || '',
        'Login do Coordenador': doc.data().coordinatorLogin || '',
        'Nome do Professor': doc.data().professorName || '',
        'Login do Professor': doc.data().professorLogin || '',
        'Nome do Tutor': doc.data().tutorName || '',
        'Login do Tutor': doc.data().tutorLogin || '',
        'Status': doc.data().status || '',
        'Mês': doc.data().month || '',
        'Data': doc.data().date || ''
      }));

      // Sheet 3: Resumo por período (agrupa disciplinas por mês)
      const periodSummary: Record<string, { count: number; disciplines: string[] }> = {};
      disciplinesSnapshot.docs.forEach(doc => {
        const month = doc.data().month || 'Sem período';
        if (!periodSummary[month]) {
          periodSummary[month] = { count: 0, disciplines: [] };
        }
        periodSummary[month].count++;
        periodSummary[month].disciplines.push(doc.data().name || 'Sem nome');
      });

      const periodData = Object.entries(periodSummary).map(([month, data]) => ({
        'Período/Mês': month,
        'Quantidade de Disciplinas': data.count,
        'Disciplinas': data.disciplines.join(', ')
      }));

      if (coursesData.length === 0 && disciplinesData.length === 0) {
        toast.error('Nenhum dado encontrado para exportar');
        return;
      }

      // Create workbook with multiple sheets
      const workbook = XLSX.utils.book_new();
      
      if (coursesData.length > 0) {
        const coursesSheet = XLSX.utils.json_to_sheet(coursesData);
        XLSX.utils.book_append_sheet(workbook, coursesSheet, 'Cursos');
      }
      
      if (disciplinesData.length > 0) {
        const disciplinesSheet = XLSX.utils.json_to_sheet(disciplinesData);
        XLSX.utils.book_append_sheet(workbook, disciplinesSheet, 'Disciplinas');
      }
      
      if (periodData.length > 0) {
        const periodSheet = XLSX.utils.json_to_sheet(periodData);
        XLSX.utils.book_append_sheet(workbook, periodSheet, 'Por Período');
      }

      const today = format(new Date(), 'dd-MM-yyyy');
      XLSX.writeFile(workbook, `relatorio-completo-${today}.xlsx`);
      toast.success(`Relatório completo exportado: ${coursesData.length} cursos, ${disciplinesData.length} disciplinas`);
    } catch (error) {
      console.error('Erro ao exportar relatório completo:', error);
      toast.error('Erro ao exportar relatório completo');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Exportar Cursos
            </CardTitle>
            <CardDescription>
              Lista completa de todos os cursos cadastrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportCourses} disabled={loading === 'courses'} className="w-full">
              {loading === 'courses' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Exportar XLSX
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Exportar Disciplinas
            </CardTitle>
            <CardDescription>
              Lista completa de todas as disciplinas cadastradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportDisciplines} disabled={loading === 'disciplines'} className="w-full">
              {loading === 'disciplines' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Exportar XLSX
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Professores por Disciplina
            </CardTitle>
            <CardDescription>
              Relação de professores vinculados a cada disciplina
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportProfessorsByDiscipline} disabled={loading === 'professors'} className="w-full">
              {loading === 'professors' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Exportar XLSX
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Coordenadores
            </CardTitle>
            <CardDescription>
              Coordenadores por curso e por disciplina
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportCoordinatorsByCourse} disabled={loading === 'coordinators'} className="w-full">
              {loading === 'coordinators' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Exportar XLSX
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Exportar Tudo
          </CardTitle>
          <CardDescription>
            Relatório completo com cursos, disciplinas, coordenadores, professores e períodos em múltiplas abas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportAll} disabled={loading === 'all'} className="w-full">
            {loading === 'all' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exportar Relatório Completo (XLSX)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Disciplinas por Período
          </CardTitle>
          <CardDescription>
            Exportar disciplinas que ocorreram em um período específico
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Button 
            onClick={exportDisciplinesByPeriod} 
            disabled={loading === 'period' || !startDate || !endDate}
            className="w-full md:w-auto"
          >
            {loading === 'period' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exportar Disciplinas do Período
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsTab;
