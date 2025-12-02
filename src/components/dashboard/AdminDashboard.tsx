import { useState } from 'react';
import Header from './Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, LayoutDashboard, BookOpen, Users, GraduationCap } from 'lucide-react';
import UploadTab from './admin/UploadTab';
import OverviewTab from './admin/OverviewTab';
import DisciplinesTab from './admin/DisciplinesTab';
import CoursesTab from './admin/CoursesTab';
import PeopleTab from './admin/PeopleTab';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Função para notificar todas as abas que os dados mudaram
  const handleDataChange = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Painel Administrativo</h2>
          <p className="text-muted-foreground mt-2">
            Gerencie disciplinas, cursos e professores
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Visão Geral</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="disciplines" className="gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Disciplinas</span>
            </TabsTrigger>
            <TabsTrigger value="courses" className="gap-2">
              <GraduationCap className="h-4 w-4" />
              <span className="hidden sm:inline">Cursos</span>
            </TabsTrigger>
            <TabsTrigger value="people" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab key={`overview-${refreshTrigger}`} onDataChange={handleDataChange} />
          </TabsContent>

          <TabsContent value="upload">
            <UploadTab key={`upload-${refreshTrigger}`} onDataChange={handleDataChange} />
          </TabsContent>

          <TabsContent value="disciplines">
            <DisciplinesTab key={`disciplines-${refreshTrigger}`} onDataChange={handleDataChange} />
          </TabsContent>

          <TabsContent value="courses">
            <CoursesTab key={`courses-${refreshTrigger}`} onDataChange={handleDataChange} />
          </TabsContent>

          <TabsContent value="people">
            <PeopleTab key={`people-${refreshTrigger}`} onDataChange={handleDataChange} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
